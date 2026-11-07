import { For, Show, createResource, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { type ReviewItem, pluginApi } from "@revolt/plugins/api";
import {
  Button,
  Checkbox,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Card, ErrorText, Muted, PermissionList, Pre, Row } from "./common";
import { usePluginText } from "./text";

/** Queue for people with `plugins.review` */
export function ReviewTab() {
  const client = useClient();
  const [queue, { refetch }] = createResource(() => pluginApi.queue(client()));
  return (
    <SettingsSection
      title={<Trans>Review queue</Trans>}
      description={
        <Trans>
          Read the manifest, every permission and any code before approving.
          High-risk releases need an explicit confirmation. You can't approve
          your own plugin.
        </Trans>
      }
    >
      <Show
        when={queue()?.length}
        fallback={
          <SettingsRow
            icon={<Icon name="check-circle" size={20} />}
            title={
              queue.loading ? (
                <Trans>Loading…</Trans>
              ) : (
                <Trans>Nothing is waiting for review.</Trans>
              )
            }
          />
        }
      >
        <For each={queue()}>
          {(item) => <ReviewCard item={item} onDone={() => void refetch()} />}
        </For>
      </Show>
    </SettingsSection>
  );
}

function ReviewCard(props: { item: ReviewItem; onDone: () => void }) {
  const { t } = useLingui();
  const client = useClient();
  const text = usePluginText();
  const describeError = useError();
  const [reason, setReason] = createSignal("");
  const [acknowledged, setAcknowledged] = createSignal(false);
  const [verify, setVerify] = createSignal(false);
  const [showCode, setShowCode] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const release = () => props.item.release;
  const high = () => release().risk === "High";

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      props.onDone();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row>
        <strong style={{ flex: 1 }}>
          {props.item.plugin.name} v{release().version} ·{" "}
          <code>{props.item.plugin._id}</code>
        </strong>
        <SettingsStatus tone={high() ? "warning" : "neutral"}>
          {text.riskLabel(release().risk)}
        </SettingsStatus>
      </Row>
      <Muted>
        <Trans>Publisher:</Trans> {props.item.publisher?.username}#
        {props.item.publisher?.discriminator}
        <Show when={props.item.publisher?.verified}> ✓</Show>
        {" · "}
        {release().entrypoint} · {release().platforms.join(", ")} ·{" "}
        {(release().size / 1024).toFixed(1)} KB
        {" · "}sha256 <code>{release().package_sha256.slice(0, 16)}…</code>
      </Muted>
      <Show when={release().changelog}>
        <Muted>{release().changelog}</Muted>
      </Show>
      <PermissionList
        permissions={release().permissions}
        highlight={props.item.new_permissions}
      />
      <Show when={release().scan.length}>
        <ErrorText>
          {release()
            .scan.map(
              (s) =>
                `${s.block ? "BLOCK" : "note"} ${s.rule}: ${s.message} (line ${s.line})`,
            )
            .join("\n")}
        </ErrorText>
      </Show>
      <details>
        <summary>
          <Trans>Manifest</Trans>
        </summary>
        <Pre>{JSON.stringify(release().manifest, null, 2)}</Pre>
      </details>
      <Show when={release().code}>
        <Button size="sm" variant="text" onPress={() => setShowCode((v) => !v)}>
          {showCode() ? <Trans>Hide code</Trans> : <Trans>Show code</Trans>}
        </Button>
        <Show when={showCode()}>
          <Pre>{release().code}</Pre>
        </Show>
      </Show>
      <TextField
        label={t`Note to the publisher (required to reject)`}
        value={reason()}
        maxlength={1000}
        onInput={(e) => setReason(e.currentTarget.value)}
      />
      <Show when={high()}>
        <Checkbox
          checked={acknowledged()}
          onChange={(e) => setAcknowledged(e.currentTarget.checked)}
        >
          <Trans>
            I read the code and every permission, and it's safe to run.
          </Trans>
        </Checkbox>
      </Show>
      <Show when={!props.item.publisher?.verified}>
        <Checkbox
          checked={verify()}
          onChange={(e) => setVerify(e.currentTarget.checked)}
        >
          <Trans>I checked who the publisher is: mark them verified</Trans>
        </Checkbox>
      </Show>
      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>
      <Row>
        <Button
          variant="filled"
          isDisabled={busy() || (high() && !acknowledged())}
          onPress={() =>
            void run(() =>
              pluginApi.approve(client(), release()._id, {
                reason: reason().trim() || undefined,
                verify_publisher: verify(),
                acknowledge_high_risk: acknowledged(),
              }),
            )
          }
        >
          <Trans>Approve</Trans>
        </Button>
        <Button
          variant="_error"
          isDisabled={busy() || !reason().trim()}
          onPress={() =>
            void run(() =>
              pluginApi.reject(client(), release()._id, reason().trim()),
            )
          }
        >
          <Trans>Reject</Trans>
        </Button>
      </Row>
    </Card>
  );
}
