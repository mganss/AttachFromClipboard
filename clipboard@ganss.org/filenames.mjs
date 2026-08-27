/**
 * Generation of unique attachment file names.
 */

export const DEFAULT_PREFIX = "clipboard";

/**
 * counter   - clipboard-1.png, numbered per message
 * timestamp - clipboard-20260827-143045.png
 */
export const FILENAME_SCHEMES = ["counter", "timestamp"];
export const DEFAULT_SCHEME = "counter";

const EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "text/html": "html",
    "text/unicode": "txt",
    "text/plain": "txt"
};

export function getExtension(type) {
    return EXTENSIONS[type] ?? "txt";
}

/**
 * Strips everything from a user supplied file name prefix that has no business
 * being in a file name.
 */
export function sanitizePrefix(value) {
    let prefix = String(value ?? "")
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .trim();
    return prefix || DEFAULT_PREFIX;
}

function pad(value) {
    return String(value).padStart(2, "0");
}

/**
 * @param {Date} date
 * @returns {string} a sortable, file name safe stamp, e.g. "20260827-143045".
 */
export function formatTimestamp(date) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("") + "-" + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join("");
}

/**
 * Builds a file name that is not yet present in takenNames.
 *
 * With the "counter" scheme the name is the prefix plus the lowest free number,
 * with "timestamp" it is the prefix plus a date/time stamp, which only grows a
 * number when the same second is hit twice. Either way the name is guaranteed
 * not to collide with an attachment already in the message.
 *
 * @param {object} options
 * @param {string} options.prefix - Sanitized file name prefix.
 * @param {string} options.scheme - One of FILENAME_SCHEMES.
 * @param {string} options.extension - File name extension without the dot.
 * @param {Set<string>} options.takenNames - Names already in use, lower cased.
 * @param {Date} [options.date] - Point in time for the stamp, defaults to now.
 * @returns {string} the unique file name; it is added to takenNames.
 */
export function buildUniqueName({ prefix, scheme, extension, takenNames, date = new Date() }) {
    const timestamp = scheme == "timestamp";
    const stamp = timestamp ? `-${formatTimestamp(date)}` : "";

    for (let counter = 1; ; counter++) {
        // With a time stamp the first candidate carries no number, without one
        // the number is the only thing making the name unique.
        let discriminator = timestamp
            ? (counter == 1 ? "" : `-${counter}`)
            : `-${counter}`;
        let name = `${prefix}${stamp}${discriminator}.${extension}`;
        if (!takenNames.has(name.toLowerCase())) {
            takenNames.add(name.toLowerCase());
            return name;
        }
    }
}

/**
 * Reads the file name settings, falling back to the defaults.
 */
export async function getFileNameSettings() {
    let { filename_prefix, filename_scheme } = await browser.storage.local.get({
        filename_prefix: DEFAULT_PREFIX,
        filename_scheme: DEFAULT_SCHEME
    });
    return {
        prefix: sanitizePrefix(filename_prefix),
        scheme: FILENAME_SCHEMES.includes(filename_scheme) ? filename_scheme : DEFAULT_SCHEME
    };
}
