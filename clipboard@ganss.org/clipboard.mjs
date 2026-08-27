import { getSettings, KEEP_ORIGINAL } from "./settings.mjs";
import { canEncode, transcodeImage } from "./images.mjs";

/**
 * Clipboard flavours we know how to turn into an attachment, in decreasing
 * order of preference. The preferred image format configured by the user is
 * moved to the front of this list at runtime.
 */
const TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/avif",
    "image/png",
    "image/gif", // not supported by canvas encoders, converting yields a still image
    "text/html",
    "text/unicode",
    "text/plain"
];

const EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "text/html": "html",
    "text/unicode": "txt",
    "text/plain": "txt"
};

function getFileName(type, index) {
    return `document_${index}.${EXTENSIONS[type] ?? "txt"}`;
}

function isImage(type) {
    return type.startsWith("image/");
}

/**
 * The flavours this platform can read, most preferred first.
 *
 * @param {string} imageFormat - Configured target format or KEEP_ORIGINAL.
 * @returns {string[]}
 */
function getSupportedTypes(imageFormat) {
    // Putting the target format first means we do not have to re-encode at all
    // if the clipboard already offers the image in the desired format.
    let ordered = imageFormat == KEEP_ORIGINAL
        ? TYPES
        : [imageFormat, ...TYPES.filter(type => type != imageFormat)];

    return ordered.filter(type => {
        try {
            return ClipboardItem.supports(type);
        } catch (e) {
            return false;
        }
    });
}

/**
 * Picks the flavour to use for a clipboard item.
 *
 * @param {string[]} available - Flavours offered by the clipboard item.
 * @param {string[]} preference - Flavours we support, most preferred first.
 * @returns {string} the flavour to read.
 */
function getPreferredSupportedType(available, preference) {
    return preference.find(type => available.includes(type)) ?? available[0];
}

/**
 * Reads the clipboard, asking for unsanitized content where the platform
 * supports it. Older/newer platforms that reject the options object still get
 * a plain read.
 */
async function readClipboard(supportedTypes) {
    try {
        return await navigator.clipboard.read({ unsanitized: supportedTypes });
    } catch (e) {
        if (e?.name == "TypeError" || e?.name == "NotSupportedError") {
            return await navigator.clipboard.read();
        }
        throw e;
    }
}

/**
 * Creates attachments in the given compose tab from the current clipboard
 * content.
 *
 * @param {object} tab - The compose tab.
 * @returns {Promise<number>} the number of attachments created.
 */
export async function insertFromClipboard(tab) {
    if (tab.type != "messageCompose") {
        return 0;
    }

    let settings = await getSettings();
    let supportedTypes = getSupportedTypes(settings.imageFormat);

    let clipboardItems = await readClipboard(supportedTypes);
    if (clipboardItems.length == 0) {
        return 0;
    }

    // Start index at the number of already existing attachments so new
    // filenames don't collide with attachments already in the message.
    let existingAttachments = await browser.compose.listAttachments(tab.id);
    let index = existingAttachments.length + 1;
    let created = 0;

    for (let clipboardItem of clipboardItems) {
        let sourceType = getPreferredSupportedType(clipboardItem.types, supportedTypes);
        if (!sourceType) {
            continue;
        }

        let blob = await clipboardItem.getType(sourceType);
        if (blob.size == 0) {
            continue; // Skip empty items instead of aborting the whole batch.
        }

        let type = sourceType;
        if (isImage(sourceType)) {
            let converted = await convertIfNeeded(blob, sourceType, settings);
            blob = converted.blob;
            type = converted.type;
        }

        await browser.compose.addAttachment(tab.id, {
            file: new File([blob], getFileName(type, index), { type })
        });
        index++;
        created++;
    }

    return created;
}

/**
 * Applies the configured target format and size limit to an image blob.
 * Returns the untouched blob if no conversion is necessary or possible.
 */
async function convertIfNeeded(blob, sourceType, settings) {
    let targetType = settings.imageFormat == KEEP_ORIGINAL ? sourceType : settings.imageFormat;
    if (targetType == "image/jpg") {
        targetType = "image/jpeg";
    }
    let normalizedSource = sourceType == "image/jpg" ? "image/jpeg" : sourceType;

    let needsFormatChange = targetType != normalizedSource;
    let needsScaling = settings.maxDimension > 0;

    if (!needsFormatChange && !needsScaling) {
        return { blob, type: normalizedSource };
    }

    // Keeping the original is better than silently attaching a PNG that claims
    // to be something else, which is what Gecko would hand us back.
    if (!canEncode(targetType)) {
        console.warn(`Attach from Clipboard: cannot encode ${targetType}, keeping ${normalizedSource}`);
        if (!needsScaling || !canEncode(normalizedSource)) {
            return { blob, type: normalizedSource };
        }
        targetType = normalizedSource;
    }

    try {
        let converted = await transcodeImage(blob, {
            type: targetType,
            quality: settings.imageQuality,
            maxDimension: settings.maxDimension
        });
        return { blob: converted, type: targetType };
    } catch (e) {
        console.warn("Attach from Clipboard: conversion failed, attaching the original", e);
        return { blob, type: normalizedSource };
    }
}
