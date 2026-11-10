import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// A slow page for the answer chosen first must not land in the list of the
// answer chosen after it.

vi.mock("@revolt/ui", () => ({
  Avatar: () => <span />,
  Button: (props: { children?: unknown }) => (
    <button>{props.children as never}</button>
  ),
  Dialog: (props: { children?: unknown }) => (
    <div>{props.children as never}</div>
  ),
}));
vi.mock("@revolt/i18n/errors", () => ({ TranslatedError: () => <span /> }));
vi.mock("@revolt/markdown/emoji", () => ({ Emoji: () => <span /> }));

import { PollVotersModal } from "./PollVoters";

let dispose: (() => void) | undefined;
beforeEach(() => i18n.loadAndActivate({ locale: "en", messages: {} }));
afterEach(() => dispose?.());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const person = (id: string) => ({ id, displayName: id });

it("drops the answer to an older request", async () => {
  const pending: Record<number, (page: unknown) => void> = {};
  const message = {
    poll: {
      question: "q",
      answers: [
        { id: 1, text: "A", count: 1 },
        { id: 2, text: "B", count: 1 },
      ],
    },
    server: undefined,
    fetchPollVoters: (answer: number) =>
      new Promise((resolve) => (pending[answer] = resolve)),
  };
  document.body.innerHTML = '<div id="root"></div>';
  dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <PollVotersModal
          type="poll_voters"
          message={message as never}
          show
          onClose={() => undefined}
        />
      </I18nProvider>
    ),
    document.getElementById("root")!,
  );

  // answer 1 is asked first; then B is chosen before it comes back
  const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs[1].click();
  pending[2]({ users: [person("bea")], count: 1 });
  await settle();
  pending[1]({ users: [person("al")], count: 1 });
  await settle();

  const text = document.querySelector('[role="tabpanel"]')!.textContent;
  expect(text).toContain("bea");
  expect(text).not.toContain("al");
});
