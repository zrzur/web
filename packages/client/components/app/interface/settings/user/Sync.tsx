import { Trans } from "@lingui/solid/macro";

import { CategoryButton, Checkbox, Column, Time, iconSize } from "@revolt/ui";

import {
  brush as MdBrush,
  language as MdLanguage,
  palette as MdPalette,
} from "@revolt/ui/icons/legacy";

/**
 * Sync Configuration Page
 */
export default function Sync() {
  return (
    <Column gap="lg">
      <CategoryButton.Group>
        <CategoryButton
          action={<Checkbox checked onChange={(value) => void value} />}
          onClick={() => void 0}
          icon={<MdPalette {...iconSize(22)} />}
          description={
            <Trans>
              Sync appearance options, such as chosen emoji pack and message
              density.
            </Trans>
          }
        >
          <Trans>Appearance</Trans>
        </CategoryButton>
        <CategoryButton
          action={<Checkbox checked onChange={(value) => void value} />}
          onClick={() => void 0}
          icon={<MdBrush {...iconSize(22)} />}
          description={
            <Trans>Sync your chosen theme, colours, and any custom CSS.</Trans>
          }
        >
          <Trans>Theme</Trans>
        </CategoryButton>
        <CategoryButton
          action={<Checkbox checked onChange={(value) => void value} />}
          onClick={() => void 0}
          icon={<MdLanguage {...iconSize(22)} />}
          description={<Trans>Sync your currently chosen language.</Trans>}
        >
          <Trans>Language</Trans>
        </CategoryButton>
      </CategoryButton.Group>
      <CategoryButton.Group>
        <CategoryButton>
          <Trans>
            Last sync <Time format="relative" value={0} />
          </Trans>
        </CategoryButton>
      </CategoryButton.Group>
    </Column>
  );
}
