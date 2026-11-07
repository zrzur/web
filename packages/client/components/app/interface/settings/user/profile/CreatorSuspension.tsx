import { Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Button, TextField } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { safetyApi } from "../../../safety/safetyApi";

import { useDate } from "./CommunityParts";
import { communityApi } from "./communityApi";

const APPEAL_MIN = 10;
const APPEAL_MAX = 2000;

/**
 * What a suspended creator needs in one place: why, since when, and a way
 * to appeal through the same path as any other decision.
 */
export function CreatorSuspension() {
  const { t } = useLingui();
  const client = useClient();
  const date = useDate();
  const [standing, { refetch }] = createResource(() =>
    communityApi.standing(client()),
  );
  const [writing, setWriting] = createSignal(false);
  const [statement, setStatement] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [short, setShort] = createSignal(false);
  const [failure, setFailure] = createSignal<unknown>();

  async function send() {
    const actionId = standing()?.action_id;
    if (busy() || !actionId) return;
    if (statement().trim().length < APPEAL_MIN) {
      setShort(true);
      return;
    }
    setBusy(true);
    setShort(false);
    setFailure(undefined);
    try {
      await safetyApi.appeal(client(), actionId, statement().trim());
      setWriting(false);
      await refetch();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Notice role="status">
      <Lead>
        <Icon name="info" size={16} />
        <Trans>
          Your creator access is paused. Your designs are hidden from everyone
          until it is lifted. You can still see them and download a copy.
        </Trans>
      </Lead>

      <Show when={standing()?.reason}>
        {(reason) => (
          <dl>
            <dt>
              <Trans>Reason</Trans>
            </dt>
            <dd dir="auto">{reason()}</dd>
            <Show when={standing()?.since}>
              {(since) => (
                <>
                  <dt>
                    <Trans>Since</Trans>
                  </dt>
                  <dd>{date(since())}</dd>
                </>
              )}
            </Show>
          </dl>
        )}
      </Show>

      <Show when={standing()?.appeal_status === "Pending"}>
        <p>
          <Trans>Your appeal is with a reviewer.</Trans>
        </p>
      </Show>
      <Show when={standing()?.appeal_status === "Upheld"}>
        <p dir="auto">
          <Trans>Your appeal was declined.</Trans>{" "}
          {standing()?.appeal_note ?? ""}
        </p>
      </Show>

      <Show when={standing()?.can_appeal}>
        <Show
          when={writing()}
          fallback={
            <div>
              <Button onPress={() => setWriting(true)}>
                <Trans>Appeal this decision</Trans>
              </Button>
            </div>
          }
        >
          <TextField
            label={t`Why should this decision change?`}
            rows={4}
            maxlength={APPEAL_MAX}
            counter
            dir="auto"
            value={statement()}
            onInput={(event) => setStatement(event.currentTarget.value)}
            error={short() ? t`Say in a sentence why.` : undefined}
          />
          <Show when={failure()}>
            <TranslatedError error={failure()} />
          </Show>
          <Actions>
            <Button isDisabled={busy()} onPress={() => void send()}>
              <Trans>Send appeal</Trans>
            </Button>
            <Button variant="plain" onPress={() => setWriting(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </Actions>
        </Show>
      </Show>
    </Notice>
  );
}

const Notice = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    lineHeight: "20px",
    "--z-icon-color": "var(--z-fg-muted)",
    "& p": { margin: 0 },
    "& dl": {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: "4px 12px",
      margin: 0,
    },
    "& dt": { color: "var(--z-fg-muted)" },
    "& dd": { margin: 0, overflowWrap: "anywhere" },
  },
});

const Lead = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    "& > svg, & > span:first-child": { flexShrink: 0 },
  },
});

const Actions = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});
