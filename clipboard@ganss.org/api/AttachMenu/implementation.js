/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

// Using a closure to not leak anything but the API to the outside world.
(function (exports) {
  // Helper function to inject a legacy XUL string into the DOM of Thunderbird.
  // All injected elements will get the data attribute "data-extension-injected"
  // set to the extension id, for easy removal.
  const injectElements = function (extension, window, xulString, debug = false) {
    function checkElements(stringOfIDs) {
      let arrayOfIDs = stringOfIDs.split(",").map((e) => e.trim());
      for (let id of arrayOfIDs) {
        let element = window.document.getElementById(id);
        if (element) {
          return element;
        }
      }
      return null;
    }

    function localize(entity) {
      let msg = entity.slice("__MSG_".length, -2);
      return extension.localeData.localizeMessage(msg);
    }

    function injectChildren(elements, container) {
      if (debug) console.log(elements);

      for (let i = 0; i < elements.length; i++) {
        if (
          elements[i].hasAttribute("insertafter") &&
          checkElements(elements[i].getAttribute("insertafter"))
        ) {
          let insertAfterElement = checkElements(
            elements[i].getAttribute("insertafter")
          );

          if (debug)
            console.log(
              elements[i].tagName +
              "#" +
              elements[i].id +
              ": insertafter " +
              insertAfterElement.id
            );
          if (
            debug &&
            elements[i].id &&
            window.document.getElementById(elements[i].id)
          ) {
            console.error(
              "The id <" +
              elements[i].id +
              "> of the injected element already exists in the document!"
            );
          }
          elements[i].setAttribute("data-extension-injected", extension.id);
          insertAfterElement.parentNode.insertBefore(
            elements[i],
            insertAfterElement.nextSibling
          );
        } else if (
          elements[i].hasAttribute("insertbefore") &&
          checkElements(elements[i].getAttribute("insertbefore"))
        ) {
          let insertBeforeElement = checkElements(
            elements[i].getAttribute("insertbefore")
          );

          if (debug)
            console.log(
              elements[i].tagName +
              "#" +
              elements[i].id +
              ": insertbefore " +
              insertBeforeElement.id
            );
          if (
            debug &&
            elements[i].id &&
            window.document.getElementById(elements[i].id)
          ) {
            console.error(
              "The id <" +
              elements[i].id +
              "> of the injected element already exists in the document!"
            );
          }
          elements[i].setAttribute("data-extension-injected", extension.id);
          insertBeforeElement.parentNode.insertBefore(
            elements[i],
            insertBeforeElement
          );
        } else if (
          elements[i].id &&
          window.document.getElementById(elements[i].id)
        ) {
          // existing container match, dive into recursively
          if (debug)
            console.log(
              elements[i].tagName +
              "#" +
              elements[i].id +
              " is an existing container, injecting into " +
              elements[i].id
            );
          injectChildren(
            Array.from(elements[i].children),
            window.document.getElementById(elements[i].id)
          );
        } else {
          // append element to the current container
          if (debug)
            console.log(
              elements[i].tagName +
              "#" +
              elements[i].id +
              ": append to " +
              container.id
            );
          elements[i].setAttribute("data-extension-injected", extension.id);
          container.appendChild(elements[i]);
        }
      }
    }

    if (debug) console.log("Injecting into root document:");
    let localizedXulString = xulString.replace(
      /__MSG_(.*?)__/g,
      localize
    );
    injectChildren(
      Array.from(
        window.MozXULElement.parseXULToFragment(localizedXulString, []).children
      ),
      window.document.documentElement
    );
  };

  const emitter = new ExtensionCommon.EventEmitter();

  var AttachMenu = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
      return {
        AttachMenu: {
          async inject(windowId) {
            // Get the native window belonging to the specified windowId.
            let { window } = context.extension.windowManager.get(windowId);

            // Temporary Experiment until the proper context for the menus API has
            // been implemented.
            injectElements(context.extension, window, `
            <menupopup id="button-attachPopup">
              <menuitem id="button-attachPopup_clipboard" insertafter="button-attachPopup_attachPageItem"
                label="__MSG_attachFromClipboardAttachMenu.label__" accesskey="__MSG_attachFromClipboard.accesskey__" />
            </menupopup>
            <menupopup id="menu_AttachPopup">
              <menuitem id="menu_AttachPopup_clipboard"
                label="__MSG_attachFromClipboard.label__" accesskey="__MSG_attachFromClipboard.accesskey__" />
            </menupopup>
            <menupopup id="msgComposeAttachmentListContext">
              <menuitem id="msgComposeAttachmentListContext_clipboard" insertafter="attachmentListContext_attachPageItem"
                label="__MSG_attachFromClipboardContextMenu.label__" accesskey="__MSG_attachFromClipboard.accesskey__" />
            </menupopup>`);

            // Move entry to the correct location.
            let menu = window.document.getElementById("menu_AttachPopup");
            let fileMenuAttachPageEntry = Array.from(menu.children).find(c => c.getAttribute("command") == "cmd_attachPage");
            let fileMenuAttachClipboardEntry = menu.querySelector("#menu_AttachPopup_clipboard");
            menu.insertBefore(fileMenuAttachClipboardEntry, fileMenuAttachPageEntry.nextSibling);

            function eventHandler(e) {
              e.preventDefault();
              e.stopPropagation();
              emitter.emit("attach-menu-clicked", e.view);
            }

            // Add listeners to trigger the WebExtension events.
            window.document.getElementById("menu_AttachPopup_clipboard").addEventListener("command", eventHandler);
            window.document.getElementById("button-attachPopup_clipboard").addEventListener("command", eventHandler);
            window.document.getElementById("msgComposeAttachmentListContext_clipboard").addEventListener("command", eventHandler);

          },
          onClicked: new ExtensionCommon.EventManager({
            context,
            name: "AttachMenu.onClicked",
            register(fire) {
              const { extension } = context;
              const { tabManager, windowManager } = extension;

              function callback(event, window) {
                const win = windowManager.wrapWindow(window);
                const tab = tabManager.convert(win.activeTab.nativeTab);
                return fire.async(tab);
              }

              emitter.on("attach-menu-clicked", callback);
              return function () {
                emitter.off("attach-menu-clicked", callback);
              };
            },
          }).api(),
        },
      };
    }

    onShutdown(isAppShutdown) {
      if (isAppShutdown) {
        return; // the application gets unloaded anyway
      }

      const { extension } = this;
      for (const window of Services.wm.getEnumerator("msgcompose")) {
        if (window) {
          let elements = Array.from(
            window.document.querySelectorAll(
              '[data-extension-injected="' + extension.id + '"]'
            )
          );
          for (let element of elements) {
            element.remove();
          }
        }
      }
    }
  };
  exports.AttachMenu = AttachMenu;
})(this);