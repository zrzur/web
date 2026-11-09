import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocsPortal } from "./DocsPortal";

// The docs page loads its Markdown and data after it opens. Jumping to a
// section has to wait for that content (review B1), and a failed load must
// say so and try again instead of loading forever (review S1).

const loads = vi.hoisted(() => ({
  source: vi.fn<(id: string, locale: string) => Promise<string | undefined>>(),
}));

vi.mock("./pages", () => ({
  DEFAULT_PAGE: "overview",
  PAGES: [{ id: "overview", group: "start", hasSource: true }],
  pageById: (id: string | undefined) =>
    id === "overview"
      ? { id: "overview", group: "start", hasSource: true }
      : undefined,
  loadSource: loads.source,
}));
vi.mock("./inventory", () => ({
  inventory: {
    generated: { backend: "abc", openapi: "1" },
    index: [],
    gateway: { events: [] },
  },
  loadParts: async () => undefined,
  partsForMarkdown: () => [],
  endpointSlug: () => "",
  pageOfSection: (s: string) => s,
}));
vi.mock("./examples", () => ({
  loadExample: async () => undefined,
  loadExamplesFor: async () => [],
}));
vi.mock("./reference", () => ({ loadReference: async () => undefined }));
vi.mock("./markdownTree", () => ({ headingsOf: () => [] }));
vi.mock("./GettingStarted", () => ({ GettingStarted: () => <p /> }));
vi.mock("./Markdown", () => ({
  Markdown: (props: { source: string }) => (
    <div>
      <h2 id="target">{props.source}</h2>
    </div>
  ),
}));
vi.mock("@revolt/ui/icons/Icon", () => ({ Icon: () => <span /> }));
vi.mock("@revolt/routing", () => ({
  useLocation: () => ({ hash: "#target", pathname: "/developers/docs" }),
  useNavigate: () => () => undefined,
}));

let dispose: (() => void) | undefined;
const scrolled = vi.fn();
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.innerHTML = '<div id="root"></div>';
  Element.prototype.scrollIntoView = function () {
    scrolled(this.id);
  };
  Element.prototype.scrollTo = () => undefined;
  scrolled.mockClear();
  loads.source.mockReset();
});
afterEach(() => dispose?.());

const mount = () =>
  (dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <DocsPortal page="overview" />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  ));

describe("docs page", () => {
  it("jumps to the section once the page content has arrived", async () => {
    let arrive!: (source: string) => void;
    loads.source.mockReturnValue(new Promise((r) => (arrive = r)));
    mount();
    // let the first animation frame pass while the page is still loading
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(scrolled).not.toHaveBeenCalledWith("target");
    arrive("# Overview");
    await new Promise((resolve) => setTimeout(resolve, 60));
    await tick();
    await tick();
    expect(scrolled).toHaveBeenCalledWith("target");
  });

  it("says a page could not load, and tries again", async () => {
    loads.source.mockRejectedValueOnce(new Error("offline"));
    loads.source.mockResolvedValueOnce("# Back");
    mount();
    await tick();
    expect(document.body.textContent).toContain("This page couldn't load.");
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "Try again")!
      .click();
    await tick();
    expect(document.body.textContent).toContain("# Back");
  });
});
