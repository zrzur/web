import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useSettingsNavigation } from "../Settings";

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
  const { navigate } = useSettingsNavigation();
  return (
    <Column gap="lg">
      <CategoryButton.Group>
        <CategoryButton
          action="chevron"
          icon={<MdBugReport {...iconSize(20)} />}
          // its own page under this one (feedback/report), as any settings
          // page with more to it opens
          onClick={() => navigate("feedback/report")}
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
      <CategoryButton.Group>
        <Link href="https://github.com/zrzur" target="_blank" rel="noreferrer">
          <CategoryButton
            action="external"
            icon={<Icon name="chat-circle-dots" size={20} />}
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
            icon={<MdFormatListNumbered {...iconSize(20)} />}
            ignoreClick
          >
            <Trans>Submit feedback</Trans>
          </CategoryButton>
        </Link>
        <Link href="https://github.com/zrzur" target="_blank" rel="noreferrer">
          <CategoryButton
            action="external"
            icon={<MdBugReport {...iconSize(20)} />}
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
