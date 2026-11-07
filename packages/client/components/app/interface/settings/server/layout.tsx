import { type JSX, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { type NeededPermission, missing } from "./permissionNeed";

export { type NeededPermission, missing };

/** The sentence that says why a section can be read but not changed */
function ReadOnlyReason(props: { permission: NeededPermission }) {
  const { t } = useLingui();
  const names: Record<NeededPermission, string> = {
    ManageServer: t`Manage server`,
    ManageChannel: t`Manage channel`,
    ManageRole: t`Manage roles`,
    ManageCustomisation: t`Manage customisation`,
    BanMembers: t`Ban members`,
    ManageWebhooks: t`Manage webhooks`,
    ViewAuditLogs: t`View audit log`,
  };
  // eslint-disable-next-line solid/reactivity
  const permission = names[props.permission];
  return (
    <ReadOnlyNote role="note" data-read-only={props.permission}>
      {t`You can see this but not change it. It needs the permission "${permission}".`}
    </ReadOnlyNote>
  );
}

/**
 * A section of a settings page: a title, one line saying what it is for,
 * then its controls. `id` is the address the settings search and old links
 * scroll to (data-section).
 */
export function Anchor(props: {
  id: string;
  title?: JSX.Element;
  description?: JSX.Element;
  /** Set when this person lacks the permission: shown, but not changeable */
  needs?: NeededPermission;
  children: JSX.Element;
}) {
  return (
    <SectionBox data-section={props.id} aria-labelledby={`sec-${props.id}`}>
      <Show when={props.title}>
        <Head>
          <h2 id={`sec-${props.id}`}>{props.title}</h2>
          <Show when={props.description}>
            <p>{props.description}</p>
          </Show>
        </Head>
      </Show>
      <Show when={props.needs}>
        {(permission) => <ReadOnlyReason permission={permission()} />}
      </Show>
      <Body
        // read-only: nothing inside can be reached or changed
        inert={props.needs ? true : undefined}
        data-read-only={props.needs ? "true" : undefined}
      >
        {props.children}
      </Body>
    </SectionBox>
  );
}

/** The sections of a page, one under another, with the same gap everywhere */
export const PageStack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    minWidth: 0,
  },
});

/** Sections with an optional side card (a live preview) that stays in view */
export function PageWithAside(props: {
  children: JSX.Element;
  aside: JSX.Element;
}) {
  return (
    <Grid>
      <PageStack>{props.children}</PageStack>
      <Aside>{props.aside}</Aside>
    </Grid>
  );
}

/** Note shown instead of controls someone may not change, with the reason */
export const ReadOnlyNote = styled("p", {
  base: {
    margin: 0,
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-soft)",
    background: "var(--z-bg-card, var(--z-bg-panel))",
    color: "var(--z-fg-muted)",
    fontSize: "14px",
    lineHeight: "20px",
  },
});

const SectionBox = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    scrollMarginTop: "16px",

    '&[data-flash="true"]': {
      animation: "none",
      outline: "2px solid var(--z-focus)",
      outlineOffset: "8px",
      borderRadius: "var(--z-radius-md, 10px)",
    },
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",

    "& h2": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "24px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,

    '&[data-read-only="true"]': {
      opacity: 0.6,
      userSelect: "text",
    },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: "24px",
    alignItems: "start",

    "@media (max-width: 1100px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});

const Aside = styled("aside", {
  base: {
    position: "sticky",
    top: "16px",

    "@media (max-width: 1100px)": {
      position: "static",
      order: -1,
    },
  },
});
