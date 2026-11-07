import { Trans, useLingui } from "@lingui/solid/macro";
import { withoutNull } from "@zrzur/sdk/solid";
import { createResource, createSignal, For, Show } from "solid-js";

import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Button, SettingsSection } from "@revolt/ui";

type ChangeRequest = {
  _id: string;
  reason: string;
  changes: {
    display_name?: string;
    pronouns?: string;
    status_text?: string;
    bio?: string;
    remove?: string[];
  };
  expires_at: number;
};

/**
 * Changes to your profile that Zrzur asked you to agree to. Nothing
 * changes unless you accept; shown only while a request is waiting.
 */
export function ChangeRequests() {
  const client = useClient();
  const { t } = useLingui();
  const describeError = useError();
  const [requests, { refetch }] = createResource(() =>
    client().api.get("/users/@me/change-requests").then(withoutNull),
  );
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const field = (name: string) =>
    ({
      Avatar: t`Avatar`,
      ProfileBackground: t`Profile banner`,
      DisplayName: t`Display name`,
      Pronouns: t`Pronouns`,
      StatusText: t`Status text`,
      ProfileContent: t`Bio`,
    })[name] ?? name;

  const lines = (r: ChangeRequest) => {
    const c = r.changes;
    const out: string[] = [];
    if (c.display_name) out.push(`${t`Display name`}: ${c.display_name}`);
    if (c.pronouns) out.push(`${t`Pronouns`}: ${c.pronouns}`);
    if (c.status_text) out.push(`${t`Status text`}: ${c.status_text}`);
    if (c.bio) out.push(`${t`Bio`}: ${c.bio}`);
    for (const f of c.remove ?? []) out.push(t`Remove: ${field(f)}`);
    return out;
  };

  const answer = async (id: string, accept: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await client()
        .api.post(`/users/@me/change-requests/${id}`, { accept })
        .then(withoutNull);
      await refetch();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Show when={(requests() ?? []).length > 0}>
      <SettingsSection
        title={<Trans>Requests from Zrzur</Trans>}
        description={
          <Trans>
            Zrzur asks you to agree to these changes to your profile. Nothing
            changes unless you accept.
          </Trans>
        }
      >
        <For each={requests()}>
          {(r) => (
            <div
              class={css({
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "16px",
                borderRadius: "12px",
                background: "var(--md-sys-color-surface-container-high)",
              })}
            >
              <p dir="auto" class={css({ whiteSpace: "pre-wrap" })}>
                {r.reason}
              </p>
              <ul class={css({ margin: 0, paddingInlineStart: "20px" })}>
                <For each={lines(r)}>
                  {(line) => <li dir="auto">{line}</li>}
                </For>
              </ul>
              <small>
                <Trans>
                  Answer by {new Date(r.expires_at).toLocaleDateString()}.
                  Without an answer, nothing changes.
                </Trans>
              </small>
              <div
                class={css({ display: "flex", gap: "8px", flexWrap: "wrap" })}
              >
                <Button
                  isDisabled={busy() !== null}
                  onPress={() => void answer(r._id, true)}
                >
                  <Trans>Accept change</Trans>
                </Button>
                <Button
                  variant="tonal"
                  isDisabled={busy() !== null}
                  onPress={() => void answer(r._id, false)}
                >
                  <Trans>Decline</Trans>
                </Button>
              </div>
            </div>
          )}
        </For>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
      </SettingsSection>
    </Show>
  );
}
