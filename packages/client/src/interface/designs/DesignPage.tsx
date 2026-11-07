import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useOpenInApp } from "@revolt/app/interface/discover/OpenInApp";
import {
  designsUrl,
  publicReportUrl,
} from "@revolt/app/interface/discover/sites";
import {
  CreatorChip,
  useWearDesign,
} from "@revolt/app/interface/settings/user/profile/CommunityParts";
import { useStyleLabels } from "@revolt/app/interface/settings/user/profile/StyleEditors";
import {
  type CommunityItemDetails,
  communityApi,
  hasOpenPage,
} from "@revolt/app/interface/settings/user/profile/communityApi";
import { useClient, useClientLifecycle } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { ProfileEffect } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import {
  type UserStyle,
  DECORATIONS,
  NAMEPLATES,
  THEME_PRESETS,
  effectFileUrl,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { LOOKS, StyleCard, useLookText, useWear } from "./Looks";
import { Mirror } from "./Mirror";
import { useTryOn } from "./TryOn";
import { type DesignRef, designSlug, parseDesignSlug } from "./designSlug";
import type { WallFilter } from "./gallery";

type Resolved = {
  ref: DesignRef;
  kind: string;
  name: string;
  description?: string;
  /** what wearing it changes */
  style: UserStyle;
  /** the part of the wall that shows it */
  tab: WallFilter;
  community?: CommunityItemDetails;
};

/**
 * One design's own page: designs.zrzur.com/<slug> on the public site,
 * /designs/<slug> in the app. A large preview on a profile, what it is,
 * who made it, and one way to use it. A visitor without an account is
 * taken into the app, which brings them back to this design.
 */
export function DesignPage(props: {
  slug: string;
  site: boolean;
  /** "" on the site, "/designs" in the app */
  base: string;
  /** open the wall on one kind of design */
  onRoom: (tab: WallFilter) => void;
  onCreator: (id: string) => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { isLoggedIn } = useClientLifecycle();
  const { openModal } = useModals();
  const labels = useStyleLabels();
  const lookText = useLookText();
  const describeError = useError();
  const wear = useWear();
  const wearDesign = useWearDesign();
  const inApp = useOpenInApp();
  const tryOnState = useTryOn();
  const instance = useInstance();

  const [design] = createResource(
    () => props.slug,
    async (slug): Promise<Resolved | null> => {
      const ref = parseDesignSlug(slug);
      if (!ref) return null;
      switch (ref.kind) {
        case "look": {
          const look = LOOKS.find((entry) => entry.id === ref.id);
          if (!look) return null;
          const [name, description] = lookText(look.id);
          return {
            ref,
            kind: t`Profile look`,
            name,
            description,
            style: look.style,
            tab: "looks",
          };
        }
        case "decoration":
          if (!(DECORATIONS as readonly string[]).includes(ref.id)) return null;
          return {
            ref,
            kind: t`Avatar decoration`,
            name: labels.decoration(ref.id),
            style: { decoration: ref.id },
            tab: "decorations",
          };
        case "nameplate":
          if (!NAMEPLATES.some((entry) => entry.id === ref.id)) return null;
          return {
            ref,
            kind: t`Nameplate`,
            name: labels.nameplate(ref.id),
            style: { nameplate: ref.id },
            tab: "nameplates",
          };
        case "colours": {
          const preset = THEME_PRESETS.find((entry) => entry.id === ref.id);
          if (!preset) return null;
          return {
            ref,
            kind: t`Profile colours`,
            name: labels.theme(ref.id),
            style: { theme: preset.colours },
            tab: "colours",
          };
        }
        case "community": {
          const details = await communityApi
            .details(client(), ref.id)
            .catch(() => undefined);
          if (!details) return null;
          const made = details.item.kind;
          return {
            ref,
            kind:
              made === "Decoration"
                ? t`Avatar decoration`
                : made === "Effect"
                  ? t`Profile effect`
                  : t`Nameplate`,
            name: details.item.name,
            description: details.item.description,
            style:
              made === "Decoration"
                ? { decoration: `c:${ref.id}` }
                : made === "Effect"
                  ? { effect: `c:${ref.id}` }
                  : { nameplate: `c:${ref.id}` },
            tab: made === "Effect" ? "effects" : "community",
            community: details,
          };
        }
      }
    },
  );

  // the tab title names the page while it is open
  const previousTitle = document.title;
  onCleanup(() => (document.title = previousTitle));
  createEffect(() => {
    const item = design();
    if (item) document.title = t`${item.name} — Zrzur Designs`;
  });

  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [copied, setCopied] = createSignal(false);

  /** already part of the signed-in person's profile */
  const worn = () => {
    const item = design();
    const mine = userStyleOf(client().user);
    if (!item || !mine) return false;
    return Object.entries(item.style).every(([key, value]) =>
      Array.isArray(value)
        ? JSON.stringify(mine[key as keyof UserStyle]) === JSON.stringify(value)
        : mine[key as keyof UserStyle] === value,
    );
  };

  async function use(item: Resolved) {
    // no account here: the app takes over and brings them back
    if (!isLoggedIn())
      return inApp.open(`/designs/${designSlug(item.ref)}`, item.name);
    setBusy(true);
    setError(undefined);
    try {
      if (item.ref.kind === "community")
        await wearDesign(
          item.community!.item.kind === "Decoration"
            ? "decoration"
            : item.community!.item.kind === "Effect"
              ? "effect"
              : "nameplate",
          `c:${item.ref.id}`,
        );
      else {
        const look = LOOKS.find((entry) => entry.id === item.ref.id);
        if (item.ref.kind === "look" && look) await wear.look(look);
        else await wear.part(designSlug(item.ref), item.style);
      }
      if (wear.error()) setError(wear.error());
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const tryOn = (item: Resolved) => {
    if (!isLoggedIn())
      return inApp.open(`/designs/${designSlug(item.ref)}`, item.name);
    tryOnState.put({ ...item.style, ...communityFile(item) });
    props.onRoom(item.tab);
  };

  /** the image of a community design, so the preview can draw it */
  const communityFile = (item: Resolved): Partial<UserStyle> => {
    const found = item.community?.item;
    if (!found) return {};
    if (found.kind === "Effect") return { effect_file: found.file._id };
    return found.kind === "Decoration"
      ? { decoration_file: found.file._id }
      : { nameplate_file: found.file._id };
  };

  // an effect plays once when the page opens and again on demand
  const [replay, setReplay] = createSignal(0);
  const effectUrl = (item: Resolved) => {
    const found = item.community?.item;
    return found?.kind === "Effect"
      ? effectFileUrl(instance.mediaUrl, found.file._id)
      : undefined;
  };

  const pageUrl = (item: Resolved) =>
    `${props.site ? window.location.origin : designsUrl()}/${designSlug(item.ref)}`;

  /** A community design: signed in the dialog, otherwise the public form */
  const report = (item: Resolved) =>
    isLoggedIn()
      ? openModal({
          type: "report_content",
          client: client(),
          target: { kind: "CommunityItem", id: item.ref.id, label: item.name },
        })
      : window.location.assign(
          publicReportUrl("CommunityItem", pageUrl(item), i18n().locale),
        );

  const copyLink = (item: Resolved) =>
    navigator.clipboard
      ?.writeText(pageUrl(item))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);

  /** a few more of the same kind (built-in designs) */
  const similar = () => {
    const item = design();
    if (!item) return [];
    const pick = (kind: DesignRef["kind"], ids: string[]) =>
      ids
        .filter((id) => id !== item.ref.id)
        .slice(0, 5)
        .map((id) => ({ kind, id }) as DesignRef);
    switch (item.ref.kind) {
      case "look":
        return pick(
          "look",
          LOOKS.map((look) => look.id),
        );
      case "nameplate":
        return pick(
          "nameplate",
          NAMEPLATES.map((plate) => plate.id),
        );
      case "colours":
        return pick(
          "colours",
          THEME_PRESETS.map((preset) => preset.id),
        );
      default:
        return pick("decoration", [...DECORATIONS]);
    }
  };

  const styleOf = (ref: DesignRef): UserStyle => {
    if (ref.kind === "look")
      return LOOKS.find((look) => look.id === ref.id)?.style ?? {};
    if (ref.kind === "nameplate") return { nameplate: ref.id };
    if (ref.kind === "colours")
      return {
        theme: THEME_PRESETS.find((preset) => preset.id === ref.id)?.colours,
      };
    return { decoration: ref.id };
  };

  const nameOf = (ref: DesignRef) =>
    ref.kind === "look"
      ? lookText(ref.id)[0]
      : ref.kind === "nameplate"
        ? labels.nameplate(ref.id)
        : ref.kind === "colours"
          ? labels.theme(ref.id)
          : labels.decoration(ref.id);

  return (
    <Page>
      <Switch>
        <Match when={design.loading}>
          <Loading aria-busy="true">
            <span />
          </Loading>
        </Match>

        <Match when={!design()}>
          <Message>
            <Icon name="sparkle" size={32} />
            <strong>
              <Trans>This design isn't available.</Trans>
            </strong>
            <span>
              <Trans>
                It may have been taken down, or the link is mistyped.
              </Trans>
            </span>
            <a href={props.base || "/"}>
              <Trans>Browse Designs</Trans>
            </a>
          </Message>
        </Match>

        <Match when={design()}>
          {(item) => (
            <>
              <Crumbs aria-label={t`Breadcrumb`}>
                <a href={props.base || "/"}>
                  <Trans>Designs</Trans>
                </a>
                <Icon name="caret-right" size={14} data-mirror />
                <span>{item().kind}</span>
                <Icon name="caret-right" size={14} data-mirror />
                <span aria-current="page" dir="auto">
                  {item().name}
                </span>
              </Crumbs>

              <Columns>
                <Stage aria-label={t`Preview`}>
                  <Show
                    when={effectUrl(item())}
                    fallback={
                      <Mirror
                        style={{
                          ...item().style,
                          ...communityFile(item()),
                        }}
                      />
                    }
                  >
                    {(url) => (
                      <EffectStage
                        data-testid="effect-stage"
                        onPointerEnter={() => setReplay((n) => n + 1)}
                      >
                        <StyleCard style={{}} feature />
                        <ProfileEffect url={url()} play={replay()} />
                      </EffectStage>
                    )}
                  </Show>
                  <Show when={effectUrl(item())}>
                    <Ghost
                      type="button"
                      data-testid="effect-play"
                      onClick={() => setReplay((n) => n + 1)}
                    >
                      <Icon name="play" size={18} />
                      <Trans>Play again</Trans>
                    </Ghost>
                  </Show>
                  <small>
                    <Show
                      when={isLoggedIn()}
                      fallback={<Trans>Shown on a sample profile.</Trans>}
                    >
                      <Trans>Shown on your own profile.</Trans>
                    </Show>
                  </small>
                </Stage>

                <Aside>
                  <Heading>
                    <span>{item().kind}</span>
                    <h1>
                      <bdi>{item().name}</bdi>
                    </h1>
                    <Show when={item().description}>
                      <p dir="auto">{item().description}</p>
                    </Show>
                  </Heading>

                  <Price>
                    <span data-free>
                      <Trans>Free</Trans>
                    </span>
                  </Price>

                  <Actions aria-live="polite">
                    <Show
                      when={!worn()}
                      fallback={
                        <Done>
                          <Icon name="check" size={18} />
                          <Trans>On your profile now</Trans>
                        </Done>
                      }
                    >
                      <Primary
                        type="button"
                        disabled={busy()}
                        data-busy={busy()}
                        onClick={() => use(item())}
                      >
                        <Trans>Use this design</Trans>
                      </Primary>
                    </Show>
                    <Show when={!props.site}>
                      <Secondary type="button" onClick={() => tryOn(item())}>
                        <Trans>Try it in the fitting room</Trans>
                      </Secondary>
                    </Show>
                    <Show when={error()}>
                      <ErrorText role="alert">{error()}</ErrorText>
                    </Show>
                    <Show when={!isLoggedIn()}>
                      <small>
                        <Trans>
                          You need an account to use it. After you sign in, the
                          app opens on this design.
                        </Trans>
                      </small>
                    </Show>
                  </Actions>

                  <Details>
                    <Show when={item().community?.creator}>
                      {(creator) => (
                        <>
                          <dt>
                            <Trans>Made by</Trans>
                          </dt>
                          <dd>
                            <Show
                              when={hasOpenPage(creator())}
                              fallback={
                                <CreatorChip creator={creator()} size={22} />
                              }
                            >
                              <button
                                type="button"
                                onClick={() => props.onCreator(creator()._id)}
                              >
                                <CreatorChip creator={creator()} size={22} />
                              </button>
                            </Show>
                          </dd>
                        </>
                      )}
                    </Show>
                    <Show when={!item().community}>
                      <dt>
                        <Trans>Made by</Trans>
                      </dt>
                      <dd>
                        <Trans>The Zrzur team</Trans>
                      </dd>
                    </Show>
                    <dt>
                      <Trans>Link</Trans>
                    </dt>
                    <dd dir="ltr">
                      {pageUrl(item()).replace(/^https?:\/\//, "")}
                    </dd>
                  </Details>

                  <Ghost type="button" onClick={() => copyLink(item())}>
                    <Icon name={copied() ? "check" : "link"} size={18} />
                    <Show when={copied()} fallback={<Trans>Copy link</Trans>}>
                      <Trans>Copied</Trans>
                    </Show>
                  </Ghost>
                  <Show when={item().community}>
                    <Ghost
                      type="button"
                      data-design-report
                      onClick={() => report(item())}
                    >
                      <Icon name="flag" size={18} />
                      <Trans>Report</Trans>
                    </Ghost>
                  </Show>
                </Aside>
              </Columns>

              <Show when={similar().length}>
                <More>
                  <h2>
                    <Trans>More like this</Trans>
                  </h2>
                  <div>
                    <For each={similar()}>
                      {(ref) => (
                        <a href={`${props.base}/${designSlug(ref)}`}>
                          <StyleCard style={styleOf(ref)} compact />
                          <span dir="auto">{nameOf(ref)}</span>
                        </a>
                      )}
                    </For>
                  </div>
                </More>
              </Show>
            </>
          )}
        </Match>
      </Switch>
      {inApp.dialog()}
    </Page>
  );
}

const EffectStage = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    maxWidth: "360px",
    marginInline: "auto",
    aspectRatio: "9 / 16",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    background: "var(--z-bg-app)",
  },
});

const Page = styled("article", {
  base: {
    width: "100%",
    maxWidth: "1200px",
    marginInline: "auto",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    color: "var(--z-fg-primary)",
  },
});

const Crumbs = styled("nav", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "& a": {
      color: "var(--z-fg-secondary)",
      textDecoration: "none",
      "&:hover": { color: "var(--z-fg-primary)" },
      "@media (max-width: 760px)": {
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
      },
    },
    "& [aria-current]": { color: "var(--z-fg-primary)", fontWeight: 600 },
    "&:dir(rtl) [data-mirror]": { transform: "scaleX(-1)" },
  },
});

const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: "40px",
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "24px",
    },
  },
});

const Stage = styled("section", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& > small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Aside = styled("aside", {
  base: { display: "flex", flexDirection: "column", gap: "20px" },
});

const Heading = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& > span": {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
    "& h1": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Price = styled("div", {
  base: {
    display: "flex",
    "& [data-free]": {
      height: "28px",
      paddingInline: "12px",
      borderRadius: "6px",
      background: "var(--z-designs-surface-raised)",
      fontSize: "13px",
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
    },
  },
});

const Actions = styled("div", {
  base: {
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    "& > small": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-muted)",
    },
  },
});

const button = {
  minHeight: "44px",
  paddingInline: "16px",
  borderRadius: "10px",
  font: "inherit",
  fontSize: "15px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
  "&:focus-visible": {
    outline: "2px solid var(--z-focus)",
    outlineOffset: "2px",
  },
} as const;

const Primary = styled("button", {
  base: {
    ...button,
    minHeight: "48px",
    fontSize: "16px",
    border: 0,
    background: "var(--z-accent-fill)",
    color: "var(--z-on-accent)",
    "&:hover:not(:disabled)": { background: "var(--z-accent-hover)" },
    "&:active:not(:disabled)": { background: "var(--z-accent-pressed)" },
    "&[data-busy='true']": { opacity: 0.7, cursor: "default" },
  },
});

const Secondary = styled("button", {
  base: {
    ...button,
    border: "1px solid var(--z-designs-edge-hover)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});

const Ghost = styled("button", {
  base: {
    ...button,
    alignSelf: "flex-start",
    minHeight: "36px",
    "@media (max-width: 760px)": { minHeight: "44px" },
    paddingInline: "12px",
    border: 0,
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    fontWeight: 400,
    "&:hover": { background: "var(--z-nav-hover)" },
  },
});

const Done = styled("div", {
  base: {
    minHeight: "48px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: 600,
    color: "var(--z-designs-status-online)",
    background:
      "color-mix(in srgb, var(--z-designs-status-online) 14%, transparent)",
  },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});

const Details = styled("dl", {
  base: {
    margin: 0,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: "12px 16px",
    fontSize: "14px",
    "& dt": { color: "var(--z-fg-muted)" },
    "& dd": { margin: 0, overflowWrap: "anywhere", textAlign: "start" },
    "& button": {
      border: 0,
      padding: 0,
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
    },
  },
});

const More = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& h2": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
    },
    "& > div": {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: "16px",
      _phone: {
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "8px",
      },
    },
    "& a": {
      padding: "12px",
      borderRadius: "14px",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-raised)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      color: "inherit",
      textDecoration: "none",
      fontSize: "14px",
      fontWeight: 600,
      "&:hover": { borderColor: "var(--z-designs-edge-hover)" },
      "&:focus-visible": {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
  },
});

const Message = styled("div", {
  base: {
    maxWidth: "480px",
    margin: "80px auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
    "& strong": { fontSize: "18px", color: "var(--z-fg-primary)" },
    "& a": { color: "var(--z-accent-text)", fontWeight: 600 },
  },
});

const Loading = styled("div", {
  base: {
    height: "360px",
    borderRadius: "14px",
    background: "var(--z-bg-raised)",
    animation: "skeletonPulse 1.4s ease-in-out infinite",
    _motionReduce: { animation: "none" },
  },
});
