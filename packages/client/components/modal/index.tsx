import { For, JSXElement, Show, createContext, useContext } from "solid-js";

import type { MFA, MFATicket } from "@zrzur/sdk/solid";

import { Keybind, KeybindAction } from "@revolt/keybinds";
import { dismissFloatingElements } from "@revolt/ui";

import { ModalController } from "./controller";
import { RenderModal } from "./modals";

export { type ActiveModal, ModalController } from "./controller";

/**
 * Modal controller with additional helpers.
 */
export class ModalControllerExtended extends ModalController {
  /**
   * Construct controller
   */
  constructor() {
    super();
    this.onOpen = dismissFloatingElements;

    this.mfaFlow = this.mfaFlow.bind(this);
    this.mfaEnableTOTP = this.mfaEnableTOTP.bind(this);
    this.showError = this.showError.bind(this);
    this.openLink = this.openLink.bind(this);
  }

  /**
   * Perform MFA flow
   * @param mfa MFA helper
   */
  mfaFlow(mfa: MFA) {
    return new Promise((callback: (ticket?: MFATicket) => void) =>
      this.openModal({
        type: "mfa_flow",
        state: "known",
        mfa,
        callback,
      }),
    );
  }

  /**
   * Open TOTP secret modal
   *
   * The modal stays open until the code is accepted or the user backs out, so
   * a rejected code can be reported without the dialog closing underneath it.
   * @param secret Secret to display
   * @param identifier Account identifier shown in the authenticator app
   * @param enable Called with the entered code, should throw if it is rejected
   * @returns Whether the authenticator was enabled
   */
  mfaEnableTOTP(
    secret: string,
    identifier: string,
    enable: (code: string) => Promise<void>,
  ) {
    return new Promise((resolve: (value: boolean) => void, reject) =>
      this.openModal({
        type: "mfa_enable_totp",
        identifier,
        secret,
        async callback(code) {
          if (!code) return resolve(false);
          await enable(code);
          resolve(true);
        },
        reject,
      }),
    );
  }

  /**
   * Show any error
   * @param error Error
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showError(error: any) {
    this.openModal({
      type: "error2",
      error,
    });
  }

  /**
   * Write text to the clipboard
   * @param text Text to write
   * @deprecated use navigator clipboard directly
   */
  writeText(text: string) {
    navigator.clipboard.writeText(text);
  }

  /**
   * Safely open external or internal link
   * @param href Raw URL
   * @param trusted Whether we trust this link
   * @returns Whether to cancel default event
   */
  openLink(/*href?: string, trusted?: boolean*/) {
    /*const link = determineLink(href);
    const settings = getApplicationState().settings;

    switch (link.type) {
      case "navigate": {
        history.push(link.path);
        break;
      }
      case "external": {
        if (!trusted && !settings.security.isTrustedOrigin(link.url.hostname)) {
          modalController.push({
            type: "link_warning",
            link: link.href,
            callback: () => this.openLink(href, true) as true,
          });
        } else {
          window.open(link.href, "_blank", "noreferrer");
        }
      }
    }*/

    return true;
  }
}

const ModalControllerContext = createContext<ModalControllerExtended>(
  null as unknown as ModalControllerExtended,
);

/**
 * Mount the modal controller
 */
export function ModalContext(props: { children: JSXElement }) {
  const controller = new ModalControllerExtended();

  return (
    <ModalControllerContext.Provider value={controller}>
      {props.children}
    </ModalControllerContext.Provider>
  );
}

/**
 * Use the modal controller
 */
export function useModals() {
  return useContext(ModalControllerContext);
}

/**
 * Render modals
 */
export function ModalRenderer() {
  const modalController = useModals();

  return (
    <>
      <For each={modalController.modals}>
        {(entry) => (
          <RenderModal
            {...entry}
            onClose={() => modalController.remove(entry.id)}
          />
        )}
      </For>
      <Show when={modalController.isOpen()}>
        <Keybind
          keybind={KeybindAction.CLOSE_MODAL}
          onPressed={() => modalController.pop()}
        />
      </Show>
    </>
  );
}
