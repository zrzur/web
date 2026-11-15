import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@revolt/ui", () => ({
  Button: (props: {
    children?: unknown;
    onPress?: () => void;
    isDisabled?: boolean;
    "data-testid"?: string;
  }) => (
    <button
      data-testid={props["data-testid"]}
      disabled={props.isDisabled}
      onClick={() => props.onPress?.()}
    >
      {props.children as never}
    </button>
  ),
  Dialog: (props: { show: boolean; children?: unknown }) => (
    <>
      {props.show ? <div role="dialog">{props.children as never}</div> : null}
    </>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <svg /> }));
vi.mock("../CommunityParts", () => ({
  useDate: () => (ms?: number) => (ms ? "a date" : ""),
  CommunityImage: () => <span data-art />,
  DecorationArt: () => null,
  EffectArt: () => null,
  NameplateArt: () => null,
}));
vi.mock("../CreatorPublicName", () => ({
  CreatorPublicName: () => <div data-public-name />,
}));
vi.mock("../studioTemplates", () => ({ downloadTemplate: vi.fn() }));

import type { CommunityItem, CommunityPermissions } from "../communityApi";

import { StudioHome } from "./StudioHome";

const item = (over: Partial<CommunityItem>): CommunityItem =>
  ({
    _id: "01",
    kind: "Decoration",
    name: "Rose ring",
    creator_id: "u",
    file: { _id: "f" },
    status: "Draft",
    revision: 1,
    popularity: 0,
    ...over,
  }) as CommunityItem;

const perms = (creator: string) =>
  ({ creator, permissions: [] }) as unknown as CommunityPermissions;

const [items, setItems] = createSignal<CommunityItem[]>([]);
const [state, setState] = createSignal({ loading: false, failed: false });
const [readOnly, setReadOnly] = createSignal(false);
const calls = { retry: 0, created: 0, opened: "", edited: "" };

let dispose: (() => void) | undefined;
beforeEach(() => {
  setItems([]);
  setState({ loading: false, failed: false });
  setReadOnly(false);
  Object.assign(calls, { retry: 0, created: 0, opened: "", edited: "" });
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <StudioHome
          items={items()}
          loading={state().loading}
          failed={state().failed}
          onRetry={() => calls.retry++}
          perms={perms(readOnly() ? "Suspended" : "Active")}
          readOnly={readOnly()}
          effects
          name="Lina"
          onLeave={() => undefined}
          onNew={() => calls.created++}
          onOpen={(target) => (calls.opened = target._id)}
          onEdit={(target) => (calls.edited = target._id)}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );
});
afterEach(() => dispose?.());

const q = (selector: string) => document.querySelector<HTMLElement>(selector);
const all = (selector: string) => [
  ...document.querySelectorAll<HTMLElement>(selector),
];
const tid = (id: string) => `[data-testid='${id}']`;

describe("studio home", () => {
  it("says so when there is nothing yet, with a way to start", () => {
    expect(q(tid("studio-empty"))?.textContent).toContain("No designs yet");
    q(tid("studio-new"))!.click();
    expect(calls.created).toBe(1);
  });

  it("shows loading, then an error with a retry", () => {
    setState({ loading: true, failed: false });
    expect(q(tid("studio-loading"))?.getAttribute("aria-busy")).toBe("true");
    expect(q(tid("studio-empty"))).toBeNull();
    setState({ loading: false, failed: true });
    const alert = q("[role='alert']")!;
    expect(alert.textContent).toContain("couldn't be loaded");
    alert.querySelector("button")!.click();
    expect(calls.retry).toBe(1);
  });

  it("lists designs with their state, and puts what waits for the creator on top", () => {
    setItems([
      item({
        _id: "1",
        name: "Rose ring",
        status: "Published",
        popularity: 12,
      }),
      item({
        _id: "2",
        name: "Night comets",
        kind: "Effect",
        status: "ChangesRequested",
        review_note: "frame 18 flashes",
      }),
      item({
        _id: "3",
        name: "Calm waves",
        kind: "Nameplate",
        status: "Archived",
      }),
    ]);
    expect(all(tid("studio-row")).length).toBe(3);
    expect(all(tid("studio-attention")).length).toBe(1);
    expect(q(tid("studio-attention"))!.textContent).toContain(
      "frame 18 flashes",
    );
    expect(q(tid("studio-tab-attention"))!.textContent).toContain("1");
    expect(q(tid("studio-stats"))!.textContent).toContain("12");
    // a withdrawn design does not count against the limit
    expect(q(tid("studio-stats"))!.textContent).toContain("2 / 50");
    // the note sits under its row too
    const row = all(tid("studio-row")).find(
      (entry) => entry.dataset.id === "2",
    )!;
    expect(row.textContent).toContain("Reviewer's note:");
    expect(row.querySelector(tid("studio-status"))!.textContent).toBe(
      "Changes needed",
    );
  });

  it("filters by tab, type and search", () => {
    setItems([
      item({ _id: "1", name: "Rose ring", status: "Published" }),
      item({
        _id: "2",
        name: "Calm waves",
        kind: "Nameplate",
        status: "Archived",
      }),
    ]);
    q(tid("studio-tab-withdrawn"))!.click();
    expect(all(tid("studio-row")).map((row) => row.dataset.id)).toEqual(["2"]);
    q(tid("studio-tab-all"))!.click();
    const search = q(tid("studio-search")) as HTMLInputElement;
    search.value = "rose";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(all(tid("studio-row")).map((row) => row.dataset.id)).toEqual(["1"]);
    search.value = "nothing like it";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(q(tid("studio-empty"))!.textContent).toContain("Nothing here");
  });

  it("opens and edits from a row; a withdrawn design has no edit", () => {
    setItems([
      item({ _id: "1", name: "Rose ring", status: "Published" }),
      item({ _id: "2", name: "Calm waves", status: "Archived" }),
    ]);
    const rows = all(tid("studio-row"));
    rows[0].querySelector<HTMLElement>("button")!.click();
    expect(calls.opened).toBe("1");
    rows[0].querySelector<HTMLElement>(tid("studio-row-edit"))!.click();
    expect(calls.edited).toBe("1");
    expect(rows[1].querySelector(tid("studio-row-edit"))).toBeNull();
  });

  it("changes nothing for a suspended creator", () => {
    setItems([item({ _id: "1", status: "Draft" })]);
    setReadOnly(true);
    expect(q(tid("studio-new"))).toBeNull();
    expect(q(tid("studio-row-edit"))).toBeNull();
    expect(all(tid("studio-row")).length).toBe(1);
  });
});
