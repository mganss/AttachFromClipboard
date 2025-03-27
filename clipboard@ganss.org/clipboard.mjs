const FLAVOURS = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "text/html",
    "text/unicode",
    "text/plain"
].filter(ClipboardItem.supports)

function getPreferredType(types) {

    let idx = types.map(t => FLAVOURS.indexOf(t)).sort()[0];
    if (idx == -1) {
        // None of the available types is in FLAVOURS, return the first available one.
        return types[0];
    }

    // Return the preferred flavour.
    return FLAVOURS[idx];
}

function getFileName(type) {
    switch (type) {
        case "image/png":
            return "document.png";
        case "image/jpeg":
        case "image/jpg":
            return "document.png"
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

export async function insertFromClipboard(tab) {
    if (tab.type != "messageCompose") {
        return;
    }

    let clipboardItems = await navigator.clipboard.read({ unsanitized: FLAVOURS });
    if (clipboardItems.length == 0) {
        return;
    }

    for (let clipboardItem of clipboardItems) {
        let type = getPreferredType(clipboardItem.types);
        let blob = await clipboardItem.getType(type);
        const file = new File([blob], getFileName(type), { type });
        await browser.compose.addAttachment(tab.id, { file })
    }
};
