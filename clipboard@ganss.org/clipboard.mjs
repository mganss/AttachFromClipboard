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

function getFileName(type) {
    switch (type) {
        case "image/png":
            return "document.png";
        case "image/jpeg":
        case "image/jpg":
            return "document.jpg"
        case "image/webp":
            return "document.webp"
        case "image/gif":
            return "document.gif"
        case "text/html":
            return "document.html"
        case "text/unicode":
        case "text/plain":
        default:
            return "document.txt"
    }
}

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
    let idx = types.map(type => flavours.indexOf(type)).sort()[0];
    if (idx == -1) {
        // None of the supported types is preferred, return the first supported one.
        return types[0];
    }
    return flavours[idx];
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

    for (let clipboardItem of clipboardItems) {
        const preferredSupportedType = await getPreferredSupportedType(clipboardItem.types);
        const blob = await clipboardItem.getType(preferredSupportedType);

        let file = new File([blob], getFileName(preferredSupportedType), {
            type: preferredSupportedType
        });
        if (file.size == 0) {
            return;
        }

        // Check if the current file is an image and if it is not yet in the desired format.
        if (preferredSupportedType.startsWith("image/")) {
            const preferredImageType = await getPreferredImageType();
            if (preferredImageType && preferredImageType != preferredSupportedType) {
                file = await convertFileToType(file, preferredImageType);
            }
        }

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

async function convertFileToType(file, type) {
    let objectURL = URL.createObjectURL(file)
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
    return new File([arrayBuffer], getFileName(type), { type });
};