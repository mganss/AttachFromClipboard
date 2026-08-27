import {
  KEEP_ORIGINAL,
  LOSSY_IMAGE_FORMATS,
  TARGET_IMAGE_FORMATS,
  clampMaxDimension,
  clampQuality,
  getSettings
} from "../settings.mjs";
import { canEncode } from "../images.mjs";

const FORMAT_LABELS = {
  "image/jpeg": "JPEG (.jpg)",
  "image/webp": "WebP (.webp)",
  "image/avif": "AVIF / AV1 (.avif)",
  "image/png": "PNG (.png)"
};

const elements = {};
for (let id of [
  "imageFormat", "imageQuality", "imageQualityValue", "qualityRow", "qualityHint",
  "maxDimension", "unsupportedHint"
]) {
  elements[id] = document.getElementById(id);
}

function localize() {
  for (let element of document.querySelectorAll("[data-l10n-content]")) {
    element.textContent = browser.i18n.getMessage(element.getAttribute("data-l10n-content"));
  }
  for (let element of document.querySelectorAll("[data-l10n-title]")) {
    element.title = browser.i18n.getMessage(element.getAttribute("data-l10n-title"));
  }
}

/**
 * Fills the format dropdown, leaving out formats this Thunderbird build has no
 * encoder for instead of silently producing a PNG in disguise.
 */
function buildFormatOptions() {
  let unsupported = [];

  let keepOriginal = new Option(browser.i18n.getMessage("keepOriginalFormat"), KEEP_ORIGINAL);
  elements.imageFormat.add(keepOriginal);

  for (let type of TARGET_IMAGE_FORMATS) {
    if (canEncode(type)) {
      elements.imageFormat.add(new Option(FORMAT_LABELS[type] ?? type, type));
    } else {
      unsupported.push(FORMAT_LABELS[type] ?? type);
    }
  }

  if (unsupported.length) {
    elements.unsupportedHint.textContent =
      browser.i18n.getMessage("unsupportedFormats", unsupported.join(", "));
    elements.unsupportedHint.hidden = false;
  }

  return unsupported;
}

function updateQualityVisibility() {
  let lossy = LOSSY_IMAGE_FORMATS.has(elements.imageFormat.value);
  elements.qualityRow.hidden = !lossy;
  elements.qualityHint.hidden = !lossy;
}

function updateQualityLabel() {
  elements.imageQualityValue.textContent = `${elements.imageQuality.value} %`;
}

async function save(values) {
  await browser.storage.local.set(values);
}

let settings = await getSettings();
localize();
buildFormatOptions();

// If the stored format has no encoder here, the select falls back to its first
// entry; persist that so the background script and the UI agree.
elements.imageFormat.value = settings.imageFormat;
if (!elements.imageFormat.value) {
  elements.imageFormat.value = KEEP_ORIGINAL;
  await save({ imageFormat: KEEP_ORIGINAL });
}
elements.imageQuality.value = Math.round(settings.imageQuality * 100);
elements.maxDimension.value = settings.maxDimension || 0;

updateQualityLabel();
updateQualityVisibility();

elements.imageFormat.addEventListener("change", async event => {
  await save({ imageFormat: event.target.value });
  updateQualityVisibility();
});

elements.imageQuality.addEventListener("input", () => {
  updateQualityLabel();
});
elements.imageQuality.addEventListener("change", async event => {
  await save({ imageQuality: clampQuality(Number(event.target.value) / 100) });
});

elements.maxDimension.addEventListener("change", async event => {
  let value = clampMaxDimension(event.target.value);
  event.target.value = value;
  await save({ maxDimension: value });
});
