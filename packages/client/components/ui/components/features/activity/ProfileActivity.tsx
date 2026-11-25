import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { cva, cx } from "styled-system/css";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import { Symbol } from "../../utils/Symbol";
import { ProfileSection, chip, panel } from "../profiles/ProfileCard";
import { cutLine } from "../profiles/cutLine";

import { ActivityArt } from "./ActivityArt";
import { useActivityKind } from "./ActivityLineBody";
import {
  type Activity,
  type ActivitySource,
  ownPicture,
  pageLink,
  relativeTime,
  safeButtonUrl,
  shownActivities,
} from "./activityText";

/* One clock for every activity on screen; a relative time moves by the
   minute, so it ticks every 30 seconds and only while one is shown */
const [now, setNow] = createSignal(Date.now());
let watchers = 0;
let ticker: ReturnType<typeof setInterval> | undefined;
function useNow() {
  onMount(() => {
    watchers++;
    setNow(Date.now());
    ticker ??= setInterval(() => setNow(Date.now()), 30_000);
  });
  onCleanup(() => {
    watchers--;
    if (watchers <= 0 && ticker) {
      clearInterval(ticker);
      ticker = undefined;
      watchers = 0;
    }
  });
  return now;
}

const SOURCES: ActivitySource[] = ["Rpc", "Desktop", "Steam"];

/**
 * What the person is doing right now, on the profile card and the full
 * profile, in the same panel as the Steam games card: one row per source,
 * the main one first. Each source keeps its own row while it updates, so
 * focus and the time stay put. Each shows its real picture (a letter tile
 * without one; pictures load only from Zrzur's servers), what it is doing,
 * since when, and its links: the official page of a program the desktop
 * saw, or an app's own buttons, each through the link warning.
 */
export function ProfileActivity(props: { user: User }) {
  const activities = createMemo(() =>
    shownActivities(props.user.activities as Activity[] | undefined),
  );
  const bySource = (source: ActivitySource) =>
    activities().find((activity) => activity.source === source);
  const present = createMemo(() =>
    SOURCES.filter((source) => !!bySource(source)),
  );

  return (
    <Show when={activities().length}>
      <ProfileSection title={<Trans>Activity</Trans>}>
        <For each={present()}>
          {(source) => (
            <Show when={bySource(source)}>
              {(activity) => <ActivityPanel activity={activity()} />}
            </Show>
          )}
        </For>
      </ProfileSection>
    </Show>
  );
}

function ActivityPanel(props: { activity: Activity }) {
  const { t, i18n } = useLingui();
  const kind = useActivityKind();
  const client = useClient();
  const { openModal } = useModals();
  const clock = useNow();

  const hosts = () => {
    const features = client()?.configuration?.features;
    return [
      features?.january?.enabled ? features.january.url : undefined,
      features?.autumn?.url,
    ];
  };
  const large = () => ownPicture(props.activity.large_image, hosts());
  const small = () => ownPicture(props.activity.small_image, hosts());
  const started = () =>
    relativeTime(props.activity.started_at, clock(), i18n().locale);
  const ends = () =>
    relativeTime(props.activity.ends_at, clock(), i18n().locale, true);
  // the official page of a program the desktop saw, else an app's own buttons
  const page = createMemo(() => pageLink(props.activity));
  const buttons = createMemo(() =>
    page()
      ? []
      : (props.activity.buttons ?? [])
          .map((button) => ({
            label: button.label,
            url: safeButtonUrl(button.url),
          }))
          .filter(
            (button): button is { label: string; url: URL } => !!button.url,
          )
          .slice(0, 2),
  );
  const source = () =>
    props.activity.source === "Steam"
      ? t`From Steam`
      : props.activity.source === "Desktop"
        ? t`Seen by the Zrzur desktop app`
        : t`Reported by the app`;
  const open = (url: URL) =>
    openModal({ type: "link_warning", url, display: url.toString() });

  return (
    <div
      class={panel()}
      data-testid="profile-activity"
      data-source={props.activity.source}
    >
      <div class={head()}>
        <ActivityArt
          size="card"
          name={props.activity.name}
          src={large() ?? small()}
          badge={large() ? small() : undefined}
          badgeTitle={props.activity.small_text ?? undefined}
          title={props.activity.large_text ?? undefined}
        />
        <div class={lines()}>
          <span class={cx(cutLine(), caption())}>{kind(props.activity)}</span>
          <strong class={cx(cutLine(), title())} dir="auto">
            {props.activity.name}
          </strong>
          <Show when={props.activity.details}>
            <span class={cx(cutLine(), fact())} dir="auto">
              {props.activity.details}
            </span>
          </Show>
          <Show when={props.activity.state}>
            <span class={cx(cutLine(), fact())} dir="auto">
              {props.activity.state}
            </span>
          </Show>
          {/* where it comes from is one hover away, so the card stays short */}
          <span
            class={cx(cutLine(), meta())}
            data-testid="activity-time"
            title={source()}
          >
            <Show
              when={ends()}
              fallback={
                <Show when={started()} fallback={source()}>
                  {(time) =>
                    t({
                      message: `Started ${time()}`,
                      context: "activity",
                    })
                  }
                </Show>
              }
            >
              {(time) => t`Ends ${time()}`}
            </Show>
          </span>
        </div>
      </div>
      <Show when={page() || buttons().length}>
        <div class={row()}>
          <Show when={page()}>
            {(link) => (
              <button
                class={cx(chip({ press: true }), wide())}
                type="button"
                data-testid="activity-page-link"
                title={link().url.toString()}
                aria-label={t`Open the official page: ${link().host}`}
                onClick={() => open(link().url)}
              >
                <Symbol size={14} aria-hidden="true">
                  open_in_new
                </Symbol>
                <span dir="ltr">{link().host}</span>
              </button>
            )}
          </Show>
          <For each={buttons()}>
            {(button) => (
              <button
                class={cx(chip({ press: true }), wide())}
                type="button"
                title={button.url.toString()}
                onClick={() => open(button.url)}
              >
                <Symbol size={14} aria-hidden="true">
                  open_in_new
                </Symbol>
                <span dir="auto">{button.label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
      {/* a Steam picture carries Valve's credit (legal RP-05, T-11) */}
      <Show when={props.activity.source === "Steam" && (large() || small())}>
        <p class={credit()}>
          {t`From Steam. Steam is a trademark of Valve Corporation; Zrzur is not affiliated with Valve. Game pictures, achievement names and icons belong to their owners.`}
        </p>
      </Show>
    </div>
  );
}

const head = cva({
  base: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 },
});

const lines = cva({
  base: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
});

const caption = cva({
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const title = cva({
  base: {
    maxWidth: "100%",
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: "20px",
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});

const fact = cva({
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const meta = cva({
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
    fontVariantNumeric: "tabular-nums",
  },
});

const row = cva({
  base: {
    display: "flex",
    gap: "8px",
    minWidth: 0,
    _phone: { flexDirection: "column" },
  },
});

const wide = cva({
  base: { flex: 1, justifyContent: "center", _phone: { minHeight: "44px" } },
});

const credit = cva({
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});
