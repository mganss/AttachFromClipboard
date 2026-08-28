/**
 * Central place for the add-on's settings, their defaults and the migration of
 * settings written by older versions of the add-on.
 */

/** Image format identifier meaning "do not convert, keep what the clipboard offers". */
export const KEEP_ORIGINAL = "original";

/** Image formats the user may pick as target format, in the order shown in the UI. */
export const TARGET_IMAGE_FORMATS = [
    "image/jpeg",
    "image/webp",
    "image/avif",
    "image/png"
];

/** Formats whose encoder honours the quality parameter of canvas.toBlob(). */
export const LOSSY_IMAGE_FORMATS = new Set([
    "image/jpeg",
    "image/webp",
    "image/avif"
]);

export const DEFAULTS = {
    // Target format for images taken from the clipboard, or KEEP_ORIGINAL.
    imageFormat: KEEP_ORIGINAL,
    // Encoder quality for lossy formats, 0.1 - 1.0.
    imageQuality: 0.82,
    // Longest edge in pixels the image is scaled down to, 0 disables scaling.
    maxDimension: 0
};

export function clampQuality(value) {
    let quality = Number(value);
    if (!Number.isFinite(quality)) {
        return DEFAULTS.imageQuality;
    }
    return Math.min(1, Math.max(0.1, quality));
}

export function clampMaxDimension(value) {
    let dimension = Math.round(Number(value));
    if (!Number.isFinite(dimension) || dimension <= 0) {
        return 0;
    }
    return Math.min(20000, Math.max(16, dimension));
}

/**
 * Reads all settings, applying defaults and migrating the "preferred_image_format"
 * key used up to version 2.2.
 */
export async function getSettings() {
    let stored = await browser.storage.local.get(null);

    if (stored.imageFormat === undefined && stored.preferred_image_format) {
        stored.imageFormat = stored.preferred_image_format;
    }

    return {
        imageFormat: TARGET_IMAGE_FORMATS.includes(stored.imageFormat)
            ? stored.imageFormat
            : KEEP_ORIGINAL,
        imageQuality: stored.imageQuality === undefined
            ? DEFAULTS.imageQuality
            : clampQuality(stored.imageQuality),
        maxDimension: clampMaxDimension(stored.maxDimension)
    };
}
