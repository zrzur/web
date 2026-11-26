import {
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { Dialog } from "@revolt/ui";

import { useCommunityPermissions } from "./CommunityParts";
import { CreatorSuspension } from "./CreatorSuspension";
import {
  type CommunityItem,
  type CommunityKind,
  type CommunityPermissions,
  communityApi,
  communityFramesOpen,
} from "./communityApi";
import { StudioDesign } from "./studio/StudioDesign";
import { StudioEditor } from "./studio/StudioEditor";
import { StudioHome } from "./studio/StudioHome";
import { Callout } from "./studio/parts";
import type { StudioStep } from "./studio/studioModel";

/** Where the creator is inside the studio */
export type StudioRoute =
  | { view: "home" }
  | { view: "new"; kind?: CommunityKind }
  | { view: "design"; id: string }
  | { view: "edit"; id: string; step?: StudioStep };

const KINDS: readonly string[] = [
  "decorations",
  "nameplates",
  "effects",
  "frames",
];

/** `/designs/studio/...` after "studio", as a place in the studio */
export function studioRoute(path: readonly string[]): StudioRoute {
  const [first, second] = path;
  if (!first) return { view: "home" };
  if (first === "new")
    return {
      view: "new",
      kind: KINDS.includes(second) ? (second as CommunityKind) : undefined,
    };
  if (second === "edit") return { view: "edit", id: first };
  if (second === "rights") return { view: "edit", id: first, step: "rights" };
  return { view: "design", id: first };
}

/** The address of a place in the studio, after "/studio" */
export function studioPath(route: StudioRoute): string {
  switch (route.view) {
    case "home":
      return "";
    case "new":
      return route.kind ? `/new/${route.kind}` : "/new";
    case "design":
      return `/${encodeURIComponent(route.id)}`;
    case "edit":
      return `/${encodeURIComponent(route.id)}/${route.step === "rights" ? "rights" : "edit"}`;
  }
}

/**
 * Creator Studio: a creator's own designs in every state, the six steps that
 * make a new one or a new version, and one page per design with its history.
 * Only for users staff made creators; the server checks again on every
 * request.
 */
export function CreatorStudio(props: {
  show: boolean;
  onClose: () => void;
  perms: CommunityPermissions;
  avatar?: string;
  name: string;
  /** a full page inside Designs instead of a window */
  page?: boolean;
  /** as a page: what follows "/studio" in the address */
  path?: string[];
  /** as a page: go to a place in the studio (what follows "/studio") */
  onNavigate?: (path: string) => void;
  /** open the guide to designing a profile frame */
  onFrameGuide?: () => void;
}) {
  const client = useClient();
  const access = useCommunityPermissions();

  // as a window the studio keeps its place itself
  const [local, setLocal] = createSignal<StudioRoute>({ view: "home" });
  const route = createMemo(() =>
    props.path && props.onNavigate ? studioRoute(props.path) : local(),
  );
  const go = (to: StudioRoute) =>
    props.path && props.onNavigate
      ? props.onNavigate(studioPath(to))
      : setLocal(to);

  // only creators have designs
  const [mine, { refetch, mutate }] = createResource(
    () => !!props.perms.creator,
    () => communityApi.mine(client()),
  );
  const items = () => (mine.error ? [] : (mine() ?? []));
  const find = (id: string) => items().find((item) => item._id === id);

  // suspended: they see their designs and change nothing (owner, 2026-11-06)
  const readOnly = () =>
    !!props.perms.creator && props.perms.creator !== "Active";
  const effects = () =>
    (
      client().configuration?.features as
        | { community_effects?: boolean }
        | undefined
    )?.community_effects === true;

  function changed(item: CommunityItem | undefined, id: string) {
    mutate((list) => {
      const rest = (list ?? []).filter((entry) => entry._id !== id);
      return item ? [item, ...rest] : rest;
    });
    if (!item) go({ view: "home" });
  }

  let search: HTMLInputElement | undefined;

  // N starts a design, F finds one; only on the studio's first page
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!props.show || route().view !== "home") return;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;
      // a window over the studio owns the keys
      if (
        document.querySelector("[role='dialog'], [aria-modal='true']") &&
        props.page
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "n" && !readOnly()) {
        event.preventDefault();
        go({ view: "new" });
      } else if (key === "f") {
        event.preventDefault();
        search?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const shared = () => ({
    avatar: props.avatar,
    name: props.name,
    dialog: !props.page,
    onLeave: props.onClose,
  });

  /** a design named in the address that the list does not hold */
  const missing = (id: string) => !mine.loading && !find(id);

  const content = (
    <>
      <Show when={props.perms.creator === "Revoked"}>
        <Callout tone="info">
          <Trans>
            You're no longer a creator. Your published designs stay up, but you
            can't submit new ones.
          </Trans>
        </Callout>
      </Show>
      <Show when={props.perms.creator === "Suspended"}>
        <CreatorSuspension />
      </Show>

      <Switch>
        <Match when={route().view === "new" && !readOnly()}>
          <StudioEditor
            {...shared()}
            kind={(route() as { kind?: CommunityKind }).kind}
            effects={effects()}
            frames={communityFramesOpen(client())}
            onFrameGuide={props.onFrameGuide}
            onBack={() => go({ view: "home" })}
            onSaved={(item) => changed(item, item._id)}
            onDone={(item) => {
              changed(item, item._id);
              go({ view: "design", id: item._id });
            }}
            onRankRefused={access.refresh}
          />
        </Match>

        {/* by id, not by object: saving a draft must not start the editor anew */}
        <Match
          when={
            route().view === "edit" &&
            !readOnly() &&
            find((route() as { id: string }).id)?._id
          }
          keyed
        >
          {(id) => (
            <StudioEditor
              {...shared()}
              item={untrack(() => find(id))}
              step={(route() as { step?: StudioStep }).step}
              effects={effects()}
              frames={communityFramesOpen(client())}
              onFrameGuide={props.onFrameGuide}
              onBack={() => go({ view: "design", id })}
              onSaved={(next) => changed(next, next._id)}
              onDone={(next) => {
                changed(next, next._id);
                go({ view: "design", id: next._id });
              }}
              onRankRefused={access.refresh}
            />
          )}
        </Match>

        <Match
          when={
            route().view === "design" && find((route() as { id: string }).id)
          }
        >
          {(item) => (
            <StudioDesign
              {...shared()}
              item={item()}
              perms={props.perms}
              readOnly={readOnly()}
              onBack={() => go({ view: "home" })}
              onEdit={(target, step) =>
                go({ view: "edit", id: target._id, step })
              }
              onChanged={changed}
              onRankRefused={access.refresh}
            />
          )}
        </Match>

        <Match
          when={
            route().view !== "home" && route().view !== "new" && mine.loading
          }
        >
          <Callout tone="info">
            <Trans>Loading…</Trans>
          </Callout>
        </Match>

        <Match when={true}>
          <Show
            when={
              route().view !== "home" &&
              route().view !== "new" &&
              missing((route() as { id: string }).id)
            }
          >
            <Callout tone="error" testid="studio-missing">
              <Trans>
                That design isn't in your studio. It may have been deleted.
              </Trans>
            </Callout>
          </Show>
          <StudioHome
            {...shared()}
            items={items()}
            loading={mine.loading}
            failed={!!mine.error}
            onRetry={() => void refetch()}
            perms={props.perms}
            readOnly={readOnly()}
            effects={effects()}
            frames={communityFramesOpen(client())}
            onFrameGuide={props.onFrameGuide}
            onNew={() => go({ view: "new" })}
            onOpen={(item) => go({ view: "design", id: item._id })}
            onEdit={(item) => go({ view: "edit", id: item._id })}
            searchRef={(input) => (search = input)}
          />
        </Match>
      </Switch>
    </>
  );

  return (
    <Show
      when={props.page}
      fallback={
        <Dialog
          tone="create"
          iconName="sparkle"
          show={props.show}
          onClose={props.onClose}
          title={<Trans>Creator Studio</Trans>}
          size="xl"
        >
          {content}
        </Dialog>
      }
    >
      {content}
    </Show>
  );
}
