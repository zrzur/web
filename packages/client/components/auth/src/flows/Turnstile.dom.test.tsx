import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Turnstile, { type TurnstileFunctions } from "./Turnstile";

// Cloudflare's script is replaced by a stand-in that behaves like the real
// one: render keeps the callbacks, execute runs the check and answers through
// them, and Turnstile refuses size "invisible" (it threw in production).
type Options = {
  sitekey: string;
  size?: string;
  execution?: string;
  appearance?: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
};

let dispose: (() => void) | undefined;
let options: Options | undefined;
let answer: "token" | "error";
let render_: ReturnType<typeof vi.fn>;
let execute: ReturnType<typeof vi.fn>;

beforeEach(() => {
  options = undefined;
  answer = "token";
  render_ = vi.fn((_container: HTMLElement, given: Options) => {
    if (
      given.size !== undefined &&
      !["compact", "flexible", "normal"].includes(given.size)
    )
      throw new Error(
        `Invalid value for parameter "size", got "${given.size}"`,
      );
    options = given;
    return "widget-1";
  });
  execute = vi.fn(() => {
    if (answer === "token") options?.callback?.("token-from-widget");
    else options?.["error-callback"]?.();
  });
  (window as unknown as { turnstile: unknown }).turnstile = {
    render: render_,
    execute,
    reset: vi.fn(),
    remove: vi.fn(),
  };
  document.body.replaceChildren(document.createElement("div"));
});

afterEach(() => {
  dispose?.();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

async function mount() {
  let instance: TurnstileFunctions | undefined;
  dispose = render(
    () => (
      <Turnstile
        sitekey="site-key-public"
        onLoad={(value) => (instance = value)}
      />
    ),
    document.body.firstElementChild as HTMLElement,
  );
  await vi.waitFor(() => expect(instance).toBeDefined());
  return instance!;
}

describe("sign-up captcha (Cloudflare Turnstile)", () => {
  it("hands the form a token from the check run on submit", async () => {
    const instance = await mount();
    expect(await instance.execute()).toEqual({ response: "token-from-widget" });
    expect(execute).toHaveBeenCalledWith("widget-1");
  });

  it("renders with options Turnstile accepts: run on submit, box only when a click is needed", async () => {
    await mount();
    expect(render_).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        sitekey: "site-key-public",
        execution: "execute",
        appearance: "interaction-only",
      }),
    );
    expect(options?.size).toBeUndefined();
  });

  it("a failed check reaches the form as CaptchaFailed", async () => {
    const instance = await mount();
    answer = "error";
    await expect(instance.execute()).rejects.toEqual({ type: "CaptchaFailed" });
  });

  it("every submit gets a fresh token", async () => {
    const instance = await mount();
    await instance.execute();
    await instance.execute();
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
