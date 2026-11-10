import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => {
  const settings = await import("@revolt/ui/components/design/Settings");
  return {
    SettingsSection: settings.SettingsSection,
    SettingsRow: settings.SettingsRow,
    Avatar: (props: { fallback?: string }) => (
      <span data-avatar>{props.fallback}</span>
    ),
    Button: (props: {
      children?: unknown;
      variant?: string;
      onPress?: () => void;
      isDisabled?: boolean;
    }) => (
      <button
        type="button"
        data-variant={props.variant}
        disabled={props.isDisabled}
        onClick={() => props.onPress?.()}
      >
        {props.children as never}
      </button>
    ),
    CircularProgress: () => <span data-loading />,
    Column: (props: { children?: unknown }) => (
      <div>{props.children as never}</div>
    ),
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span data-error>{String((props.error as Error)?.message)}</span>
  ),
}));
vi.mock("@zrzur/sdk/solid", () => ({
  File: class {
    createFileURL() {
      return "https://files.example/avatar.png";
    }
  },
}));
vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));

const api = vi.hoisted(() => ({
  authorized: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("../../channels/text/interactions/api", () => ({ oauthApi: api }));

import { ConnectedApps } from "./ConnectedApps";

let dispose: (() => void) | undefined;

function mount() {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ConnectedApps />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = () => document.body.textContent ?? "";
const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === name,
  );

const app = (id: string, name: string, scopes: string[]) => ({
  application: { _id: id, username: name.toLowerCase(), display_name: name },
  scopes,
  authorized_at: "2026-11-01T10:00:00.000Z",
});

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  api.authorized.mockReset();
  api.revoke.mockReset();
});
afterEach(() => dispose?.());

describe("connected apps", () => {
  it("lists each app with plain words for its scopes and the date", async () => {
    api.authorized.mockResolvedValue([
      app("A1", "Weather", ["identify", "servers.read"]),
      app("A2", "Helper", ["bot.install", "applications.commands"]),
    ]);
    mount();
    await flush();

    expect(text()).toContain("Weather");
    expect(text()).toContain("Helper");
    expect(text()).toContain("Know your username and avatar");
    expect(text()).toContain("See the names and icons of your servers");
    expect(text()).toContain("Add its bot to a server you manage");
    // raw scope ids are never shown
    expect(text()).not.toContain("servers.read");
    expect(text()).not.toContain("bot.install");
    expect(text()).toMatch(/Connected on .*2026/);
    expect(document.querySelectorAll("[data-avatar]")).toHaveLength(2);
  });

  it("shows an unknown scope as other access, not as its id", async () => {
    api.authorized.mockResolvedValue([app("A1", "Odd", ["files.write"])]);
    mount();
    await flush();
    expect(text()).toContain("Other access");
    expect(text()).not.toContain("files.write");
  });

  it("says plainly when nothing is connected", async () => {
    api.authorized.mockResolvedValue([]);
    mount();
    await flush();
    expect(text()).toContain("No apps are connected to your account.");
    expect(button("Revoke access")).toBeUndefined();
  });

  it("shows the error with a retry that loads again", async () => {
    api.authorized.mockRejectedValueOnce(new Error("NetworkError"));
    api.authorized.mockResolvedValueOnce([app("A1", "Weather", ["identify"])]);
    mount();
    await flush();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(text()).toContain("We could not load your connected apps.");
    expect(document.querySelector("[data-error]")?.textContent).toBe(
      "NetworkError",
    );

    button("Try again")!.click();
    await flush();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain("Weather");
  });

  it("asks in place before revoking, and Cancel keeps the app", async () => {
    api.authorized.mockResolvedValue([app("A1", "Weather", ["identify"])]);
    mount();
    await flush();

    button("Revoke access")!.click();
    expect(api.revoke).not.toHaveBeenCalled();
    expect(text()).toContain("Weather loses access to your account at once.");
    expect(button("Yes, revoke")!.dataset.variant).toBe("_error");

    button("Cancel")!.click();
    expect(button("Yes, revoke")).toBeUndefined();
    expect(button("Revoke access")).toBeDefined();
    expect(api.revoke).not.toHaveBeenCalled();
  });

  it("revokes after the confirm and removes the row", async () => {
    api.authorized.mockResolvedValue([
      app("A1", "Weather", ["identify"]),
      app("A2", "Helper", ["identify"]),
    ]);
    api.revoke.mockResolvedValue(undefined);
    mount();
    await flush();

    button("Revoke access")!.click();
    button("Yes, revoke")!.click();
    await flush();

    expect(api.revoke).toHaveBeenCalledWith(expect.anything(), "A1");
    expect(text()).not.toContain("Weather");
    expect(text()).toContain("Helper");
  });

  it("keeps the row and shows the error when revoking fails", async () => {
    api.authorized.mockResolvedValue([app("A1", "Weather", ["identify"])]);
    api.revoke.mockRejectedValue(new Error("NotFound"));
    mount();
    await flush();

    button("Revoke access")!.click();
    button("Yes, revoke")!.click();
    await flush();

    expect(text()).toContain("Weather");
    expect(text()).toContain("Access was not revoked.");
    expect(document.querySelector("[data-error]")?.textContent).toBe(
      "NotFound",
    );
  });
});
