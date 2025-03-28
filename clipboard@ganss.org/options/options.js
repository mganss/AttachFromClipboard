// Localize the document.
for (let element of document.querySelectorAll("[data-l10n-content]")) {
  element.textContent = browser.i18n.getMessage(element.getAttribute("data-l10n-content"));
}
for (let element of document.querySelectorAll("[data-l10n-title]")) {
  element.title = browser.i18n.getMessage(element.getAttribute("data-l10n-title"));
}
for (let element of document.querySelectorAll("[data-l10n-label]")) {
  element.label = browser.i18n.getMessage(element.getAttribute("data-l10n-label"));
}
const preferred_image_format_element = document.getElementById("preferred_image_format");

// Load Settings.
let { preferred_image_format } = await browser.storage.local.get({ preferred_image_format: null });
if (preferred_image_format) {
  document.getElementById("preferred_image_format").value = preferred_image_format;
}

// Enable auto-save.
preferred_image_format_element.addEventListener("change", e => {
  console.log(e)
  let v = e.target.value;
  if (v == "default") {
    browser.storage.local.remove("preferred_image_format");
  } else {
    browser.storage.local.set({ preferred_image_format: v });
  }
})