import { For, JSX } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon, IconName } from "@revolt/ui/icons/Icon";

/**
 * Palette for the preview. Omit to render with the live app tokens.
 */
export type PreviewPalette = {
  app: string;
  sidebar: string;
  chat: string;
  raised: string;
  accent: string;
  iconAccent: string;
  light: boolean;
};

/**
 * Miniature Zrzur window that renders with the current (or previewed)
 * appearance. Content is clearly labelled sample data.
 */
export function LivePreview(props: {
  palette?: PreviewPalette;
  iconStyle: "outline" | "filled" | "expressive";
  density: "compact" | "comfortable" | "spacious";
}) {
  const vars = (): JSX.CSSProperties => {
    const p = props.palette;
    const row =
      props.density === "compact"
        ? "20px"
        : props.density === "spacious"
          ? "28px"
          : "24px";
    const gap =
      props.density === "compact"
        ? "6px"
        : props.density === "spacious"
          ? "14px"
          : "10px";

    if (!p) {
      return {
        "--p-app": "var(--z-bg-app)",
        "--p-rail": "var(--z-bg-rail)",
        "--p-sidebar": "var(--z-bg-sidebar)",
        "--p-chat": "var(--z-bg-chat)",
        "--p-raised": "var(--z-bg-raised)",
        "--p-accent": "var(--z-accent)",
        "--p-icon-accent": "var(--z-icon-accent)",
        "--p-fg": "var(--z-fg-primary)",
        "--p-fg2": "var(--z-fg-secondary)",
        "--p-muted": "var(--z-fg-muted)",
        "--p-line": "var(--z-border-subtle)",
        "--p-row": row,
        "--p-gap": gap,
      } as JSX.CSSProperties;
    }

    return {
      "--p-app": p.app,
      "--p-rail": p.app,
      "--p-sidebar": p.sidebar,
      "--p-chat": p.chat,
      "--p-raised": p.raised,
      "--p-accent": p.accent,
      "--p-icon-accent": p.iconAccent,
      "--p-fg": p.light ? "#171925" : "#F0F1F8",
      "--p-fg2": p.light ? "#4E4560" : "#A1A5B8",
      "--p-muted": p.light ? "#6B6279" : "#979BB1",
      "--p-line": p.light ? "rgb(28 23 36 / 0.09)" : "rgb(255 255 255 / 0.06)",
      "--p-row": row,
      "--p-gap": gap,
    } as JSX.CSSProperties;
  };

  const { t } = useLingui();

  const icon = (name: IconName, size = 14) => (
    <Icon name={name} size={size} styleVariant={props.iconStyle} />
  );

  return (
    <Frame style={vars()} aria-label={t`Appearance preview`} role="img">
      <Badge>
        <Trans>Preview · sample data</Trans>
      </Badge>

      <Rail>
        <Home>
          <img
            src={`${import.meta.env.BASE_URL}brand/mark-white.svg`}
            alt=""
            width="18"
            height="18"
          />
        </Home>
        <RailDivider />
        <For each={["Z", "G", "A", "S"]}>
          {(letter, i) => (
            <RailItem data-selected={i() === 0}>
              <span>{letter}</span>
            </RailItem>
          )}
        </For>
        <RailItem data-add>{icon("plus", 14)}</RailItem>
      </Rail>

      <Sidebar>
        <ServerName>
          <span>{t`Zrzur Lounge`}</span>
          {icon("caret-down", 12)}
        </ServerName>
        <Channels>
          <Category>
            {icon("caret-down", 10)} {t`TEXT`}
          </Category>
          <Channel data-selected>
            {icon("hash")}
            <span>{t`general`}</span>
          </Channel>
          <Channel data-unread>
            {icon("hash")}
            <span>{t`clips`}</span>
          </Channel>
          <Channel>
            {icon("hash")}
            <span>lfg</span>
          </Channel>
          <Category>
            {icon("caret-down", 10)} {t`VOICE`}
          </Category>
          <Channel>
            {icon("headset")}
            <span>{t`Lobby`}</span>
          </Channel>
        </Channels>
        <Account>
          <Avatar style={{ background: "#E089B0" }}>Y</Avatar>
          <AccountName>
            <strong>{t`You`}</strong>
            <small>{t`Online`}</small>
          </AccountName>
          <AccountIcons>
            {icon("microphone")}
            {icon("headphones")}
            {icon("gear-six")}
          </AccountIcons>
        </Account>
      </Sidebar>

      <Chat>
        <ChatHeader>
          <span class="name">
            {icon("hash", 14)} {t`general`}
          </span>
          <span class="tools">
            {icon("push-pin")}
            {icon("users")}
            {icon("magnifying-glass")}
          </span>
        </ChatHeader>
        <Messages>
          <Message>
            <Avatar style={{ background: "#3DBFB8" }}>M</Avatar>
            <div>
              <Author>
                Mira <time>{t`Today 19:02`}</time>
              </Author>
              <Text>{t`Anyone up for ranked tonight?`}</Text>
            </div>
          </Message>
          <Message>
            <Avatar style={{ background: "#8B7CF0" }}>K</Avatar>
            <div>
              <Author>
                Kai <time>{t`Today 19:04`}</time>
              </Author>
              <Text>
                {t`In!`} <Mention>@{t`You`}</Mention> {t`bring the new strat.`}
              </Text>
              <Reaction>
                <span>🔥</span> 3
              </Reaction>
            </div>
          </Message>
        </Messages>
        <Composer>
          {icon("plus-circle")}
          <span class="placeholder">{t`Message #general`}</span>
          {icon("smiley")}
          {icon("paper-plane-tilt")}
        </Composer>
      </Chat>

      <Members>
        <MemberHeading>{t`ONLINE — 3`}</MemberHeading>
        <For
          each={[
            ["Mira", "#3DBFB8"],
            ["Kai", "#8B7CF0"],
            [t`You`, "#E089B0"],
          ]}
        >
          {([name, colour]) => (
            <Member>
              <Avatar data-small style={{ background: colour }}>
                {name[0]}
              </Avatar>
              <span>{name}</span>
            </Member>
          )}
        </For>
      </Members>
    </Frame>
  );
}

const Frame = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "44px 150px minmax(0, 1fr) 120px",
    height: "268px",
    borderRadius: "10px",
    overflow: "hidden",
    border: "1px solid var(--z-border-strong)",
    background: "var(--p-app)",
    color: "var(--p-fg)",
    fontSize: "11px",
    lineHeight: "15px",
    boxShadow: "var(--z-shadow-md)",
    userSelect: "none",
    pointerEvents: "none",
    transition: "background-color 0.2s ease",
    "--z-icon-color":
      "color-mix(in srgb, var(--p-muted) 78%, var(--p-icon-accent))",

    "@media (max-width: 760px)": {
      gridTemplateColumns: "44px 140px minmax(0, 1fr)",
      "& > aside": { display: "none" },
    },
  },
});

const Badge = styled("div", {
  base: {
    position: "absolute",
    bottom: "8px",
    insetInlineEnd: "8px",
    zIndex: 1,
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--p-fg2)",
    background: "color-mix(in srgb, var(--p-raised) 85%, transparent)",
    border: "1px solid var(--p-line)",
  },
});

const Rail = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    paddingBlock: "8px",
    background: "var(--p-rail)",
  },
});

const Home = styled("div", {
  base: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "var(--p-accent)",
  },
});

const RailDivider = styled("div", {
  base: { width: "16px", height: "1px", background: "var(--p-line)" },
});

const RailItem = styled("div", {
  base: {
    position: "relative",
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "10px",
    color: "var(--p-fg2)",
    background: "var(--p-raised)",

    "&[data-selected='true']::before": {
      content: "''",
      position: "absolute",
      insetInlineStart: "-8px",
      width: "3px",
      height: "18px",
      borderRadius: "2px",
      background: "var(--p-fg)",
    },
    "&[data-add]": {
      background: "transparent",
      border: "1px dashed var(--p-line)",
    },
  },
});

const Sidebar = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    background: "var(--p-sidebar)",
    borderInlineEnd: "1px solid var(--p-line)",
  },
});

const ServerName = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "34px",
    paddingInline: "10px",
    fontWeight: 700,
    fontSize: "12px",
    borderBottom: "1px solid var(--p-line)",
  },
});

const Channels = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "6px",
  },
});

const Category = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    marginTop: "6px",
    paddingInline: "2px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--p-muted)",
  },
});

const Channel = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    height: "var(--p-row)",
    paddingInline: "6px",
    borderRadius: "4px",
    color: "var(--p-muted)",
    transition: "height 0.2s ease",

    "&[data-selected]": {
      color: "var(--p-fg)",
      background: "color-mix(in srgb, var(--p-fg) 8%, transparent)",
      "--z-icon-color":
        "color-mix(in srgb, var(--p-fg) 80%, var(--p-icon-accent))",
    },
    "&[data-unread]": {
      color: "var(--p-fg)",
      fontWeight: 600,
    },
  },
});

const Account = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    height: "40px",
    paddingInline: "8px",
    background: "var(--p-rail)",
    borderTop: "1px solid var(--p-line)",
  },
});

const AccountName = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    "& small": { fontSize: "10px", color: "var(--p-muted)" },
  },
});

const AccountIcons = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    "--z-icon-color":
      "color-mix(in srgb, var(--p-fg2) 82%, var(--p-icon-accent))",
  },
});

const Avatar = styled("div", {
  base: {
    flexShrink: 0,
    width: "24px",
    height: "24px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    fontSize: "10px",
    fontWeight: 700,
    color: "#101217",

    "&[data-small]": { width: "18px", height: "18px", fontSize: "10px" },
  },
});

const Chat = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    background: "var(--p-chat)",
  },
});

const ChatHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "34px",
    paddingInline: "12px",
    borderBottom: "1px solid var(--p-line)",
    fontWeight: 700,
    "& .name": { display: "flex", alignItems: "center", gap: "4px" },
    "& .tools": { display: "flex", gap: "8px" },
  },
});

const Messages = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    gap: "var(--p-gap)",
    padding: "10px 12px",
    transition: "gap 0.2s ease",
  },
});

const Message = styled("div", {
  base: { display: "flex", gap: "8px" },
});

const Author = styled("div", {
  base: {
    fontWeight: 700,
    "& time": {
      marginInlineStart: "4px",
      fontWeight: 400,
      fontSize: "10px",
      color: "var(--p-muted)",
    },
  },
});

const Text = styled("div", {
  base: { color: "var(--p-fg2)" },
});

const Mention = styled("span", {
  base: {
    padding: "0 3px",
    borderRadius: "3px",
    color: "var(--p-accent)",
    background: "color-mix(in srgb, var(--p-accent) 18%, transparent)",
  },
});

const Reaction = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    marginTop: "4px",
    padding: "1px 6px",
    borderRadius: "6px",
    fontSize: "10px",
    color: "var(--p-fg)",
    background: "color-mix(in srgb, var(--p-accent) 16%, transparent)",
    border: "1px solid color-mix(in srgb, var(--p-accent) 50%, transparent)",
  },
});

const Composer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "30px",
    margin: "0 10px 10px",
    paddingInline: "10px",
    borderRadius: "6px",
    background: "var(--p-raised)",
    "& .placeholder": { flexGrow: 1, color: "var(--p-muted)" },
  },
});

const Members = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px 8px",
    background: "var(--p-sidebar)",
    borderInlineStart: "1px solid var(--p-line)",
  },
});

const MemberHeading = styled("div", {
  base: {
    marginBottom: "2px",
    paddingInline: "4px",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--p-muted)",
  },
});

const Member = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    paddingInline: "4px",
    height: "var(--p-row)",
    color: "var(--p-fg2)",
  },
});
