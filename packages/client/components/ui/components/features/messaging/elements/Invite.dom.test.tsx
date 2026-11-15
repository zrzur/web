import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The invite card in chat: a server you can join, a server you are in, and
// an expired or unknown code, each in plain words with the right button.

const navigate = vi.fn();
const api = { get: vi.fn() };
const servers = new Map<string, { path: string }>();

vi.mock("@solidjs/router", () => ({ useNavigate: () => navigate }));
vi.mock("@revolt/client", () => ({
  useClient: () => () => ({ api, servers }),
}));
vi.mock("@revolt/modal", () => ({ useModals: () => ({ showError: vi.fn() }) }));
vi.mock("@revolt/ui/components/design", () => ({
  Avatar: () => <span data-avatar />,
  CircularProgress: () => <span data-progress />,
  Button: (props: {
    children: unknown;
    isDisabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={props.isDisabled} onClick={() => props.onPress?.()}>
      {props.children as never}
    </button>
  ),
}));
vi.mock("@zrzur/sdk/solid", () => {
  class PublicChannelInvite {
    static from(_client: unknown, invite: { type: string }) {
      return invite.type === "Server"
        ? new ServerPublicInvite(invite as never)
        : new PublicChannelInvite();
    }
  }
  class ServerPublicInvite extends PublicChannelInvite {
    serverId: string;
    serverName: string;
    memberCount: number;
    serverAccess = "Open";
    constructor(invite: {
      server_id: string;
      server_name: string;
      member_count: number;
    }) {
      super();
      this.serverId = invite.server_id;
      this.serverName = invite.server_name;
      this.memberCount = invite.member_count;
    }
    async join() {
      return { path: `/server/${this.serverId}` };
    }
  }
  class JoinRequestCreated extends Error {}
  return { PublicChannelInvite, ServerPublicInvite, JoinRequestCreated };
});

import { Invite } from "./Invite";

let dispose: (() => void) | undefined;

function setup() {
  document.body.innerHTML = '<div id="root"></div>';
  const queryClient = new QueryClient();
  dispose = render(
    () => (
      <QueryClientProvider client={queryClient}>
        <I18nProvider i18n={i18n}>
          <Invite code="Dm8w7T5p" />
        </I18nProvider>
      </QueryClientProvider>
    ),
    document.getElementById("root")!,
  );
  return document.querySelector<HTMLElement>("[data-invite-card]")!;
}

const settled = async (card: HTMLElement) => {
  for (let i = 0; i < 50 && card.dataset.state === "loading"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return card;
};

const server = {
  type: "Server",
  server_id: "S1",
  server_name: "Arab Gamers",
  member_count: 12,
};

beforeEach(() => {
  navigate.mockClear();
  api.get.mockReset();
  servers.clear();
  i18n.loadAndActivate({ locale: "en", messages: {} });
});
afterEach(() => dispose?.());

describe("Invite card", () => {
  it("shows the server, its members and Join; Join opens the server", async () => {
    api.get.mockResolvedValue(server);
    const card = await settled(setup());
    expect(card.dataset.state).toBe("join");
    expect(api.get).toHaveBeenCalledWith("/invites/Dm8w7T5p");
    expect(card.textContent).toContain("Arab Gamers");
    expect(card.textContent).toContain("12 members");
    card.querySelector("button")!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigate).toHaveBeenCalledWith("/server/S1");
  });

  it("a server you are in says so and opens it", async () => {
    api.get.mockResolvedValue(server);
    servers.set("S1", { path: "/server/S1" });
    const card = await settled(setup());
    expect(card.dataset.state).toBe("member");
    expect(card.textContent).toContain("You're a member");
    const button = card.querySelector("button")!;
    expect(button.textContent).toBe("Open server");
    button.click();
    expect(navigate).toHaveBeenCalledWith("/server/S1");
  });

  it("an expired or unknown invite says so, without a Join button", async () => {
    api.get.mockRejectedValue({ type: "NotFound" });
    const card = await settled(setup());
    expect(card.dataset.state).toBe("invalid");
    expect(card.textContent).toContain("Invalid invite");
    expect(card.textContent).toContain(
      "This invite has expired or doesn't exist.",
    );
    expect(card.querySelector("button")).toBeNull();
  });

  it("another kind of invite opens the invite page", async () => {
    api.get.mockResolvedValue({ type: "Group" });
    const card = await settled(setup());
    expect(card.dataset.state).toBe("other");
    card.querySelector("button")!.click();
    expect(navigate).toHaveBeenCalledWith("/invite/Dm8w7T5p");
  });
});
