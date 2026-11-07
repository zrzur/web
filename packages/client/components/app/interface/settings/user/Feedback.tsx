import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { BugReportDialog } from "./badges/BugReportDialog";

import {
  bug_report as MdBugReport,
  format_list_numbered as MdFormatListNumbered,
} from "@revolt/ui/icons/legacy";

import { CategoryButton, Column, iconSize } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Feedback — Zrzur GitHub destinations are planned under https://github.com/zrzur
 * (repos pending creation; links are configuration targets, not proof of existence).
 */
export function Feedback() {
  const [reporting, setReporting] = createSignal(false);
  return (
    <Column gap="lg">
      <CategoryButton.Group>
        <CategoryButton
          action="chevron"
          icon={<MdBugReport {...iconSize(22)} />}
          onClick={() => setReporting(true)}
          description={
            <Trans>
              Send a bug or a private security report to the Zrzur team and
              follow its status. Verified reports earn Bug Hunter.
            </Trans>
          }
        >
          <Trans>Report a bug</Trans>
        </CategoryButton>
      </CategoryButton.Group>
      {/* mounted only while open: a closed Dialog still covers the page */}
      <Show when={reporting()}>
        <BugReportDialog show onClose={() => setReporting(false)} beta={[]} />
      </Show>
      <CategoryButton.Group>
        <Link href="https://github.com/zrzur" target="_blank" rel="noreferrer">
          <CategoryButton
            action="external"
            icon={<Icon name="chat-circle-dots" size={22} />}
            ignoreClick
            description={
              <Trans>
                Suggest new Zrzur features once the public repository is
                available.
              </Trans>
            }
          >
            <Trans>Submit feature suggestion</Trans>
          </CategoryButton>
        </Link>
        <Link href="https://github.com/zrzur" target="_blank" rel="noreferrer">
          <CategoryButton
            action="external"
            icon={<MdFormatListNumbered {...iconSize(22)} />}
            ignoreClick
            description={<Trans>Submit feedback</Trans>}
          >
            <Trans>Feedback</Trans>
          </CategoryButton>
        </Link>
        <Link href="https://github.com/zrzur" target="_blank" rel="noreferrer">
          <CategoryButton
            action="external"
            icon={<MdBugReport {...iconSize(22)} />}
            ignoreClick
            description={<Trans>View currently active bug reports here.</Trans>}
          >
            <Trans>Bug tracker</Trans>
          </CategoryButton>
        </Link>
      </CategoryButton.Group>
    </Column>
  );
}

/**
 * Link without decorations
 */
const Link = styled("a", {
  base: {
    textDecoration: "none",
  },
});
