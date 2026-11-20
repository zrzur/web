import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { css } from "styled-system/css";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/client", () => ({
  useClient: () => () => ({
    channels: {
      get: () => ({
        path: "/server/S/channel/C",
        type: "TextChannel",
        displayName: "general",
        server: { name: "Lounge" },
      }),
    },
  }),
}));
vi.mock("@revolt/i18n", () => ({
  useTime: () => () => ({ format: () => "Nov 20, 2026" }),
}));
vi.mock("@revolt/markdown", () => ({
  Markdown: (props: { content: string }) => <span>{props.content}</span>,
}));
vi.mock("@revolt/routing", () => ({ useNavigate: () => () => {} }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));

import { ForwardedFrame } from "./ForwardedFrame";

let dispose: (() => void) | undefined;
afterEach(() => dispose?.());

describe("ForwardedFrame origin link", () => {
  it("keeps position: relative next to all: unset (phone tap area)", () => {
    i18n.loadAndActivate({ locale: "en", messages: {} });
    document.body.replaceChildren(document.createElement("div"));
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <ForwardedFrame
            origin={
              {
                channel: "C",
                message: "M",
                sent_at: "2026-11-20T10:00:00Z",
              } as never
            }
          >
            <p>copied text</p>
          </ForwardedFrame>
        </I18nProvider>
      ),
      document.body.firstElementChild as HTMLElement,
    );
    const link = document.querySelector<HTMLButtonElement>(
      '[data-testid="forwarded-origin"]',
    )!;
    expect(link).not.toBeNull();
    expect(link.classList.contains(css({ all: "unset" }))).toBe(true);
    expect(link.classList.contains(css({ position: "relative" }))).toBe(true);
  });
});
