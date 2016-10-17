# Attach from clipboard in Thunderbird

Allows you to create file attachments directly from the system clipboard, making
it easy to attach screenshots without a detour into a graphics program. Works for HTML and plain text messages.

The following media types are supported:

* Images (png, jpg, gif), format is auto-selected according to the `clipboard.paste_image_type` preference (defaults to png)
* Files (e.g. by copying from Windows Explorer)
* HTML (e.g. by copying from a browser)
* Text
* URLs

The extension can be accessed through the following paths:

* File → Attach → From clipboard
* Attach toolbar button menu → From clipboard
* Context menu of attachments panel → Attach from clipboard

## Attach a screenshot (Windows)

1. Press <kbd>PrtSc</kbd> (full desktop, <kbd>Alt+PrtSc</kbd> for active window only)
2. Press <kbd>Alt+Shift+V</kbd> in compose message window in Thunderbird

## Temporary files

The extension will create temporary files in the system temp folder (usually `%LocalAppData%\Temp`). These are automatically removed when the compose message window is closed (i.e. when the message is sent or discarded).

## License

MIT<br>
Icon composed from icons by [icomoon](https://icomoon.io/) licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
