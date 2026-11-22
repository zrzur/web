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
  activityIcon,
  elapsedText,
  ownPicture,
  progress,
  remainingText,
  safeButtonUrl,
  shownActivities,
} from "./activityText";

/* One clock for every timer on screen, ticking only while one is shown */
const [now, setNow] = createSignal(Date.now());
let watchers = 0;
let ticker: ReturnType<typeof setInterval> | undefined;
function useNow() {
  onMount(() => {
    watchers++;
    setNow(Date.now());
    ticker ??= setInterval(() => setNow(Date.now()), 1000);
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

/**
 * What the person is doing right now, on the profile card and the full
 * profile: one panel per activity, the main one first. Pictures load only
 * from Zrzur's servers; buttons open through the link warning.
 */
export function ProfileActivity(props: { user: User }) {
  const activities = createMemo(() =>
    shownActivities(props.user.activities as Activity[] | undefined),
  );

  return (
    <Show when={activities().length}>
      <ProfileSection title={<Trans>Activity</Trans>}>
        <For each={activities()}>
          {(activity) => <ActivityPanel activity={activity} />}
        </For>
      </ProfileSection>
    </Show>
  );
}

function ActivityPanel(props: { activity: Activity }) {
  const { t } = useLingui();
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
  const large = () => ownPicture(props.activity.large_image, hosts());
  const small = () => ownPicture(props.activity.small_image, hosts());
  const elapsed = () => elapsedText(props.activity, clock());
  const left = () => remainingText(props.activity, clock());
  const share = () => progress(props.activity, clock());
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
    <div class={panel()} data-testid="profile-activity">
      <div class={head()}>
        <div class={art()}>
          <Show
            when={large()}
            fallback={
              <Symbol size={24} aria-hidden="true">
                {activityIcon(props.activity.type)}
              </Symbol>
            }
          >
            {(url) => (
              <img
                src={url()}
                alt={props.activity.large_text ?? ""}
                title={props.activity.large_text ?? undefined}
                loading="lazy"
                referrerpolicy="no-referrer"
                class={picture()}
              />
            )}
          </Show>
          <Show when={small()}>
            {(url) => (
              <img
                src={url()}
                alt={props.activity.small_text ?? ""}
                title={props.activity.small_text ?? undefined}
                loading="lazy"
                referrerpolicy="no-referrer"
                class={badge()}
              />
            )}
          </Show>
        </div>
        <div class={lines()}>
          <span class={cx(cutLine(), title())} dir="auto">
            {label(props.activity)}
          </span>
          <Show when={props.activity.details}>
            <span class={cx(cutLine(), body())} dir="auto">
              {props.activity.details}
            </span>
          </Show>
          <Show when={props.activity.state}>
            <span class={cx(cutLine(), body())} dir="auto">
              {props.activity.state}
            </span>
          </Show>
          <span class={meta()}>
            <Show
              when={left()}
              fallback={
                <Show when={elapsed()}>
                  {(time) => (
                    <span data-testid="activity-elapsed">
                      {t`for ${time()}`}
                    </span>
                  )}
                </Show>
              }
            >
              {(time) => <span>{t`${time()} left`}</span>}
            </Show>
            <Show when={elapsed() || left()}>
              <span aria-hidden="true">·</span>
            </Show>
            <span>{source()}</span>
          </span>
        </div>
      </div>
      <Show when={share() !== undefined}>
        <div
          class={track()}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((share() ?? 0) * 100)}
          aria-label={t`Time gone`}
        >
          <div class={fill()} style={{ width: `${(share() ?? 0) * 100}%` }} />
        </div>
      </Show>
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
    </div>
  );
}

const head = cva({
  base: { display: "flex", alignItems: "center", gap: "12px", minWidth: 0 },
});

const art = cva({
  base: {
    position: "relative",
    flexShrink: 0,
    width: "56px",
    height: "56px",
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--profile-chip, var(--z-bg-input))",
    "--z-icon-color": "var(--z-fg-secondary)",
  },
});

const picture = cva({
  base: {
    width: "56px",
    height: "56px",
    objectFit: "cover",
    borderRadius: "var(--z-radius, 10px)",
  },
});

const badge = cva({
  base: {
    position: "absolute",
    insetInlineEnd: "-4px",
    insetBlockEnd: "-4px",
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    objectFit: "cover",
    border: "2px solid var(--profile-panel, var(--z-bg-raised))",
    background: "var(--z-bg-raised)",
  },
});

const lines = cva({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
});

const title = cva({
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--profile-ink, var(--z-fg-primary))",
  },
});

const body = cva({
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const meta = cva({
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
    fontVariantNumeric: "tabular-nums",
  },
});

const track = cva({
  base: {
    height: "4px",
    borderRadius: "999px",
    background: "var(--profile-line, var(--z-border-subtle))",
    overflow: "hidden",
  },
});

const fill = cva({
  base: {
    height: "100%",
    borderRadius: "999px",
    background: "var(--profile-ink-2, var(--z-fg-secondary))",
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
  base: { flex: 1, justifyContent: "center" },
});
