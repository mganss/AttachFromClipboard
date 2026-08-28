import { buildUniqueName, getExtension, sanitizePrefix } from "../filenames.mjs";

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
preferred_image_format_element.addEventListener("change", event => {
  let value = event.target.value;
  if (value == "default") {
    browser.storage.local.remove("preferred_image_format");
  } else {
    browser.storage.local.set({ preferred_image_format: value });
  }
  updatePreview();
})

const filename_prefix_element = document.getElementById("filename_prefix");
const filename_scheme_element = document.getElementById("filename_scheme");

let { filename_prefix, filename_scheme } = await browser.storage.local.get({
  filename_prefix: "clipboard",
  filename_scheme: "counter"
});
filename_prefix_element.value = filename_prefix;
filename_scheme_element.value = filename_scheme;

// Show what the next attachment would be called.
function updatePreview() {
  let format = preferred_image_format_element.value;
  let extension = format == "default" ? "png" : getExtension(format);
  document.getElementById("filename_preview").textContent = buildUniqueName({
    prefix: sanitizePrefix(filename_prefix_element.value),
    scheme: filename_scheme_element.value,
    extension,
    takenNames: new Set()
  });
}
updatePreview();

filename_prefix_element.addEventListener("input", updatePreview);
filename_prefix_element.addEventListener("change", event => {
  let value = sanitizePrefix(event.target.value);
  event.target.value = value;
  browser.storage.local.set({ filename_prefix: value });
  updatePreview();
})

filename_scheme_element.addEventListener("change", event => {
  browser.storage.local.set({ filename_scheme: event.target.value });
  updatePreview();
})