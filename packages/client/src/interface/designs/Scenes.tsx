import { JSX, Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import {
  Avatar,
  MenuButton,
  MessageContainer,
  OverflowingText,
  UserStatus,
  Username,
} from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { useDesignMotion } from "@revolt/ui/components/features/profiles/NameplateMotion";
import {
  sampleAvatar,
  sampleAvatarFor,
} from "@revolt/ui/components/features/profiles/sampleAvatars";
import {
  type UserStyle,
  nameStyle,
  nameplateBackground,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  NameStatusStack,
  memberRow,
  nameplateLayer,
} from "../channels/text/memberRowLook";

/** a person in a preview: a name, a picture and a profile colour */
export type Person = { name: string; colour: string; avatar: string };

/**
 * The sample people in the previews, each with their own drawing. Their colours
 * are profile colours (THEME_PRESETS), part of the designs on show, not
 * interface colours.
 */
export function useCast() {
  const { t } = useLingui();
  const person = (index: number, name: string, colour: string): Person => ({
    name,
    colour,
    avatar: sampleAvatar(index),
  });
  const sara = () => person(0, t`Sara`, "#8b2be2");
  const omar = () => person(1, t`Omar`, "#1e9bb8");
  const lina = () => person(2, t`Lina`, "#eb3349");
  const yusuf = () => person(5, t`Yusuf`, "#11998e");
  const noor = () => person(3, t`Noor`, "#f7971e");
  const karim = () => person(11, t`Karim`, "#0072ff");
  return {
    sara,
    omar,
    lina,
    yusuf,
    noor,
    karim,
    all: (): Person[] => [
      sara(),
      omar(),
      lina(),
      yusuf(),
      noor(),
      karim(),
      person(4, t`Maya`, "#134e5e"),
      person(7, t`Hadi`, "#ff6b4a"),
      person(8, t`Rana`, "#c2185b"),
      person(9, t`Tarek`, "#3d1e6d"),
      person(6, t`Salma`, "#a66bff"),
      person(10, t`Zaid`, "#38d39f"),
    ],
  };
}

/**
 * Who wears a preview. Signed in, always the viewer: their own avatar and name.
 * Signed out, a sample person, `person` when a tile has its own.
 */
export function useWearer() {
  const client = useClient();
  const cast = useCast();
  const me = () => client().user;
  const name = () => me()?.displayName ?? me()?.username;
  return {
    /** true once there is a real profile behind the preview */
    real: () => !!me(),
    name: () => name() ?? cast.sara().name,
    handle: () => me()?.username ?? cast.sara().name,
    /** your pronouns, as your profile shows them beside your username */
    pronouns: () => me()?.pronouns ?? undefined,
    avatar: () => me()?.animatedAvatarURL ?? cast.sara().avatar,
    colour: () => cast.sara().colour,
    who: (person?: Person): Person & { handle: string } => {
      const sample = person ?? cast.sara();
      const user = me();
      return user
        ? {
            name: name() ?? sample.name,
            handle: user.username,
            colour: sample.colour,
            avatar: user.animatedAvatarURL,
          }
        : { ...sample, handle: sample.name };
    },
  };
}

/** A round avatar: always a picture, never an initial on a colour */
export function Face(props: {
  size: number;
  name: string;
  colour?: string;
  src?: string;
}) {
  return (
    <Avatar
      size={props.size}
      src={props.src ?? sampleAvatarFor(props.name)}
      fallbackBackground={false}
      fallback={
        <Blank
          style={{
            background: props.colour ?? "var(--z-designs-surface-raised)",
          }}
        />
      }
    />
  );
}

/** The wearer's avatar in a style's decoration; `other` is someone else */
export function WornAvatar(props: {
  size: number;
  style: UserStyle;
  /** who wears it for someone signed out */
  person?: Person;
  /** someone else in the scene, whoever is looking */
  other?: Person;
}) {
  const wearer = useWearer();
  const who = () => props.other ?? wearer.who(props.person);
  return (
    <AvatarDecoration
      decoration={props.style.decoration}
      file={props.style.decoration_file}
      size={props.size}
    >
      <Face
        size={props.size}
        name={who().name}
        colour={who().colour}
        src={who().avatar}
      />
    </AvatarDecoration>
  );
}

/**
 * One message as it looks in a channel, wearing a style: drawn by the
 * channel's own message parts (MessageContainer, Username), not a copy
 */
export function ChatLine(props: {
  style: UserStyle;
  /** someone else in the conversation; the wearer when left out */
  person?: Person;
  time?: string;
  children: JSX.Element;
}) {
  const wearer = useWearer();
  return (
    <div class={sceneRow} inert>
      <MessageContainer
        avatar={
          // as the channel holds it: as tall as the picture, never stretched
          // by the message beside it (Message.tsx, avatarContainer)
          <div class={messageAvatar}>
            <WornAvatar size={36} style={props.style} other={props.person} />
          </div>
        }
        username={
          <Username
            username={props.person?.name ?? wearer.name()}
            userStyle={props.style}
          />
        }
        timestamp={<span>{props.time ?? ""}</span>}
      >
        <span dir="auto">{props.children}</span>
      </MessageContainer>
    </div>
  );
}

/**
 * One row of a member list, on the style's nameplate: drawn with the member
 * list's own row (memberRowLook), so it is exactly what a server shows
 */
export function ListMember(props: {
  style: UserStyle;
  /** who wears it for someone signed out */
  person?: Person;
  /** someone else in the list: themselves, whoever is looking */
  other?: Person;
}) {
  const instance = useInstance();
  const wearer = useWearer();
  const motion = useDesignMotion();
  const [hovered, setHovered] = createSignal(false);
  const who = () => props.other ?? wearer.who(props.person);
  const plate = () =>
    nameplateBackground(props.style, instance.mediaUrl, {
      moving: hovered() && motion(),
    });
  return (
    <div
      class={`${memberRow} ${sceneRow}`}
      data-plated={plate() ? "" : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Show when={plate()}>
        {(background) => (
          <div
            data-nameplate
            aria-hidden="true"
            class={`${nameplateLayer} z-plate`}
            style={{ "--plate": background() }}
          />
        )}
      </Show>
      <MenuButton
        size="normal"
        attention="active"
        noDrawer
        icon={
          <AvatarDecoration
            decoration={props.style.decoration}
            file={props.style.decoration_file}
            size={32}
          >
            <Avatar
              src={who().avatar}
              size={32}
              holepunch="bottom-right"
              overlay={<UserStatus.Graphic status="Online" />}
            />
          </AvatarDecoration>
        }
      >
        <NameStatusStack>
          <OverflowingText>
            <Username username={who().name} userStyle={props.style} />
          </OverflowingText>
        </NameStatusStack>
      </MenuButton>
    </div>
  );
}

/**
 * A design's nameplate as a gallery tile shows it: one row, large, the
 * name on the plate (the previews use the real member row, ListMember)
 */
export function MemberRow(props: { style: UserStyle; person?: Person }) {
  const instance = useInstance();
  const wearer = useWearer();
  const motion = useDesignMotion();
  const [hovered, setHovered] = createSignal(false);
  const plate = () =>
    nameplateBackground(props.style, instance.mediaUrl, {
      moving: hovered() && motion(),
    });
  return (
    <Row
      class="z-plate"
      data-plate={!!plate()}
      style={plate() ? { "--plate": plate() } : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <RowAvatar>
        <WornAvatar size={32} style={props.style} person={props.person} />
        <i aria-hidden="true" />
      </RowAvatar>
      <span dir="auto" style={nameStyle(props.style, { colour: !plate() })}>
        {wearer.who(props.person).name}
      </span>
    </Row>
  );
}

const messageAvatar = css({
  height: "fit-content",
  borderRadius: "var(--borderRadius-circle)",
});

/** a preview of a real row: it looks like one, it does not act like one */
const sceneRow = css({
  pointerEvents: "none",
  "& > *": { cursor: "default" },
});

/** Times in the sample conversation, in the page's language */
export function useSampleTime() {
  const { i18n } = useLingui();
  return (minute: number) =>
    new Intl.DateTimeFormat(i18n().locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(2026, 0, 1, 20, minute));
}

/** A channel as a panel: the bar on top, the conversation under it */
export function ChannelPanel(props: { title?: string; children: JSX.Element }) {
  const { t } = useLingui();
  return (
    <Panel>
      <PanelBar>
        <Icon name="hash" size={16} />
        <span>{props.title ?? t`general`}</span>
      </PanelBar>
      <Lines>{props.children}</Lines>
    </Panel>
  );
}

/** What a style looks like in a conversation */
export function ChatScene(props: { style: UserStyle }) {
  const { t } = useLingui();
  const cast = useCast();
  const time = useSampleTime();
  return (
    <ChannelPanel>
      <ChatLine style={{}} person={cast.omar()} time={time(12)}>
        {t`Who is up for a match tonight?`}
      </ChatLine>
      <ChatLine style={props.style} time={time(14)}>
        {t`Count me in. Give me ten minutes.`}
      </ChatLine>
      <ChatLine style={{}} person={cast.lina()} time={time(15)}>
        {t`Nice new look, by the way.`}
      </ChatLine>
    </ChannelPanel>
  );
}

/** What a style looks like in a member list: your own row, on its own */
export function MembersScene(props: { style: UserStyle }) {
  const { t } = useLingui();
  return (
    <Panel>
      <PanelBar>
        <Icon name="users-three" size={16} />
        <span>{t`Online`}</span>
      </PanelBar>
      <Rows>
        <ListMember style={props.style} />
      </Rows>
    </Panel>
  );
}

const Blank = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    color: "var(--z-designs-on-art)",
    // the avatar scales its contents with it
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1,
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-designs-edge)",
    background: "var(--z-designs-page)",
  },
});

const PanelBar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "44px",
    paddingInline: "16px",
    borderBottom: "1px solid var(--z-designs-edge)",
    background: "var(--z-designs-well)",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-fg-muted)",
  },
});

const Lines = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-evenly",
    gap: "16px",
    padding: "16px",
  },
});

const Rows = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "8px",
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    height: "48px",
    paddingInline: "8px",
    borderRadius: "var(--z-shape-button, 10px)",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    "&[data-plate='true']": {
      position: "relative",
      height: "auto",
      aspectRatio: "448 / 84",
      color: "var(--z-designs-on-art)",
      textShadow: "0 0 2px rgb(0 0 0 / 60%), 0 1px 4px rgb(0 0 0 / 70%)",
      boxShadow: "inset 0 0 0 1px var(--z-designs-on-art-edge)",
    },
    "& > span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const RowAvatar = styled("span", {
  base: {
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    "& > i": {
      position: "absolute",
      insetBlockEnd: "0",
      insetInlineEnd: "0",
      zIndex: 2,
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      border: "2px solid var(--z-designs-page)",
      background: "var(--z-designs-status-online)",
    },
  },
});
