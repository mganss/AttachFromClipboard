/**
 * Image transcoding helpers. Everything in here runs in a document context
 * (background page or options page), because it needs <canvas> encoders.
 */

import { LOSSY_IMAGE_FORMATS } from "./settings.mjs";

const PROBE_CANVAS_SIZE = 2;

/** canEncode() builds a canvas, so its answers are worth remembering. */
const encoderSupport = new Map();

/**
 * Asks the platform whether it can actually *encode* the given media type.
 * Gecko silently falls back to PNG for unknown types, so the returned data URL
 * is the only reliable indicator.
 *
 * @param {string} type - Media type, e.g. "image/avif".
 * @returns {boolean}
 */
export function canEncode(type) {
    if (type == "image/png") {
        return true;
    }
    if (encoderSupport.has(type)) {
        return encoderSupport.get(type);
    }
    let supported = probeEncoder(type);
    encoderSupport.set(type, supported);
    return supported;
}

function probeEncoder(type) {
    try {
        let canvas = document.createElement("canvas");
        canvas.width = PROBE_CANVAS_SIZE;
        canvas.height = PROBE_CANVAS_SIZE;
        // Draw something, some encoders bail out on a completely empty canvas.
        let context = canvas.getContext("2d");
        context.fillStyle = "#808080";
        context.fillRect(0, 0, PROBE_CANVAS_SIZE, PROBE_CANVAS_SIZE);
        return canvas.toDataURL(type).startsWith(`data:${type};`);
    } catch (e) {
        return false;
    }
}

function scaledSize(width, height, maxDimension) {
    if (!maxDimension) {
        return { width, height };
    }
    let longestEdge = Math.max(width, height);
    if (longestEdge <= maxDimension) {
        return { width, height };
    }
    let factor = maxDimension / longestEdge;
    return {
        width: Math.max(1, Math.round(width * factor)),
        height: Math.max(1, Math.round(height * factor))
    };
}

function toBlobAsync(canvas, type, quality) {
    let done = Promise.withResolvers();
    canvas.toBlob(
        blob => blob ? done.resolve(blob) : done.reject(new Error(`Encoding as ${type} failed`)),
        type,
        quality
    );
    return done.promise;
}

/**
 * Decodes a blob into an ImageBitmap, with a fallback via <img> for platforms
 * or formats createImageBitmap() refuses.
 */
async function decode(blob) {
    try {
        return await createImageBitmap(blob);
    } catch (e) {
        let objectURL = URL.createObjectURL(blob);
        try {
            let done = Promise.withResolvers();
            let image = document.createElement("img");
            image.onload = () => done.resolve(image);
            image.onerror = () => done.reject(new Error("Image could not be decoded"));
            image.src = objectURL;
            let image_ = await done.promise;
            return {
                width: image_.naturalWidth || image_.width,
                height: image_.naturalHeight || image_.height,
                source: image_,
                close() { }
            };
        } finally {
            URL.revokeObjectURL(objectURL);
        }
    }
}

/**
 * Re-encodes an image blob into the requested format, optionally scaling it down
 * so its longest edge does not exceed maxDimension.
 *
 * @param {Blob} blob - Source image.
 * @param {object} options
 * @param {string} options.type - Target media type.
 * @param {number} options.quality - 0.1 - 1.0, ignored for lossless formats.
 * @param {number} options.maxDimension - Longest edge in px, 0 to keep the size.
 * @returns {Promise<Blob>} the re-encoded image.
 */
export async function transcodeImage(blob, { type, quality, maxDimension }) {
    // image/jpg is not a real media type, the canvas would silently produce a PNG.
    if (type == "image/jpg") {
        type = "image/jpeg";
    }

    let bitmap = await decode(blob);
    try {
        let { width, height } = scaledSize(bitmap.width, bitmap.height, maxDimension);

        let canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        let context = canvas.getContext("2d");

        // JPEG has no alpha channel, transparent areas would turn black.
        if (type == "image/jpeg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap.source ?? bitmap, 0, 0, width, height);

        return await toBlobAsync(
            canvas,
            type,
            LOSSY_IMAGE_FORMATS.has(type) ? quality : undefined
        );
    } finally {
        bitmap.close?.();
    }
}
