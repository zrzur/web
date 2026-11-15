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
    expect(text()).toContain("We give Twitch your channel id");
    expect(text()).toContain("This ties your Twitch account to your Zrzur account.");
    const policy = [...document.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Privacy Policy"),
    );
    expect(policy?.getAttribute("href")).toBe(
      "https://zrzur.com/legal/privacy#linked-accounts",
    );
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

  it("an expired BattleTag is not on the profile", async () => {
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: {
        available: true,
        account: account("battlenet", { shown: true, expires_at: Date.now() - 1 }),
      },
    });
    await flush();
    expect(text()).toContain("Not on your profile");
    expect(text()).toContain("Confirm within 0 days");
  });

  it("a Twitch copy blanked after a day waits for Twitch", async () => {
    mount({
      twitch: { available: true, account: account("twitch", { display_name: "", profile_url: "" }) },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    expect(text()).toContain("Waiting for Twitch");
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

  it("each consent card names the US transfer and what the copy may reveal", async () => {
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    for (const name of ["Twitch", "GitHub", "Battle.net"]) {
      button(`Connect ${name}`)!.click();
      await flush();
      const card = document.querySelector<HTMLElement>("[role=group]")!;
      const transfer = `${name} is a US company: what we send it and read from it goes to the United States, where your data may be less protected than in the EU (for example, US authorities may be able to access it).`;
      // GitHub is under the Data Privacy Framework: no US-company sentence
      if (name === "GitHub") expect(card.textContent).not.toContain("is a US company");
      else expect(card.textContent).toContain(transfer);
      expect(card.textContent).toContain(
        "What you play or post there can say something about your beliefs, health or sexuality.",
      );
      expect(card.querySelector("label")!.textContent).toBe(
        `I agree that Zrzur copies this and shows it on my profile, including anything it may reveal about me, and exchanges this data with ${name} in the United States.`,
      );
      button("Not now")!.click();
      await flush();
    }
  });

  it("a Twitch link from before asks once, and is off the profile until then", async () => {
    api.edit.mockImplementation(async (_c, service, change) =>
      account(service, { shown: true, consent_current: change.consent === 3 }),
    );
    mount({
      twitch: {
        available: true,
        account: account("twitch", { shown: true, consent_current: false }),
      },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    expect(text()).toContain("Updated consent for Twitch");
    expect(text()).toContain("Until you agree, your channel does not show");
    expect(text()).toContain("Twitch is a US company");
    expect(text()).toContain("Not on your profile");

    const save = button("Save")!;
    expect(save.disabled).toBe(true);
    [...document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")]
      .find((box) => box.closest("label")?.textContent?.includes("Twitch in the United States"))!
      .click();
    await flush();
    expect(save.disabled).toBe(false);
    save.click();
    await flush();
    expect(api.edit).toHaveBeenCalledWith(expect.anything(), "twitch", { consent: 3 });
    expect(text()).not.toContain("Updated consent for Twitch");
    expect(text()).toContain("On your profile");
  });

  it("GitHub Refresh before agreeing shows the new text instead", async () => {
    mount({
      twitch: { available: true },
      github: {
        available: true,
        account: account("github", { repos, shown_repos: [2], consent_current: false }),
      },
      battlenet: { available: true },
    });
    await flush();
    expect(text()).toContain(
      "Until you agree, your GitHub account does not show on your profile and Refresh stays off.",
    );
    button("Not now")!.click();
    await flush();
    expect(text()).not.toContain("Updated consent for GitHub");
    button("Refresh")!.click();
    await flush();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(text()).toContain("Updated consent for GitHub");
  });

  it("Battle.net shows the new text at the next Confirm", async () => {
    api.start.mockResolvedValue({ url: "https://oauth.battle.net/authorize?x" });
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: {
        available: true,
        account: account("battlenet", {
          shown: true,
          consent_current: false,
          expires_at: Date.now() + 5 * DAY,
        }),
      },
    });
    await flush();
    button("Not now")!.click();
    await flush();
    button("Confirm on Battle.net")!.click();
    await flush();
    expect(api.start).not.toHaveBeenCalled();
    expect(text()).toContain("You agree to it the next time you confirm on Battle.net.");
    expect(text()).toContain("Battle.net is a US company");

    const go = button("Continue to Battle.net")!;
    expect(go.disabled).toBe(true);
    [...document.querySelectorAll<HTMLInputElement>("input[type=checkbox]")]
      .find((box) => box.closest("label")?.textContent?.includes("Battle.net in the United States"))!
      .click();
    await flush();
    go.click();
    await flush();
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.start).toHaveBeenCalledWith(expect.anything(), "battlenet", "https://app.zrzur.com");
  });

  it("a sign-in page that never opens gives the button back with what to do", async () => {
    api.start.mockResolvedValue({ url: "https://id.twitch.tv/oauth2/authorize?x" });
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: { available: true },
    });
    await flush();
    button("Connect Twitch")!.click();
    await flush();
    document.querySelector<HTMLInputElement>("input[type=checkbox]")!.click();
    await flush();

    // the desktop app blocks the navigation: the page stays
    vi.useFakeTimers();
    try {
      button("Continue to Twitch")!.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(assign).toHaveBeenCalledWith("https://id.twitch.tv/oauth2/authorize?x");
      expect(button("Continue to Twitch")!.disabled).toBe(true);
      expect(text()).not.toContain("sign-in page did not open");

      await vi.advanceTimersByTimeAsync(4000);
      expect(button("Continue to Twitch")!.disabled).toBe(false);
      const alert = [...document.querySelectorAll("[role=alert]")].find((el) =>
        el.textContent?.includes("Twitch's sign-in page did not open."),
      );
      expect(alert?.textContent).toContain(
        "If you use the Zrzur desktop app, install the latest version from zrzur.com/download, then try again.",
      );
      expect(alert?.querySelector("a")?.getAttribute("href")).toBe(
        "https://zrzur.com/download",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("Confirm on Battle.net that never opens gives the button back too", async () => {
    api.start.mockResolvedValue({ url: "https://oauth.battle.net/authorize?x" });
    mount({
      twitch: { available: true },
      github: { available: true },
      battlenet: {
        available: true,
        account: account("battlenet", { shown: true, expires_at: Date.now() + 5 * DAY }),
      },
    });
    await flush();
    vi.useFakeTimers();
    try {
      button("Confirm on Battle.net")!.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button("Confirm on Battle.net")!.disabled).toBe(true);
      await vi.advanceTimersByTimeAsync(4000);
      expect(button("Confirm on Battle.net")!.disabled).toBe(false);
      expect(text()).toContain("Battle.net's sign-in page did not open.");
    } finally {
      vi.useRealTimers();
    }
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
