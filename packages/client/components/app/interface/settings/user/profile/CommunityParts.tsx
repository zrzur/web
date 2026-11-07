import { JSX, Show, createResource, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { Avatar } from "@revolt/ui";
import { ProfileEffect } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import {
  defaultAvatarFor,
  sampleAvatar,
  sampleAvatarFor,
} from "@revolt/ui/components/features/profiles/sampleAvatars";
import {
  communityFileUrl,
  effectFileUrl,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { FeatherField, WaveEdge } from "@revolt/ui/icons/PremiumArt";

import {
  CommunityCreator,
  CommunityItem,
  CommunityStatus,
  creatorName,
  fetchPrivateImage,
} from "./communityApi";

export { useCommunityPermissions } from "./creatorAccess";

/**
 * Wear a community design (or take one off with `undefined`) straight
 * away, keeping the rest of the user's look. Same shape the profile
 * editor saves.
 */
export function useWearDesign() {
  const client = useClient();
  return async (
    kind: "decoration" | "nameplate" | "effect",
    ref: string | undefined,
  ) => {
    const user = client().user!;
    const current = userStyleOf(user) ?? {};
    const next = { ...current, [kind]: ref };
    const style = {
      ...(next.theme?.length ? { theme: next.theme } : {}),
      ...(next.name_font ? { name_font: next.name_font } : {}),
      ...(next.name_colour?.length ? { name_colour: next.name_colour } : {}),
      ...(next.decoration ? { decoration: next.decoration } : {}),
      ...(next.nameplate ? { nameplate: next.nameplate } : {}),
      ...(next.effect ? { effect: next.effect } : {}),
      ...(next.effect && kind !== "effect" && next.effect_file
        ? { effect_file: next.effect_file }
        : {}),
    };
    await user.edit({ style });
  };
}

/** Translated review states */
export function useStatusLabel() {
  const { t } = useLingui();
  return (status: CommunityStatus) =>
    ({
      Draft: t`Draft`,
      PendingReview: t`Pending review`,
      ChangesRequested: t`Changes requested`,
      Published: t`Published`,
      Rejected: t`Rejected`,
      Suspended: t`Suspended`,
      Archived: t`Archived`,
    })[status];
}

/** Coloured pill with a review state */
export function StatusBadge(props: { status: CommunityStatus }) {
  const label = useStatusLabel();
  return <Badge data-status={props.status}>{label(props.status)}</Badge>;
}

/**
 * Premium head: pink to violet gradient, drifting outline feathers and a
 * wavy white line into the surface below. Matches the Plus screens.
 */
export function CommunityHead(props: {
  title: JSX.Element;
  children?: JSX.Element;
  /** surface colour under the wave */
  surface?: string;
  compact?: boolean;
}) {
  return (
    <Head data-compact={props.compact}>
      <Drift>
        <FeatherField endOnly />
      </Drift>
      <strong>{props.title}</strong>
      <Show when={props.children}>
        <p>{props.children}</p>
      </Show>
      <WaveEdge
        fill={props.surface ?? "var(--z-bg-modal, var(--z-bg-raised))"}
        height={props.compact ? 14 : 22}
      />
    </Head>
  );
}

/** Avatar URL of a creator */
export function useCreatorAvatar() {
  const instance = useInstance();
  // no picture of their own: our default art for that account, never a letter
  return (creator?: CommunityCreator) =>
    creator?.avatar
      ? `${instance.mediaUrl}/avatars/${creator.avatar._id}`
      : creator
        ? defaultAvatarFor(creator._id)
        : sampleAvatar(0);
}

/**
 * "by @creator" with their avatar. Opens their profile. Names are wrapped
 * in <bdi> so Latin names read right inside Arabic text.
 */
export function CreatorChip(props: {
  creator?: CommunityCreator;
  size?: number;
  /** show "Verified creator" next to the name */
  verbose?: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const avatar = useCreatorAvatar();

  async function open(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (!props.creator) return;
    const user =
      client().users.get(props.creator._id) ??
      (await client()
        .users.fetch(props.creator._id)
        .catch(() => undefined));
    if (user) openModal({ type: "user_profile", user });
  }

  return (
    <Show when={props.creator}>
      {(creator) => (
        <Chip
          role="link"
          tabIndex={0}
          title={t`View profile`}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") void open(e);
          }}
        >
          <Avatar size={props.size ?? 16} src={avatar(creator())} />
          <span>
            <Trans>
              by <bdi>{creatorName(creator())}</bdi>
            </Trans>
          </span>
          <Show when={props.verbose && creator().verified}>
            <Verified title={t`Verified creator`}>
              <Trans>Verified creator</Trans>
            </Verified>
          </Show>
        </Chip>
      )}
    </Show>
  );
}

/**
 * Image of a design. Published images come straight from the media
 * server; drafts and designs in review are fetched with the session (only
 * their creator and reviewers may see them) and shown as a local URL.
 */
export function CommunityImage(props: {
  item: CommunityItem;
  /** a pending revision's file instead of the current one */
  file?: API.File;
  /** the creator is suspended: their published file answers them alone */
  private?: boolean;
  children: (url: string) => JSX.Element;
}) {
  const client = useClient();
  const instance = useInstance();
  const file = () => props.file ?? props.item.file;
  const isPublic = () =>
    !props.private &&
    props.item.status === "Published" &&
    file()._id === props.item.file._id;
  const url = () =>
    (props.item.kind === "Effect"
      ? effectFileUrl(instance.mediaUrl, file()._id)
      : communityFileUrl(instance.mediaUrl, file()._id)) ?? "";

  const [privateUrl] = createResource(
    () => (isPublic() ? undefined : url()),
    (source) => fetchPrivateImage(client(), source).catch(() => ""),
  );
  onCleanup(() => {
    const value = privateUrl();
    if (value) URL.revokeObjectURL(value);
  });

  return (
    <Show when={isPublic() ? url() : privateUrl()} fallback={<Placeholder />}>
      {(src) => props.children(src())}
    </Show>
  );
}

/**
 * An effect on a plain stage the shape of a profile. It plays when it opens
 * and whenever you point at it or focus it. A public item shows a still until
 * then; a private one has none, because the media server keeps it private.
 */
export function EffectArt(props: {
  url: string;
  still?: string;
  /** Change this to play again */
  play?: number;
  label?: string;
  /** in px; without it, the height of the parent */
  height?: number;
}) {
  const [hover, setHover] = createSignal(0);
  return (
    <EffectBox
      data-testid="effect-art"
      tabIndex={0}
      role="img"
      aria-label={props.label}
      style={props.height ? { height: `${props.height}px` } : undefined}
      onPointerEnter={() => setHover((n) => n + 1)}
      onFocus={() => setHover((n) => n + 1)}
    >
      <Show when={props.still}>
        <img src={props.still} alt="" draggable={false} />
      </Show>
      <ProfileEffect url={props.url} play={(props.play ?? 0) + hover()} />
    </EffectBox>
  );
}

const EffectBox = styled("span", {
  base: {
    position: "relative",
    display: "block",
    height: "100%",
    maxHeight: "480px",
    aspectRatio: "9 / 16",
    marginInline: "auto",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    background: "var(--z-bg-app)",
    "& > img:first-child": {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** A decoration drawn around an avatar */
export function DecorationArt(props: {
  url: string;
  avatar?: string;
  name: string;
  size: number;
}) {
  return (
    <span class="z-deco" style={{ "--deco-size": `${props.size}px` }}>
      <Avatar
        size={props.size}
        src={props.avatar ?? sampleAvatarFor(props.name)}
      />
      <img class="z-deco-art" src={props.url} alt="" draggable={false} />
    </span>
  );
}

/** A nameplate behind a member-list row */
export function NameplateArt(props: {
  url: string;
  avatar?: string;
  name: string;
  small?: boolean;
}) {
  return (
    <Plate
      data-small={props.small}
      style={{ "--plate": `url("${props.url}") center / cover no-repeat` }}
    >
      <Avatar
        size={props.small ? 22 : 30}
        src={props.avatar ?? sampleAvatarFor(props.name)}
      />
      <strong>
        <bdi>{props.name}</bdi>
      </strong>
    </Plate>
  );
}

/** Local date of a ms timestamp in the user's language */
export function useDate() {
  const { i18n } = useLingui();
  return (ms?: number) =>
    ms
      ? new Intl.DateTimeFormat(i18n().locale, { dateStyle: "medium" }).format(
          new Date(ms),
        )
      : "";
}

/** A text area that grows with its text */
export function Field(props: {
  label: JSX.Element;
  hint?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <FieldWrap>
      <span>{props.label}</span>
      {props.children}
      <Show when={props.hint}>
        <small>{props.hint}</small>
      </Show>
    </FieldWrap>
  );
}

/** Two-step confirm for destructive buttons */
export function useConfirm() {
  const [armed, setArmed] = createSignal<string>();
  return {
    armed,
    /** true on the second press */
    press: (key: string) => {
      if (armed() === key) {
        setArmed(undefined);
        return true;
      }
      setArmed(key);
      return false;
    },
  };
}

export const PINK_GRADIENT = "var(--z-accent-gradient)";

const Head = styled("div", {
  base: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "18px 20px 34px",
    borderRadius: "14px 14px 0 0",
    color: "#fff",
    textAlign: "start",
    background: "var(--z-accent-hero)",
    "& strong": { fontSize: "16px", fontWeight: 750 },
    "& p": {
      margin: 0,
      maxWidth: "52ch",
      fontSize: "13px",
      lineHeight: "18px",
      opacity: 0.92,
    },
    "&[data-compact='true']": {
      padding: "12px 16px 22px",
      "& strong": { fontSize: "14px" },
    },
  },
});

/** feathers stay on the side away from the text, in both directions */
const Drift = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    "&:dir(rtl)": { transform: "scaleX(-1)" },
  },
});

const Badge = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    height: "20px",
    paddingInline: "8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    "&[data-status='Published']": {
      background: "rgb(67 181 129 / 18%)",
      color: "var(--z-status-success, #55DCC8)",
    },
    "&[data-status='PendingReview']": {
      background: "color-mix(in srgb, var(--z-accent) 20%, transparent)",
      color: "var(--z-accent-light)",
    },
    "&[data-status='ChangesRequested']": {
      background: "rgb(245 196 81 / 18%)",
      color: "var(--z-accent)",
    },
    "&[data-status='Rejected'], &[data-status='Suspended']": {
      background: "color-mix(in srgb, var(--z-accent-deep) 18%, transparent)",
      color: "var(--z-danger)",
    },
  },
});

const Chip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    maxWidth: "100%",
    minWidth: 0,
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    cursor: "pointer",
    borderRadius: "999px",
    "& > span": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    _hover: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Verified = styled("em", {
  base: {
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: "11px",
    paddingInline: "6px",
    borderRadius: "999px",
    color: "#fff",
    background: PINK_GRADIENT,
    whiteSpace: "nowrap",
  },
});

const Placeholder = styled("span", {
  base: {
    display: "block",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "var(--z-bg-input)",
  },
});

const Plate = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    height: "48px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-sidebar, var(--z-bg-input))",
    color: "#fff",
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      zIndex: -1,
      background:
        "linear-gradient(90deg, rgb(0 0 0 / 30%), rgb(0 0 0 / 5%) 70%), var(--plate, transparent)",
      maskImage:
        "linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 55%) 30%, #000 65%)",
      WebkitMaskImage:
        "linear-gradient(90deg, transparent 0%, rgb(0 0 0 / 55%) 30%, #000 65%)",
    },
    "&:dir(rtl)::before": {
      maskImage:
        "linear-gradient(270deg, transparent 0%, rgb(0 0 0 / 55%) 30%, #000 65%)",
      WebkitMaskImage:
        "linear-gradient(270deg, transparent 0%, rgb(0 0 0 / 55%) 30%, #000 65%)",
    },
    "& strong": {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      fontSize: "14px",
      fontWeight: 650,
      textShadow: "0 1px 2px rgb(0 0 0 / 50%)",
    },
    "&[data-small='true']": {
      height: "36px",
      gap: "6px",
      paddingInline: "6px",
      "& strong": { fontSize: "12px" },
    },
  },
});

const FieldWrap = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    "& > span": {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
    },
    "& input, & textarea": {
      minHeight: "36px",
      padding: "8px 10px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
      unicodeBidi: "plaintext",
      outline: "none",
      resize: "vertical",
      _focus: { borderColor: "var(--z-focus)" },
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});
