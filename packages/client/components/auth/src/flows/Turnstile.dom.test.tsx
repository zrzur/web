import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Turnstile, { type TurnstileFunctions } from "./Turnstile";

// Cloudflare's script is replaced by a stand-in: the widget only needs
// render / execute / reset / remove, and an execute answers with a token.
let dispose: (() => void) | undefined;
let execute: ReturnType<typeof vi.fn>;

beforeEach(() => {
  execute = vi.fn(
    (_container: HTMLElement, options: { callback?: (t: string) => void }) => {
      options.callback?.("token-from-widget");
    },
  );
  (window as unknown as { turnstile: unknown }).turnstile = {
    render: vi.fn(() => "widget-1"),
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

describe("sign-up captcha (Cloudflare Turnstile)", () => {
  it("hands the form a token from the invisible widget", async () => {
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

    const answer = await instance!.execute();
    expect(answer).toEqual({ response: "token-from-widget" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("renders with the site key and no visible box", async () => {
    dispose = render(
      () => <Turnstile sitekey="site-key-public" onLoad={() => {}} />,
      document.body.firstElementChild as HTMLElement,
    );
    await vi.waitFor(() =>
      expect(
        (window as unknown as { turnstile: { render: ReturnType<typeof vi.fn> } })
          .turnstile.render,
      ).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ sitekey: "site-key-public", size: "invisible" }),
      ),
    );
  });
});
