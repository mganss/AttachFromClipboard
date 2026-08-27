import {
    buildUniqueName,
    getExtension,
    getFileNameSettings
} from "./filenames.mjs";

const TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/png",
    "image/gif", // not supported by canvas.toDataUrl(), will be a png in a gif
    "text/html",
    "text/unicode",
    "text/plain"
];

async function getSupportedTypes() {
    // Push the preferred type to the top and then filter the resulting array
    // by what the platform supports. If we are lucky, our preferred type is
    // supported directly. If not, we have to manually convert it later.
    let preferred_image_format = await getPreferredImageType();
    return [preferred_image_format, ...TYPES].filter(ClipboardItem.supports);
}

async function getPreferredImageType() {
    let { preferred_image_format } = await browser.storage.local.get(
        { preferred_image_format: null }
    );
    return preferred_image_format;
}

async function getPreferredSupportedType(types) {
    let flavours = await getSupportedTypes();
    let indices = types.map(type => flavours.indexOf(type)).filter(i => i !== -1);
    if (indices.length === 0) {
        // None of the supported types is preferred, return the first supported one.
        return types[0];
    }
    // Use numeric sort to find the lowest (most preferred) index.
    indices.sort((a, b) => a - b);
    return flavours[indices[0]];
}

export async function insertFromClipboard(tab) {
    if (tab.type != "messageCompose") {
        return;
    }

    let clipboardItems = await navigator.clipboard.read(
        { unsanitized: await getSupportedTypes() }
    );
    if (clipboardItems.length == 0) {
        return;
    }

    // Names of the attachments already in the message, so a generated name
    // never collides with one that is still in use.
    const existingAttachments = await browser.compose.listAttachments(tab.id);
    const takenNames = new Set(
        existingAttachments.map(a => a.name).filter(Boolean).map(name => name.toLowerCase())
    );
    const { prefix, scheme } = await getFileNameSettings();
    // One point in time for the whole batch keeps a multi item paste together.
    const date = new Date();

    for (let clipboardItem of clipboardItems) {
        const preferredSupportedType = await getPreferredSupportedType(clipboardItem.types);
        let blob = await clipboardItem.getType(preferredSupportedType);
        if (blob.size == 0) {
            continue; // Skip empty items instead of aborting the whole loop.
        }

        let type = preferredSupportedType;
        // Check if the current file is an image and if it is not yet in the desired format.
        if (preferredSupportedType.startsWith("image/")) {
            const preferredImageType = await getPreferredImageType();
            if (preferredImageType && preferredImageType != preferredSupportedType) {
                blob = await convertBlobToType(blob, preferredImageType);
                type = blob.type;
            }
        }

        // Named only once the final type is known, so the name always matches
        // the content and is only handed out after the conversion succeeded.
        const file = new File([blob], buildUniqueName({
            prefix,
            scheme,
            extension: getExtension(type),
            takenNames,
            date
        }), { type });

        await browser.compose.addAttachment(tab.id, { file });
    }
};

// --- Inspired by https://gist.github.com/mikey0000/5a078346f58713d0075f

function convertDataUrlToArrayBuffer(dataUrl) {
    var BASE64_MARKER = ';base64,';
    var base64Index = dataUrl.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    var base64 = dataUrl.substring(base64Index);
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

async function loadImage(objectURL) {
    let done = Promise.withResolvers();
    let image = document.createElement("img");
    image.onload = function () {
        // https://bugzilla.mozilla.org/show_bug.cgi?id=574330#c54
        if (!image.complete) {
            image.src = image.src; // eslint-disable-line no-self-assign
            return;
        }
        done.resolve(image);
    };
    image.onerror = function () {
        done.reject();
    };
    image.src = objectURL;
    return done.promise;
}

async function convertBlobToType(blob, type) {
    let objectURL = URL.createObjectURL(blob)
    let image = await loadImage(objectURL);

    var canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);

    // The image/jpg type is actually image/jpeg an the canvas will return png,
    // if the "unknown" type image/jpg is used.
    if (type == "image/jpg") { type = "image/jpeg" };

    const dataUrl = canvas.toDataURL(type);
    const arrayBuffer = convertDataUrlToArrayBuffer(dataUrl);
    URL.revokeObjectURL(objectURL);
    return new Blob([arrayBuffer], { type });
};
