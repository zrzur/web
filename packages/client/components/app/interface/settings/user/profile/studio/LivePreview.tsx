import { For, Match, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Avatar } from "@revolt/ui";
import { useEffectsAllowed } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { sampleAvatar } from "@revolt/ui/components/features/profiles/sampleAvatars";

import { DecorationArt, EffectArt, NameplateArt } from "../CommunityParts";
import type { CommunityKind } from "../communityApi";
import { plateMarks } from "../studioTemplates";

/** Where a design is shown before it is sent */
export type PreviewPlace = "profile" | "members" | "message" | "sizes";

/** The places that make sense for each type, the first one opens */
export const PREVIEW_PLACES: Record<CommunityKind, PreviewPlace[]> = {
  decorations: ["profile", "members", "message", "sizes"],
  nameplates: ["members", "sizes"],
  effects: ["profile"],
};

/** Avatar sizes the app draws a decoration at */
const AVATAR_SIZES = [24, 32, 40, 64, 96];
const PLATE_MARKS = plateMarks();

/**
 * A design in the places people will see it: on a profile card, in the member
 * list beside other members, on a chat message and at every avatar size, on a
 * dark or a light ground. Nothing here talks to the server; it draws whatever
 * address it is given, so a gallery of finished designs can use it too.
 */
export function LivePreview(props: {
  kind: CommunityKind;
  /** the art: an object URL of a picked file, or a stored design */
  url: string;
  /** a WebM not uploaded yet: the image is only made on upload */
  video?: boolean;
  place: PreviewPlace;
  ground: "dark" | "light";
  /** where the avatar and the name will sit, over the raw art */
  guides?: boolean;
  avatar?: string;
  name: string;
}) {
  const { t } = useLingui();
  const allowed = useEffectsAllowed();
  const others = () => [
    { name: t`Yusuf`, avatar: sampleAvatar(1) },
    { name: t`Sara`, avatar: sampleAvatar(2) },
  ];

  const decorated = (size: number) => (
    <DecorationArt
      url={props.url}
      avatar={props.avatar}
      name={props.name}
      size={size}
    />
  );

  return (
    <Ground data-ground={props.ground} data-testid="studio-preview">
      <Switch>
        <Match when={props.video}>
          <Video
            data-testid="webm-preview"
            src={props.url}
            muted
            playsinline
            autoplay={allowed()}
            loop={props.kind !== "effects"}
            controls={!allowed()}
          />
        </Match>

        <Match when={props.guides && props.kind === "decorations"}>
          <GuideRing data-testid="studio-guides">
            <span>
              <img src={props.url} alt="" draggable={false} />
            </span>
            <i />
          </GuideRing>
        </Match>
        <Match when={props.guides && props.kind === "nameplates"}>
          <GuidePlate
            data-testid="studio-guides"
            style={{
              "--crop": PLATE_MARKS.crop,
              "--avatar-inset": PLATE_MARKS.avatarInset,
              "--avatar-size": PLATE_MARKS.avatarSize,
              "--name-inset": PLATE_MARKS.nameInset,
              "--name-size": PLATE_MARKS.nameSize,
              "--name-edge": PLATE_MARKS.nameEdge,
            }}
          >
            <span>
              <img src={props.url} alt="" draggable={false} />
            </span>
            <i data-side="start" />
            <i data-side="end" />
            <b data-side="start" />
            <b data-side="end" />
          </GuidePlate>
        </Match>

        <Match when={props.kind === "effects"}>
          <ProfileCard data-place="profile">
            <Banner />
            <CardBody>
              <Avatar size={64} src={props.avatar} fallback={props.name} />
              <strong>
                <bdi>{props.name}</bdi>
              </strong>
              <p>
                <Trans>The effect plays once when this profile opens.</Trans>
              </p>
            </CardBody>
            <EffectLayer>
              <EffectArt url={props.url} label={props.name} />
            </EffectLayer>
          </ProfileCard>
        </Match>

        <Match when={props.place === "profile"}>
          <ProfileCard data-place="profile">
            <Banner />
            <CardBody>
              {decorated(64)}
              <strong>
                <bdi>{props.name}</bdi>
              </strong>
              <p>
                <Trans>This is how your decoration looks on a profile.</Trans>
              </p>
            </CardBody>
          </ProfileCard>
        </Match>

        <Match when={props.place === "members" && props.kind === "nameplates"}>
          <Members data-place="members">
            <NameplateArt
              url={props.url}
              avatar={props.avatar}
              name={props.name}
            />
            {/* both directions: the fade follows the name's language */}
            <div dir="rtl">
              <NameplateArt
                url={props.url}
                avatar={sampleAvatar(1)}
                name="سارة الحسن"
              />
            </div>
            <div dir="ltr">
              <NameplateArt
                url={props.url}
                avatar={sampleAvatar(2)}
                name="Sara Hassan"
              />
            </div>
            <For each={others()}>
              {(member) => (
                <MemberRow>
                  <Avatar size={30} src={member.avatar} />
                  <span>{member.name}</span>
                </MemberRow>
              )}
            </For>
          </Members>
        </Match>

        <Match when={props.place === "members"}>
          <Members data-place="members">
            <MemberRow>
              {decorated(32)}
              <span>
                <bdi>{props.name}</bdi>
              </span>
            </MemberRow>
            <For each={others()}>
              {(member) => (
                <MemberRow>
                  <Avatar size={32} src={member.avatar} />
                  <span>{member.name}</span>
                </MemberRow>
              )}
            </For>
          </Members>
        </Match>

        <Match when={props.place === "message"}>
          <Messages data-place="message">
            <MessageRow>
              {decorated(40)}
              <div>
                <strong>
                  <bdi>{props.name}</bdi>
                </strong>
                <p>
                  <Trans>Good evening, everyone.</Trans>
                </p>
              </div>
            </MessageRow>
            <MessageRow>
              <Avatar size={40} src={others()[0].avatar} />
              <div>
                <strong>{others()[0].name}</strong>
                <p>
                  <Trans>Nice frame. Is it new?</Trans>
                </p>
              </div>
            </MessageRow>
          </Messages>
        </Match>

        <Match when={props.place === "sizes" && props.kind === "nameplates"}>
          <Members data-place="sizes">
            <NameplateArt
              url={props.url}
              avatar={props.avatar}
              name={props.name}
            />
            <NameplateArt
              url={props.url}
              avatar={props.avatar}
              name={props.name}
              small
            />
          </Members>
        </Match>

        <Match when={props.place === "sizes"}>
          <Sizes data-place="sizes">
            <For each={AVATAR_SIZES}>
              {(size) => (
                <figure>
                  {decorated(size)}
                  <figcaption dir="ltr">{size}</figcaption>
                </figure>
              )}
            </For>
          </Sizes>
        </Match>
      </Switch>
    </Ground>
  );
}

/** the ground a design is judged on: a profile's dark, or the light theme */
const Ground = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    minHeight: "400px",
    padding: "40px 24px",
    background: "var(--z-designs-art-ground, var(--z-bg-sidebar))",
    color: "var(--z-designs-on-art, var(--z-fg-primary))",
    "--studio-card": "var(--z-bg-raised)",
    "--studio-banner": "var(--z-nav-selected)",
    "--studio-soft": "var(--z-designs-on-art-muted, var(--z-fg-secondary))",
    "&[data-ground='light']": {
      background: "var(--z-designs-art-light, var(--z-bg-raised))",
      color: "var(--z-designs-on-light, var(--z-fg-primary))",
      "--studio-card": "var(--z-designs-on-art, var(--z-bg-raised))",
      "--studio-banner":
        "color-mix(in srgb, var(--z-designs-on-light, currentColor) 14%, transparent)",
      "--studio-soft":
        "color-mix(in srgb, var(--z-designs-on-light, currentColor) 68%, transparent)",
    },
    _phone: { minHeight: "320px", padding: "32px 16px" },
  },
});

const Video = styled("video", {
  base: { display: "block", maxWidth: "100%", maxHeight: "360px" },
});

const ProfileCard = styled("div", {
  base: {
    position: "relative",
    width: "min(100%, 300px)",
    borderRadius: "var(--z-shape-card, 14px)",
    overflow: "hidden",
    background: "var(--studio-card)",
    boxShadow: "var(--z-shadow-floating, 0 12px 32px rgb(0 0 0 / 0.45))",
  },
});

const Banner = styled("div", {
  base: { height: "84px", background: "var(--studio-banner)" },
});

const CardBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "0 20px 20px",
    marginBlockStart: "-32px",
    "& strong": {
      marginBlockStart: "20px",
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--studio-soft)",
    },
  },
});

const EffectLayer = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    "& > span": {
      height: "100%",
      maxHeight: "none",
      aspectRatio: "auto",
      background: "transparent",
      borderRadius: 0,
      pointerEvents: "auto",
    },
  },
});

const Members = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "min(100%, 280px)",
  },
});

const MemberRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "48px",
    paddingInline: "10px",
    fontSize: "14px",
    fontWeight: 600,
    "& > span:last-child": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
  },
});

const Messages = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    width: "min(100%, 360px)",
  },
});

const MessageRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    "& strong": { fontSize: "15px", lineHeight: "22px", fontWeight: 600 },
    "& p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "22px",
      color: "var(--studio-soft)",
    },
  },
});

const Sizes = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "32px",
    "& figure": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "20px",
      margin: 0,
    },
    "& figcaption": { fontSize: "12px", color: "var(--studio-soft)" },
  },
});

const GuideRing = styled("div", {
  base: {
    position: "relative",
    width: "min(100%, 320px)",
    aspectRatio: "1",
    outline: "1px dashed currentColor",
    "& > span": {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
    },
    "& img": { display: "block", width: "100%", height: "100%" },
    // the avatar is two thirds of the artwork, centred
    "& i": {
      position: "absolute",
      inset: "16.67%",
      borderRadius: "50%",
      border: "2px dashed var(--z-focus)",
    },
  },
});

const GuidePlate = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    aspectRatio: "1024 / 192",
    outline: "1px dashed currentColor",
    "& > span": { position: "absolute", inset: 0, overflow: "hidden" },
    "& img": { display: "block", width: "100%", height: "100%" },
    // what the member row crops
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      insetInline: 0,
      zIndex: 1,
      height: "var(--crop)",
      background: "rgb(0 0 0 / 0.5)",
      pointerEvents: "none",
    },
    "&::before": { top: 0 },
    "&::after": { bottom: 0 },
    // where the avatar and the name sit, in both directions
    "& i": {
      position: "absolute",
      zIndex: 1,
      top: "50%",
      width: "var(--avatar-size)",
      aspectRatio: "1",
      transform: "translateY(-50%)",
      borderRadius: "50%",
      border: "2px dashed var(--z-focus)",
    },
    "& i[data-side='start']": { left: "var(--avatar-inset)" },
    "& i[data-side='end']": { right: "var(--avatar-inset)" },
    "& b": {
      position: "absolute",
      zIndex: 1,
      top: "var(--name-edge)",
      bottom: "var(--name-edge)",
      width: "var(--name-size)",
      border: "1px dashed currentColor",
      opacity: 0.7,
    },
    "& b[data-side='start']": { left: "var(--name-inset)" },
    "& b[data-side='end']": { right: "var(--name-inset)" },
  },
});
