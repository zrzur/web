import {
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { createMfaResource } from "@revolt/client/resources";
import { useModals } from "@revolt/modal";
import {
  Button,
  Column,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  Time,
  useSnackbar,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type DataExportInfo,
  type DownloadApi,
  type RawApi,
  canDownload,
  canRequest,
  fetchDataExport,
  fetchDataExportFile,
  requestDataExport,
  waitParts,
} from "./api";

/** Put a file the person asked for into their downloads */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * My data: ask for a ZIP copy of your data. The server prepares it in the
 * background and e-mails you when it is ready; you download it here, signed
 * in, for 7 days.
 */
export function MyData() {
  const client = useClient();
  const mfa = createMfaResource();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { mfaFlow, showError } = useModals();
  const [busy, setBusy] = createSignal(false);
  // counts the wait down without asking the server again
  const [now, setNow] = createSignal(Date.now());
  const [loadFailed, setLoadFailed] = createSignal(false);

  const api = () => client().api as unknown as RawApi;

  // a server that can't answer shows the page without the status instead of
  // breaking it
  const [info, { mutate, refetch }] = createResource<
    DataExportInfo | undefined
  >(async () => {
    try {
      setLoadFailed(false);
      return await fetchDataExport(api());
    } catch {
      setLoadFailed(true);
      return undefined;
    }
  });
  const loadedAt = Date.now();

  const timer = setInterval(() => {
    setNow(Date.now());
    if (info()?.status === "pending") refetch();
  }, 5000);
  onCleanup(() => clearInterval(timer));

  /** Fresh confirmation: password or two-factor code */
  async function confirm() {
    if (!mfa.data) {
      snackbar.show({ message: t`Still loading. Try again in a moment.` });
      return undefined;
    }
    return mfaFlow(mfa.data);
  }

  async function request() {
    const ticket = await confirm();
    if (!ticket) return;

    setBusy(true);
    try {
      mutate(await requestDataExport(api(), ticket.token));
      snackbar.show({ message: t`We're preparing your copy.` });
    } catch (error) {
      showError(error);
      refetch();
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    try {
      saveFile(
        await fetchDataExportFile(client().api as unknown as DownloadApi),
        "zrzur-data.zip",
      );
    } catch {
      // plain words; the technical status code helps nobody here
      snackbar.show({
        message: t`We couldn't download your copy. Please try again.`,
      });
      refetch();
    } finally {
      setBusy(false);
    }
  }

  /** Seconds left of the wait, counted down locally */
  const secondsLeft = () =>
    Math.max(
      0,
      (info()?.next_request_in_seconds ?? 0) -
        Math.floor((now() - loadedAt) / 1000),
    );
  const wait = () => waitParts(secondsLeft());
  const requestable = () =>
    canRequest(info()) && secondsLeft() === 0 && !busy();
  const contact = () => info()?.contact_email ?? "privacy@zrzur.com";

  return (
    <Column gap="xl">
      <SettingsSection
        title={<Trans>My data</Trans>}
        description={
          <Trans>
            Get a ZIP file with your account, profile, messages you sent, files
            you uploaded, servers, purchases, reports you filed, support
            requests and settings.
          </Trans>
        }
      >
        <SettingsRow
          icon={<Icon name="download-simple" size={20} />}
          title={<Trans>Request a copy</Trans>}
          description={
            <Switch
              fallback={
                <Trans>
                  We prepare it in the background and e-mail you when it's
                  ready. You can ask once every 24 hours.
                </Trans>
              }
            >
              <Match when={info()?.status === "pending"}>
                <Trans>
                  Your copy is being prepared. This page updates by itself.
                </Trans>
              </Match>
              <Match
                when={
                  info() && info()?.status !== "pending" && secondsLeft() > 0
                }
              >
                <Trans>
                  You can ask again in {wait().hours} h {wait().minutes} min.
                </Trans>
              </Match>
            </Switch>
          }
          control={() => (
            <Button
              size="sm"
              isDisabled={mfa.isLoading || info.loading || !requestable()}
              onPress={request}
            >
              <Trans>Request a copy</Trans>
            </Button>
          )}
        />

        <Show when={loadFailed()}>
          <SettingsRow
            icon={<Icon name="warning" size={20} />}
            title={<Trans>This page couldn't load</Trans>}
            description={
              <Trans>Check your connection and try again.</Trans>
            }
            control={() => (
              <Button size="sm" variant="outlined" onPress={() => refetch()}>
                <Trans>Try again</Trans>
              </Button>
            )}
          />
        </Show>

        <Show when={info()?.status === "failed"}>
          <SettingsRow
            icon={<Icon name="warning" size={20} />}
            title={<Trans>It didn't work</Trans>}
            description={
              <Trans>
                We couldn't prepare your copy. Ask again, or write to{" "}
                {contact()} and we will answer within one month.
              </Trans>
            }
          />
        </Show>

        <Show when={canDownload(info())}>
          <SettingsRow
            icon={<Icon name="download-simple" size={20} />}
            title={<Trans>Your copy is ready</Trans>}
            description={
              <>
                <Trans>Available until</Trans>{" "}
                <Time value={info()?.expires_at ?? ""} format="datetime" />
                {". "}
                <Trans>Then the file is deleted.</Trans>
              </>
            }
            control={() => (
              <Button
                size="sm"
                variant="outlined"
                isDisabled={busy()}
                onPress={download}
              >
                <Trans>Download</Trans>
              </Button>
            )}
          />
          <SettingsStatus tone="success">
            <Trans>Ready</Trans>
          </SettingsStatus>
        </Show>

        <SettingsRow
          icon={<Icon name="info" size={20} />}
          title={<Trans>If you sent a lot of messages</Trans>}
          description={
            <Trans>
              The file holds the newest 50,000 messages you sent. For the rest,
              write to {contact()}; we answer within one month.
            </Trans>
          }
        />
      </SettingsSection>
    </Column>
  );
}
