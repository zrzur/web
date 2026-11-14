import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", async () => {
  const settings = await import("@revolt/ui/components/design/Settings");
  return {
    SettingsSection: settings.SettingsSection,
    SettingsRow: settings.SettingsRow,
    Button: (props: {
      children?: unknown;
      onPress?: () => void;
      isDisabled?: boolean;
    }) => (
      <button
        type="button"
        disabled={props.isDisabled}
        onClick={() => props.onPress?.()}
      >
        {props.children as never}
      </button>
    ),
    Checkbox: (props: {
      children?: unknown;
      checked?: boolean;
      disabled?: boolean;
      onChange?: (event: { currentTarget: { checked: boolean } }) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(event) =>
            props.onChange?.({
              currentTarget: { checked: event.currentTarget.checked },
            })
          }
        />
        {props.children as never}
      </label>
    ),
    Toggle: (props: {
      checked: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        onClick={() => props.onChange?.(!props.checked)}
      />
    ),
  };
});
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/i18n/errors", () => ({
  TranslatedError: (props: { error: unknown }) => (
    <span data-error>{String((props.error as Error)?.message)}</span>
  ),
}));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ user: { id: "me" } }),
}));
const invalidate = vi.fn();
vi.mock("@tanstack/solid-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
}));

const api = vi.hoisted(() => ({
  start: vi.fn(),
  edit: vi.fn(),
  refresh: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("./serviceConnectionsApi", async (original) => ({
  ...(await original<typeof import("./serviceConnectionsApi")>()),
  serviceConnectionsApi: api,
}));

import { ServiceCards } from "./ServiceCards";
import type {
  ServiceAccount,
  ServiceConnection,
  ServiceId,
} from "./serviceConnectionsApi";

type Connections = Record<ServiceId, ServiceConnection | undefined>;

let dispose: (() => void) | undefined;

function mount(initial: Connections) {
  const [connections, setConnections] = createSignal(initial);
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ServiceCards
          connections={connections()}
          onChange={(service, account) =>
            setConnections((current) => ({
              ...current,
              [service]: { available: true, account },
            }))
          }
        />
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
  ) as HTMLButtonElement | undefined;

const DAY = 86_400_000;

const account = (
  service: ServiceId,
  change: Partial<ServiceAccount> = {},
): ServiceAccount => ({
  service,
  display_name:
    service === "battlenet" ? "Maher#21794" : service === "github" ? "maher-xs" : "MaherLive",
  profile_url:
    service === "github" ? "https://github.com/maher-xs" : service === "twitch" ? "https://www.twitch.tv/maherlive" : "",
  shown: false,
  linked_at: 1,
  refreshed_at: 1,
  refresh_after: 0,
  ...change,
});

const repos = [
  { id: 2, name: "popular", description: "Most stars", language: "Rust", stars: 120, url: "https://github.com/maher-xs/popular" },
  { id: 3, name: "middle", stars: 40, url: "https://github.com/maher-xs/middle" },
  { id: 1, name: "small", stars: 2, url: "https://github.com/maher-xs/small" },
];

const assign = vi.fn();

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
  Object.values(api).forEach((fn) => fn.mockReset());
  invalidate.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", {
    ...window.location,
    origin: "https://app.zrzur.com",
    assign,
  });
});
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
});

describe("ServiceCards", () => {
  it("asks for consent before leaving for each service", async () => {
    api.start.mockResolvedValue({ url: "https://id.twitch.tv/oauth2/authorize?x" });
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();

    expect(button("Connect Twitch")).toBeTruthy();
    expect(button("Connect GitHub")).toBeTruthy();
    expect(button("Connect Battle.net")).toBeTruthy();

    button("Connect Twitch")!.click();
    await flush();
    expect(text()).toContain("whether you are live now with the stream title");
    expect(text()).toContain("Zrzur never sees that password.");
    const go = button("Continue to Twitch")!;
    expect(go.disabled).toBe(true);

    document.querySelector<HTMLInputElement>("input[type=checkbox]")!.click();
    await flush();
    expect(go.disabled).toBe(false);
    go.click();
    await flush();
    expect(api.start).toHaveBeenCalledWith(
      expect.anything(),
      "twitch",
      "https://app.zrzur.com",
    );
    expect(assign).toHaveBeenCalledWith("https://id.twitch.tv/oauth2/authorize?x");
  });

  it("says so when a service is not configured on this server", async () => {
    mount({ twitch: { available: false }, github: undefined, battlenet: { available: true } });
    await flush();
    expect(text()).toContain("Twitch can't be linked on this server yet.");
    expect(text()).toContain("GitHub can't be linked on this server yet.");
    expect(button("Connect Twitch")).toBeUndefined();
    expect(button("Connect Battle.net")).toBeTruthy();
  });

  it("shows Twitch live status and switches it onto the profile", async () => {
    api.edit.mockImplementation(async (_c, service, change) =>
      account(service, { live: true, live_title: "Ranked nights", ...change }),
    );
    mount({
      twitch: {
        available: true,
        account: account("twitch", { live: true, live_title: "Ranked nights" }),
      },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();

    expect(text()).toContain("MaherLive");
    expect(text()).toContain("Live now");
    expect(text()).toContain("Ranked nights");
    expect(text()).toContain("This is a preview.");
    expect(button("Refresh")).toBeUndefined();

    document.querySelector<HTMLButtonElement>("[role=switch]")!.click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), "twitch", { shown: true });
    expect(text()).toContain("On your profile");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile", "me"] });
  });

  it("picks GitHub repositories and refreshes", async () => {
    api.edit.mockImplementation(async (_c, _s, change) =>
      account("github", { repos, shown_repos: [2, 3, 1], ...change }),
    );
    api.refresh.mockResolvedValue(account("github", { repos, shown_repos: [2] }));
    mount({
      twitch: { available: true },
      github: { available: true, account: account("github", { repos, shown_repos: [2, 3, 1] }) },
      battlenet: { available: true },
    });
    await flush();

    expect(text()).toContain("3 public repositories");
    expect(text()).toContain("Repositories to show (up to 6)");
    const boxes = document.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes).toHaveLength(3);
    boxes[1].click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), "github", {
      shown_repos: [2, 1],
    });

    button("Refresh")!.click();
    await flush();
    expect(api.refresh).toHaveBeenCalledWith(expect.anything(), "github");
  });

  it("counts Battle.net days and confirms on Battle.net", async () => {
    api.start.mockResolvedValue({ url: "https://oauth.battle.net/authorize?x" });
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: {
        available: true,
        account: account("battlenet", { shown: true, expires_at: Date.now() + 5 * DAY - 1000 }),
      },
    });
    await flush();
    expect(text()).toContain("Maher#21794");
    expect(text()).toContain("Confirm within 5 days");
    expect(text()).toContain("On your profile");

    button("Confirm on Battle.net")!.click();
    await flush();
    expect(api.start).toHaveBeenCalledWith(expect.anything(), "battlenet", "https://app.zrzur.com");
    expect(assign).toHaveBeenCalledWith("https://oauth.battle.net/authorize?x");
  });

  it("an expired BattleTag says it is hidden", async () => {
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: {
        available: true,
        account: account("battlenet", { shown: true, expires_at: Date.now() - 1 }),
      },
    });
    await flush();
    expect(text()).toContain("Hidden: confirm on Battle.net to show it again.");
    expect(text()).toContain("Not on your profile");
  });

  it("disconnects in one press and offers to connect again", async () => {
    api.disconnect.mockResolvedValue(undefined);
    mount({
      twitch: { available: true, account: account("twitch") },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    button("Disconnect")!.click();
    await flush();
    expect(api.disconnect).toHaveBeenCalledWith(expect.anything(), "twitch");
    expect(button("Connect Twitch")).toBeTruthy();
    expect(text()).not.toContain("MaherLive");
  });

  it("shows the error in plain words when something fails", async () => {
    api.edit.mockRejectedValue(new Error("LinkedServiceFailed"));
    mount({
      twitch: { available: true, account: account("twitch") },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    document.querySelector<HTMLButtonElement>("[role=switch]")!.click();
    await flush();
    expect(text()).toContain("That did not work.");
    expect(document.querySelector("[data-error]")?.textContent).toBe("LinkedServiceFailed");
  });
});
