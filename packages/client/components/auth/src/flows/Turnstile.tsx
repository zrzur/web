import { onCleanup, onMount } from "solid-js";

/**
 * Cloudflare Turnstile, invisible: the form asks for a token when it submits.
 * The script loads only on the forms that use it (sign-up, reset, resend).
 * Each token works once; the widget starts fresh for every submit.
 */

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size: "invisible";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  execute: (
    container: HTMLElement,
    options?: { callback?: (token: string) => void; "error-callback"?: () => void },
  ) => void;
  reset: (container: HTMLElement) => void;
  remove: (container: HTMLElement) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** What the form calls to get a token: resolves with the response */
export type TurnstileFunctions = {
  execute: () => Promise<{ response: string }>;
};

let loading: Promise<void> | undefined;

/** Load Cloudflare's script once; rejects when it cannot be reached */
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(new Error("turnstile script blocked"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export default function Turnstile(props: {
  sitekey: string;
  onLoad: (instance: TurnstileFunctions) => void;
}) {
  let box: HTMLDivElement | undefined;
  let alive = true;
  onCleanup(() => {
    alive = false;
    if (box && window.turnstile) window.turnstile.remove(box);
  });

  onMount(() => {
    loadScript()
      .then(() => {
        if (!alive || !box || !window.turnstile) return;
        const api = window.turnstile;
        const container = box;
        api.render(container, { sitekey: props.sitekey, size: "invisible" });
        props.onLoad({
          execute: () =>
            new Promise((resolve, reject) => {
              api.reset(container);
              api.execute(container, {
                callback: (token) => resolve({ response: token }),
                "error-callback": () => reject({ type: "CaptchaFailed" }),
              });
            }),
        });
      })
      .catch(() => {
        // the form shows "captcha failed" when it submits without an instance
      });
  });

  return <div ref={box} aria-hidden="true" style={{ display: "none" }} />;
}
