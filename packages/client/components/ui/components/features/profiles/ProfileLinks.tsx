import { Show, createMemo } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useModals } from "@revolt/modal";

import { ProfileSection, chip } from "./ProfileCard";
import { ProfileChipRow } from "./ProfileChipRow";
import { linkDomain, linkName, safeProfileLinks } from "./sections";

/** Our own chain link, drawn at the weight of the icon set */
function ChainIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M10 7H7a5 5 0 0 0 0 10h3" />
      <path d="M14 7h3a5 5 0 0 1 0 10h-3" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

/**
 * Links as compact chips on one row: a known site's name, or the site itself.
 * One link also shows its site when it fits. The full address stays on hover
 * and in the link warning. Nothing is loaded from the site in the viewer's
 * browser, and every link opens through the warning.
 */
export function ProfileLinks(props: { links?: string[] }) {
  const { openModal } = useModals();
  const links = createMemo(() => safeProfileLinks(props.links));

  return (
    <Show when={links().length}>
      <ProfileSection title={<Trans>Links</Trans>}>
        <ProfileChipRow items={links()}>
          {(url) => (
            <button
              class={chip({ press: true })}
              type="button"
              title={url.toString()}
              onClick={() =>
                openModal({
                  type: "link_warning",
                  url,
                  display: url.toString(),
                })
              }
            >
              <ChainIcon />
              <Name>
                <bdi dir="ltr">{linkName(url)}</bdi>
              </Name>
              <Show
                when={links().length === 1 && linkName(url) !== linkDomain(url)}
              >
                <Site dir="ltr">{linkDomain(url)}</Site>
              </Show>
            </button>
          )}
        </ProfileChipRow>
      </ProfileSection>
    </Show>
  );
}

/** Cut at about 14 characters; the full address stays on hover */
const Name = styled("strong", {
  base: {
    flexShrink: 0,
    maxWidth: "14ch",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 600,
  },
});

const Site = styled("bdi", {
  base: {
    fontWeight: 400,
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});
