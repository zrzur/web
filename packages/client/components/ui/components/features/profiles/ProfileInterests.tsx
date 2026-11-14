import { For, JSX, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { ProfileSection, chip } from "./ProfileCard";

/**
 * One linked service on a profile (games from Steam today). A new service
 * adds one entry here with its own panel; the card's layout does not change.
 */
export type ProfileInterest = {
  id: string;
  /** Names its tab: "Games" */
  label: JSX.Element;
  panel: () => JSX.Element;
};

/**
 * Interests: what the person's linked accounts show. One service fills the
 * section directly; with more than one, tabs above the panel switch between
 * them and the first is open.
 */
export function ProfileInterests(props: { interests: ProfileInterest[] }) {
  const { t } = useLingui();
  const [picked, setPicked] = createSignal<string>();
  const current = createMemo(
    () =>
      props.interests.find((interest) => interest.id === picked()) ??
      props.interests[0],
  );

  /** Left and right move between tabs, as in any tab list */
  function onKey(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = [
      ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        "[role=tab]",
      ),
    ];
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const rtl = getComputedStyle(tabs[at]).direction === "rtl";
    const step = (event.key === "ArrowRight") !== rtl ? 1 : -1;
    const next = tabs[(at + step + tabs.length) % tabs.length];
    event.preventDefault();
    next.focus();
    next.click();
  }

  return (
    <Show when={current()}>
      {(interest) => (
        <ProfileSection title={<Trans>Interests</Trans>}>
          <Show when={props.interests.length > 1}>
            <Tabs role="tablist" aria-label={t`Interests`} onKeyDown={onKey}>
              <For each={props.interests}>
                {(item) => (
                  <button
                    type="button"
                    role="tab"
                    class={chip({ press: true })}
                    aria-selected={item.id === interest().id}
                    tabIndex={item.id === interest().id ? 0 : -1}
                    onClick={() => setPicked(item.id)}
                  >
                    <span>{item.label}</span>
                  </button>
                )}
              </For>
            </Tabs>
          </Show>
          {interest().panel()}
        </ProfileSection>
      )}
    </Show>
  );
}

const Tabs = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,

    // the open tab: ink on the surface, turned round
    "& [aria-selected=true]": {
      borderColor: "transparent",
      background: "var(--profile-ink, var(--z-fg-primary))",
      color: "var(--profile-ring, var(--z-bg-floating))",
    },
  },
});
