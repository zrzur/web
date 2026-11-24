import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/client", () => ({ useClient: () => () => ({}) }));
vi.mock("@revolt/ui", () => ({ Avatar: () => <span data-avatar-img /> }));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("./Art", () => ({ ListingArt: () => <span data-art /> }));
// the seal beside a name, and the bot label, as plain markers
vi.mock("@revolt/ui/components/features/profiles/badges/BadgeMark", () => ({
  BadgeMark: (props: { id: string }) => <span data-seal={props.id} />,
}));
vi.mock("@revolt/ui/components/features/profiles/BotLabel", () => ({
  BotLabel: (props: { verified?: boolean; official?: boolean }) => (
    <span
      data-bot-label
      data-verified={String(!!props.verified)}
      data-official={String(!!props.official)}
    />
  ),
}));

import { Listing, ListingCard } from "./Cards";

let dispose: (() => void) | undefined;

const listing = (extra: Partial<Listing>): Listing => ({
  kind: "bots",
  id: "01KBOTBOTBOTBOTBOTBOTBOTBO",
  name: "Helper",
  verified: false,
  featured: false,
  tags: [],
  count: 30,
  ...extra,
});

function show(item: Listing) {
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ListingCard listing={item} />
      </I18nProvider>
    ),
    document.body.firstElementChild as HTMLElement,
  );
}

const seals = () =>
  [...document.querySelectorAll("[data-seal]")].map((el) =>
    el.getAttribute("data-seal"),
  );
const label = () => document.querySelector("[data-bot-label]");

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = "<div></div>";
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

describe("Discover bot card", () => {
  it("shows a verified bot's check in its Bot label, with no seal", () => {
    show(listing({ verified: true }));
    expect(seals()).toEqual([]);
    expect(label()?.getAttribute("data-verified")).toBe("true");
  });

  it("never gives an official bot that is not verified a verified mark", () => {
    show(listing({ verified: false, official: true }));
    expect(seals()).toEqual([]);
    expect(label()?.getAttribute("data-verified")).toBe("false");
    expect(label()?.getAttribute("data-official")).toBe("true");
  });

  it("shows a plain bot with a plain label", () => {
    show(listing({}));
    expect(seals()).toEqual([]);
    expect(label()?.getAttribute("data-verified")).toBe("false");
  });

  it("still gives a verified server its seal", () => {
    show(listing({ kind: "servers", verified: true }));
    expect(seals()).toEqual(["server_verified"]);
    expect(label()).toBeNull();
  });
});
