import * as clipboard from "./clipboard.mjs"

// Legacy: Inject menu into all already open compose windows, and into any new
//         compose window being opened.
// Note:   Can be removed once a proper context for the composer's attach menu
//         has been implemented (compose_attachment_area and compose_menu_attach).
let windows = await browser.windows.getAll({ windowTypes: ["messageCompose"] })
for (let window of windows) {
    await browser.AttachMenu.inject(window.id);
}
browser.windows.onCreated.addListener(async window => {
    if (window.type == "messageCompose") {
        await browser.AttachMenu.inject(window.id);
    }
});

messenger.commands.onCommand.addListener((name, tab) => {
    if (name == "insert_from_clipboard") {
        clipboard.insertFromClipboard(tab);
    }
})
messenger.AttachMenu.onClicked.addListener(tab => {
    clipboard.insertFromClipboard(tab);
});
