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

import { useActivityLabel } from "./ActivityLine";
import {
  type Activity,
  type ActivitySource,
  activityIcon,
  ownPicture,
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
 * focus and the time stay put. Pictures load only from Zrzur's servers;
 * buttons open through the link warning.
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
  const label = useActivityLabel();
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
  const picture = () =>
    ownPicture(props.activity.large_image, hosts()) ??
    ownPicture(props.activity.small_image, hosts());
  const started = () =>
    relativeTime(props.activity.started_at, clock(), i18n().locale);
  const ends = () =>
    relativeTime(props.activity.ends_at, clock(), i18n().locale, true);
  const facts = () =>
    [props.activity.details, props.activity.state].filter(Boolean).join(" · ");
  const buttons = createMemo(() =>
    (props.activity.buttons ?? [])
      .map((button) => ({
        label: button.label,
        url: safeButtonUrl(button.url),
      }))
      .filter((button): button is { label: string; url: URL } => !!button.url)
      .slice(0, 2),
  );
  const source = () =>
    props.activity.source === "Steam"
      ? t`From Steam`
      : props.activity.source === "Desktop"
        ? t`Seen by the Zrzur desktop app`
        : t`Reported by the app`;

  return (
    <div
      class={panel()}
      data-testid="profile-activity"
      data-source={props.activity.source}
    >
      <div class={head()}>
        <div class={tile()}>
          <Show
            when={picture()}
            fallback={
              <Symbol size={20} aria-hidden="true">
                {activityIcon(props.activity.type)}
              </Symbol>
            }
          >
            {(url) => (
              <img
                src={url()}
                alt=""
                title={
                  props.activity.large_text ??
                  props.activity.small_text ??
                  undefined
                }
                loading="lazy"
                referrerpolicy="no-referrer"
                class={image()}
              />
            )}
          </Show>
        </div>
        <div class={lines()}>
          <strong class={cx(cutLine(), title())} dir="auto">
            {label(props.activity)}
          </strong>
          <Show when={facts()}>
            <span class={cx(cutLine(), fact())} dir="auto">
              {facts()}
            </span>
          </Show>
          <span class={meta()} data-testid="activity-time">
            <Show
              when={ends()}
              fallback={
                <Show when={started()}>
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
            <Show when={started() || ends()}>
              <span aria-hidden="true"> · </span>
            </Show>
            <span>{source()}</span>
          </span>
        </div>
      </div>
      <Show when={buttons().length}>
        <div class={row()}>
          <For each={buttons()}>
            {(button) => (
              <button
                class={cx(chip({ press: true }), wide())}
                type="button"
                title={button.url.toString()}
                onClick={() =>
                  openModal({
                    type: "link_warning",
                    url: button.url,
                    display: button.url.toString(),
                  })
                }
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
      <Show when={props.activity.source === "Steam" && picture()}>
        <p class={credit()}>
          {t`From Steam. Steam is a trademark of Valve Corporation; Zrzur is not affiliated with Valve. Game pictures, achievement names and icons belong to their owners.`}
        </p>
      </Show>
    </div>
  );
}

const head = cva({
  base: { display: "flex", alignItems: "center", gap: "8px", minWidth: 0 },
});

/* the same 36 px tile as a game on the Steam card */
const tile = cva({
  base: {
    flexShrink: 0,
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--z-radius-xs, 4px)",
    background: "var(--profile-chip, var(--z-bg-input))",
    overflow: "hidden",
    "--z-icon-color": "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const image = cva({
  base: { width: "36px", height: "36px", objectFit: "cover" },
});

const lines = cva({
  base: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
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
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const meta = cva({
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
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
