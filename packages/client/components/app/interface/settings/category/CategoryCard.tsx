import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { TextWithEmoji } from "@revolt/markdown";
import { OverflowingText } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type CategoryContext,
  findCategory,
  isPrivateCategory,
} from "./category";

/**
 * Top of the category settings sidebar, matching the channel settings card:
 * which category you're editing
 */
export function CategoryCard(props: { context: CategoryContext }) {
  const category = () => findCategory(props.context);
  const isPrivate = () => {
    const current = category();
    return (
      !!current &&
      isPrivateCategory(props.context.server.defaultPermissions, current)
    );
  };

  return (
    <Card>
      <Glyph>
        <Icon name={isPrivate() ? "lock-simple" : "folder"} size={20} />
      </Glyph>
      <Names>
        <Name>
          <OverflowingText>
            <TextWithEmoji content={category()?.title ?? ""} />
          </OverflowingText>
        </Name>
        <Sub>
          <Trans>Category settings</Trans>
        </Sub>
      </Names>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "56px",
    padding: "8px",
    marginInlineEnd: "12px",
    marginBottom: "4px",
  },
});

const Glyph = styled("div", {
  base: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
  },
});

const Names = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

const Name = styled("span", {
  base: {
    minWidth: 0,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
  },
});

const Sub = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});
