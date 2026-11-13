import { onCleanup, onMount } from "solid-js";

/**
 * Cloudflare Turnstile, run on submit: the form asks for a token when it
 * submits. The check runs in the background ("execute" mode) and shows a box
 * only when Cloudflare needs the person to click ("interaction-only").
 * Turnstile has no "invisible" size: that is a widget mode set in the
 * Cloudflare dashboard, and the size parameter refuses it.
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
      execution: "execute";
      appearance: "interaction-only";
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
    },
  ) => string;
  execute: (widget: string) => void;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
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

type Pending = {
  resolve: (value: { response: string }) => void;
  reject: (reason: { type: "CaptchaFailed" }) => void;
};

export default function Turnstile(props: {
  sitekey: string;
  onLoad: (instance: TurnstileFunctions) => void;
}) {
  let box: HTMLDivElement | undefined;
  let widget: string | undefined;
  let pending: Pending | undefined;
  let alive = true;

  const fail = () => {
    pending?.reject({ type: "CaptchaFailed" });
    pending = undefined;
  };

  onCleanup(() => {
    alive = false;
    fail();
    if (widget !== undefined && window.turnstile)
      window.turnstile.remove(widget);
  });

  onMount(() => {
    loadScript()
      .then(() => {
        if (!alive || !box || !window.turnstile) return;
        const api = window.turnstile;
        // the answer of each run comes to the callbacks given here
        const id = api.render(box, {
          sitekey: props.sitekey,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token) => {
            pending?.resolve({ response: token });
            pending = undefined;
          },
          "error-callback": fail,
          "expired-callback": fail,
        });
        widget = id;
        props.onLoad({
          execute: () =>
            new Promise((resolve, reject) => {
              // a run still waiting is replaced by the new one
              fail();
              pending = { resolve, reject };
              api.reset(id);
              api.execute(id);
            }),
        });
      })
      .catch(() => {
        // the form shows "captcha failed" when it submits without an instance
      });
  });

  // empty until Cloudflare needs a click; then its box shows here
  return <div ref={box} class="zrzur-turnstile" />;
}
