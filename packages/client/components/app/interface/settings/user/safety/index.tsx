import { Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Client } from "@zrzur/sdk/solid";

import { SafetyAccess, safetyApi } from "../../../safety/safetyApi";
import { Buttons, Notice, Stack } from "../../../safety/styles";

import { SafetyDashboard } from "./SafetyDashboard";

export { ReportsAndStanding } from "./ReportsAndStanding";

const [access, setAccess] = createSignal<SafetyAccess>();
let loading: Promise<unknown> | undefined;

/**
 * Whether the signed-in user may review reports. Only decides whether the
 * entry is shown; the server checks every request.
 */
export function safetyAccess(client: Client) {
  if (!access() && !loading && client.user) {
    loading = safetyApi
      .access(client)
      .then(setAccess)
      .catch(() => setAccess({ review: false, action: false, manage: false }))
      .finally(() => (loading = undefined));
  }
  return access();
}

/** Settings page that opens the review dashboard */
export function SafetyReviewPage() {
  const [open, setOpen] = createSignal(false);
  return (
    <Show when={access()?.review}>
      <Stack>
        <Notice>
          <Trans>
            Reports from users about content and accounts across Zrzur.
            Everything you open and decide is recorded on the case. Keep
            reporter identities and evidence inside this team.
          </Trans>
        </Notice>
        <Buttons>
          <button type="button" data-primary onClick={() => setOpen(true)}>
            <Trans>Open the review dashboard</Trans>
          </button>
        </Buttons>
        {/* mounted only while open: a closed Dialog still covers the
            screen with a click-catching surface */}
        <Show when={open()}>
          <SafetyDashboard
            show
            onClose={() => setOpen(false)}
            access={access()!}
          />
        </Show>
      </Stack>
    </Show>
  );
}
