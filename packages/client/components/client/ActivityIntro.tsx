import { Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { TranslatedError } from "@revolt/i18n/errors";
import { Dialog, Text } from "@revolt/ui";

import { useClient } from ".";
import { richPresenceEnabled, setActivitySharing } from "./ActivityWorker";
import {
  type IntroPrivacy as Privacy,
  shouldAskAboutActivity,
} from "./activityIntroRule";

/**
 * Activity sharing is off for everyone until the person turns it on (legal
 * RP-01). Once, after the server turns the feature on, this asks: two
 * buttons of the same weight. "Not now" only notes that the question was
 * seen, so it never comes back; it turns nothing on. Settings → Activity
 * changes it at any time.
 */
export function ActivityIntro() {
  const { t } = useLingui();
  const client = useClient();
  const [open, setOpen] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();

  createEffect(
    on(
      () => client(),
      (current) => {
        if (!current || !richPresenceEnabled(current)) return;
        current.users
          .fetchPrivacy()
          .then((privacy) =>
            setOpen(shouldAskAboutActivity(privacy as Privacy)),
          )
          .catch(() => {
            // asked again next time the app starts
          });
      },
    ),
  );

  async function answer(turnOn: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const after = (await client().users.editPrivacy(
        (turnOn
          ? { share_activity: true, activity_intro_seen: true }
          : { activity_intro_seen: true }) as never,
      )) as Privacy;
      setActivitySharing(after.share_activity === true);
      setOpen(false);
    } catch (err) {
      if (!turnOn) {
        // "Not now" never keeps the person here; the question may come back
        setOpen(false);
        return;
      }
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={open()}>
      <Dialog
        show
        size="sm"
        persistent
        onClose={() => void answer(false)}
        title={<Trans>Show what you are playing?</Trans>}
        error={error() ? <TranslatedError error={error()} /> : undefined}
        actions={[
          {
            text: t({ message: "Not now", context: "activity" }),
            variant: "secondary",
            isDisabled: busy(),
            onClick: () => {
              void answer(false);
              return false;
            },
          },
          {
            text: t({ message: "Turn on", context: "activity" }),
            variant: "secondary",
            isDisabled: busy(),
            onClick: () => {
              void answer(true);
              return false;
            },
          },
        ]}
      >
        <Text class="body" size="medium">
          <span data-testid="activity-intro">
            <Trans>
              Friends and people in your servers would see the game or app you
              are using. It stays off until you choose.
            </Trans>
          </span>
        </Text>
      </Dialog>
    </Show>
  );
}
