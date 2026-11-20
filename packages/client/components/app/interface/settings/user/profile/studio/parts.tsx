import { JSX, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import {
  CommunityImage,
  DecorationArt,
  EffectArt,
  NameplateArt,
} from "../CommunityParts";
import type {
  CommunityItem,
  CommunityKind,
  CommunityStatus,
} from "../communityApi";

/** The studio's words for states, types and history entries */
export function useStudioWords() {
  const { t } = useLingui();
  return {
    status: (status: CommunityStatus) =>
      ({
        Draft: t`Draft`,
        PendingReview: t`In review`,
        ChangesRequested: t`Changes needed`,
        Published: t`Published`,
        Rejected: t`Rejected`,
        Suspended: t`Taken down`,
        Archived: t`Withdrawn`,
      })[status],
    kind: (kind: CommunityKind) =>
      ({
        decorations: t`Avatar decoration`,
        nameplates: t`Nameplate`,
        effects: t`Profile effect`,
      })[kind],
    /** a line of a design's history, said to its creator */
    action: (action: string) =>
      (
        ({
          Submit: t`Sent for review`,
          Publish: t`You published it`,
          Approve: t`A reviewer approved it`,
          Reject: t`A reviewer rejected it`,
          RequestChanges: t`A reviewer asked for changes`,
          Suspend: t`A reviewer took it down`,
          Archive: t`Withdrawn`,
          Restore: t`Taken back as a draft`,
          Override: t`Reopened for review`,
        }) as Record<string, string>
      )[action] ?? action,
  };
}

/** A state as a dot and a word; the colour says whose move it is */
export function StatusMark(props: { status: CommunityStatus }) {
  const words = useStudioWords();
  return (
    <Mark data-status={props.status} data-testid="studio-status">
      {words.status(props.status)}
    </Mark>
  );
}

/** A design's art, small, in the list and beside its history */
export function Thumb(props: {
  item: CommunityItem;
  /** the creator is suspended: published files answer them alone */
  private?: boolean;
  avatar?: string;
  name: string;
  large?: boolean;
}) {
  const file = () =>
    props.item.status === "Published" ? props.item.pending?.file : undefined;
  return (
    <ThumbBox data-kind={props.item.kind} data-large={props.large}>
      <CommunityImage item={props.item} file={file()} private={props.private}>
        {(url) =>
          props.item.kind === "Decoration" ? (
            <DecorationArt
              url={url}
              avatar={props.avatar}
              name={props.name}
              size={props.large ? 96 : 32}
            />
          ) : props.item.kind === "Effect" ? (
            <EffectArt url={url} label={props.item.name} />
          ) : (
            <NameplateArt
              url={url}
              avatar={props.avatar}
              name={props.name}
              small={!props.large}
            />
          )
        }
      </CommunityImage>
    </ThumbBox>
  );
}

/** Something that waits for the creator, or went wrong */
export function Callout(props: {
  tone: "warning" | "error" | "info";
  title?: JSX.Element;
  children: JSX.Element;
  action?: JSX.Element;
  testid?: string;
}) {
  return (
    <CalloutBox
      data-tone={props.tone}
      role={props.tone === "error" ? "alert" : "status"}
      data-testid={props.testid}
    >
      <Icon
        name={props.tone === "info" ? "info" : "warning-circle"}
        size={20}
      />
      <div>
        <Show when={props.title}>
          <strong>{props.title}</strong>
        </Show>
        <p dir="auto">{props.children}</p>
      </div>
      <Show when={props.action}>{props.action}</Show>
    </CalloutBox>
  );
}

export const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    width: "100%",
    maxWidth: "1200px",
    marginInline: "auto",
    paddingBlock: "24px 72px",
    containerType: "inline-size",
    color: "var(--z-fg-primary)",
    "&[data-dialog]": { paddingBlock: "0 8px" },
  },
});

export const Crumbs = styled("nav", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    "& button": {
      padding: 0,
      border: "none",
      background: "none",
      font: "inherit",
      color: "var(--z-fg-secondary)",
      cursor: "pointer",
      borderRadius: "var(--z-radius-xs, 6px)",
      _hover: { color: "var(--z-fg-primary)" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { minHeight: "44px" },
    },
    "& b": {
      fontWeight: 500,
      color: "var(--z-fg-secondary)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      maxWidth: "24ch",
    },
  },
});

export const PageHead = styled("header", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    "& > div:first-child": { flex: "1 1 320px", minWidth: 0 },
    "& h1": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      overflowWrap: "anywhere",
      _phone: { fontSize: "22px", lineHeight: "30px" },
    },
    "& p": {
      margin: "4px 0 0",
      maxWidth: "560px",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

/** actions of a page head or a bar: one row, full width on a phone */
export const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    _phone: {
      width: "100%",
      "& > button": { flex: "1 1 auto", minHeight: "44px" },
    },
  },
});

export const Panel = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    padding: "20px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    "& > h2": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
    },
    "& > p": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    _phone: { padding: "16px" },
  },
});

/** label on one side, value on the other */
export const SpecList = styled("dl", {
  base: {
    display: "flex",
    flexDirection: "column",
    margin: 0,
    "& > div": {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "16px",
      paddingBlock: "8px",
      borderBlockStart: "1px solid var(--z-border-subtle)",
      fontSize: "14px",
      lineHeight: "22px",
    },
    "& > div:first-child": { borderBlockStart: "none", paddingBlockStart: 0 },
    "& > div:last-child": { paddingBlockEnd: 0 },
    "& dt": { color: "var(--z-fg-secondary)", flex: "none" },
    "& dd": {
      margin: 0,
      minWidth: 0,
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      fontWeight: 500,
      textAlign: "end",
      overflowWrap: "anywhere",
      "--z-icon-color": "currentColor",
    },
    "& dd[data-state='ok'] svg": { color: "var(--z-status-success)" },
    "& dd[data-state='warn']": { color: "var(--z-status-warning)" },
    "& dd[data-state='fail']": { color: "var(--z-danger)" },
  },
});

const Mark = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    color: "var(--z-fg-secondary)",
    "&::before": {
      content: '""',
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "currentColor",
    },
    "&[data-status='Published']": { color: "var(--z-status-success)" },
    "&[data-status='PendingReview']": { color: "var(--z-link)" },
    "&[data-status='ChangesRequested']": { color: "var(--z-status-warning)" },
    "&[data-status='Rejected'], &[data-status='Suspended']": {
      color: "var(--z-danger)",
    },
    "&[data-status='Archived']": { color: "var(--z-fg-muted)" },
  },
});

const ThumbBox = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    flex: "none",
    width: "88px",
    height: "56px",
    padding: "4px",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    background: "var(--z-designs-art-ground, var(--z-bg-app))",
    "&[data-kind='Effect'] > span": { height: "48px" },
    "&[data-large='true']": {
      width: "100%",
      height: "auto",
      minHeight: "240px",
      padding: "24px",
      "&[data-kind='Effect'] > span": { height: "320px" },
    },
    _phone: { width: "64px", height: "48px" },
  },
});

const CalloutBox = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px 20px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    borderInlineStart: "3px solid var(--z-status-warning)",
    background: "var(--z-box-bg)",
    "--z-icon-color": "var(--z-status-warning)",
    "&[data-tone='error']": {
      borderInlineStartColor: "var(--z-danger)",
      "--z-icon-color": "var(--z-danger)",
    },
    "&[data-tone='info']": {
      borderInlineStartColor: "var(--z-border-strong)",
      "--z-icon-color": "var(--z-fg-secondary)",
    },
    "& > svg": { flex: "none", marginBlockStart: "2px" },
    "& > div": { flex: "1 1 240px", minWidth: 0 },
    "& strong": { display: "block", fontSize: "15px", fontWeight: 600 },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
    _phone: { padding: "16px", "& > button": { minHeight: "44px" } },
  },
});
