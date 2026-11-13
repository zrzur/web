import { useLingui } from "@lingui/solid/macro";
import { Match, Switch } from "solid-js";

import { Handler } from "mdast-util-to-hast";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { UserContextMenu } from "@revolt/app";
import { useClient } from "@revolt/client";
import { useSmartParams } from "@revolt/routing";
import { Avatar, ColouredText, iconSize } from "@revolt/ui";

import { alternate_email as MdAt } from "@revolt/ui/icons/legacy";

import { useUser } from "../users";

export function RenderMention(props: {
  mentions?: string;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Switch fallback={<span>{t`Invalid mention`}</span>}>
      <Match when={props.mentions?.startsWith("user:")}>
        <UserMention
          userId={props.mentions!.substring(5)}
          disabled={props.disabled}
        />
      </Match>
      <Match when={props.mentions === "everyone"}>
        <span class={mention()} dir="auto">
          <MdAt {...iconSize(16)} />
          everyone
        </span>
      </Match>
      <Match when={props.mentions === "online"}>
        <span class={mention()} dir="auto">
          <MdAt {...iconSize(16)} />
          online
        </span>
      </Match>
      <Match when={props.mentions?.startsWith("role:")}>
        <RoleMention roleId={props.mentions!.substring(5)} />
      </Match>
    </Switch>
  );
}

export function UserMention(props: { userId: string; disabled?: boolean }) {
  const { t } = useLingui();
  const user = useUser(() => props.userId);

  return (
    <Switch
      fallback={
        <span class={mention({ valid: false })}>{t`Unknown user`}</span>
      }
    >
      <Match when={user().user}>
        <div
          // its own direction, so a name in another script never turns the
          // sentence around it (an Arabic name in English text, and back)
          dir="auto"
          class={mention({ isLink: true })}
          use:floating={
            props.disabled || user().user?.official
              ? undefined
              : {
                  userCard: user().user
                    ? {
                        user: user().user!,
                        member: user().member,
                      }
                    : undefined,
                  contextMenu: () => (
                    <UserContextMenu
                      user={user().user!}
                      member={user().member}
                    />
                  ),
                }
          }
        >
          <Avatar size={16} src={user().avatar} fallback={user().username} />
          <ColouredText colour={user().colour!}>{user().username}</ColouredText>
        </div>
      </Match>
    </Switch>
  );
}

export function RoleMention(props: { roleId: string }) {
  const { t } = useLingui();
  // some jank involved...
  const client = useClient();
  const params = useSmartParams();
  const role = () =>
    client().servers.get(params().serverId!)?.roles.get(props.roleId);

  return (
    <Switch
      fallback={
        <span class={mention({ valid: false })}>{t`Unknown role`}</span>
      }
    >
      <Match when={role()}>
        <div class={mention()} dir="auto">
          <RoleIcon
            style={{
              background:
                role()!.colour ?? "var(--md-sys-color-outline-variant)",
            }}
          />
          <ColouredText colour={role()!.colour!}>{role()!.name}</ColouredText>
        </div>
      </Match>
    </Switch>
  );
}

const RoleIcon = styled("div", {
  base: {
    margin: "1px",
    width: "14px",
    height: "14px",
    aspectRatio: "1/1",
    borderRadius: "100%",
  },
});

const RE_MENTION =
  /(<@[ABCDEFGHJKMNPQRSTVWXYZ\d]{26}>|@everyone|@online|<%[ABCDEFGHJKMNPQRSTVWXYZ\d]{26}>)/;

export const remarkMentions: Plugin = () => (tree) => {
  visit(
    tree,
    "text",
    (
      node: { type: "text"; value: string },
      idx,
      parent: { children: unknown[] },
    ) => {
      const elements = node.value.split(RE_MENTION);
      if (elements.length === 1) return; // no matches

      const newNodes = elements.map((value, index) =>
        index % 2
          ? value.startsWith("<@")
            ? {
                type: "mention",
                mentions: "user:" + value.substring(2, value.length - 1),
              }
            : value === "@everyone"
              ? {
                  type: "mention",
                  mentions: "everyone",
                }
              : value === "@online"
                ? {
                    type: "mention",
                    mentions: "online",
                  }
                : {
                    type: "mention",
                    mentions: "role:" + value.substring(2, value.length - 1),
                  }
          : {
              type: "text",
              value,
            },
      );

      parent.children.splice(idx, 1, ...newNodes);
      return idx + newNodes.length;
    },
  );
};

export const mentionHandler: Handler = (h, node) => {
  return {
    type: "element" as const,
    tagName: "mention",
    children: [],
    properties: {
      mentions: node.mentions,
    },
  };
};

export const mention = cva({
  base: {
    verticalAlign: "bottom",

    gap: "4px",
    paddingInlineStart: "2px",
    paddingInlineEnd: "6px",
    alignItems: "center",
    display: "inline-flex",

    fontWeight: 600,
    borderRadius: "var(--borderRadius-lg)",

    color: "var(--z-mention-text, var(--md-sys-color-on-primary-container))",
    background: "var(--z-mention-pill, var(--md-sys-color-primary-container))",
  },
  variants: {
    isLink: {
      true: {
        cursor: "pointer",
      },
    },
    valid: {
      false: {
        paddingInlineStart: "6px",
        cursor: "not-allowed",
      },
    },
    inEditor: {
      true: {
        color: "var(--z-on-accent, var(--md-sys-color-on-primary))",
        background: "var(--z-accent-fill, var(--md-sys-color-primary))",

        "& img": {
          width: "16px",
          height: "16px",
          objectFit: "cover",
          borderRadius: "var(--borderRadius-full)",
        },
      },
    },
  },
});
