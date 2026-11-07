import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useTime } from "@revolt/i18n";
import { renderChangelogMarkdown } from "@revolt/markdown";
import { Column, Dialog, DialogProps } from "@revolt/ui";
import type { DialogAction } from "@revolt/ui/components/design/Dialog";

import { Modals } from "../types";
import type { ChangelogResponse } from "./changelogFeed";

export function ChangelogModal(
  props: DialogProps & Modals & { type: "changelog" },
) {
  const dayjs = useTime();
  const actions: DialogAction[] = [{ text: <Trans>Close</Trans> }];

  return (
    <Dialog
      tone="info"
      iconName="megaphone"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>What's new</Trans>}
      actions={actions}
    >
      <Column>
        <Subtitle>{dayjs(props.changelog.published_at).format("LL")}</Subtitle>
        <div>{renderChangelogMarkdown(props.changelog.markdown_content)}</div>
      </Column>
    </Dialog>
  );
}

const Subtitle = styled("span", {
  base: {
    marginBlockEnd: "var(--gap-md)",
    fontSize: "0.875rem",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});
