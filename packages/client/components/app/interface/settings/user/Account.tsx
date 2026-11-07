import {
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient, useClientLifecycle } from "@revolt/client";
import {
  createMfaResource,
  createOwnProfileResource,
} from "@revolt/client/resources";
import { useModals } from "@revolt/modal";
import {
  Button,
  Column,
  Row,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  useSnackbar,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../Settings";

import { AgeSettings, ChangeRequests, UserSummary } from "./account/index";
import { PrivacySection } from "./Privacy";
import { type RawApi, fetchDataExport } from "./myData/api";

/**
 * Account Page
 */
export function MyAccount() {
  const client = useClient();
  const profile = createOwnProfileResource();
  const { navigate } = useSettingsNavigation();

  return (
    <Column gap="xl">
      <UserSummary
        user={client().user!}
        bannerUrl={profile.data?.animatedBannerURL}
        onEdit={() => navigate("profile")}
        showBadges
      />
      <ChangeRequests />
      <EditAccount />
      <PrivacySection />
      <Security onSessions={() => navigate("sessions")} />
      <ManageAccount />
    </Column>
  );
}

/**
 * Account information: username, email, password
 */
function EditAccount() {
  const client = useClient();
  const { t } = useLingui();
  const { openModal } = useModals();
  const [email, setEmail] = createSignal<string>();

  const editUsername = () =>
    openModal({ type: "edit_username", client: client() });
  const editEmail = () => openModal({ type: "edit_email", client: client() });
  const editPassword = () =>
    openModal({ type: "edit_password", client: client() });

  return (
    <SettingsSection title={<Trans>Account information</Trans>}>
      <SettingsRow
        icon={<Icon name="at" size={20} />}
        title={<Trans>Username</Trans>}
        description={client().user?.username}
        control={() => (
          <Button size="sm" variant="tonal" onPress={editUsername}>
            <Trans>Edit</Trans>
          </Button>
        )}
      />
      <SettingsRow
        icon={<Icon name="envelope" size={20} />}
        title={<Trans>Email</Trans>}
        description={
          // masked until the user explicitly asks to reveal it
          email() ?? "•••••••••••@•••••••••••"
        }
        control={() => (
          <Row gap="sm">
            <Show when={!email()}>
              <Button
                size="sm"
                variant="text"
                aria-label={t`Reveal email address`}
                onPress={() => client().account.fetchEmail().then(setEmail)}
              >
                <Icon name="eye" size={16} />
                <Trans>Reveal</Trans>
              </Button>
            </Show>
            <Button size="sm" variant="tonal" onPress={editEmail}>
              <Trans>Change</Trans>
            </Button>
          </Row>
        )}
      />
      <SettingsRow
        icon={<Icon name="password" size={20} />}
        title={<Trans>Password</Trans>}
        description={<Trans>Change the password you use to sign in.</Trans>}
        control={() => (
          <Button size="sm" variant="tonal" onPress={editPassword}>
            <Trans>Change</Trans>
          </Button>
        )}
      />
      <AgeSettings />
    </SettingsSection>
  );
}

/**
 * Security: authenticator app, recovery codes, sessions
 */
function Security(props: { onSessions: () => void }) {
  const client = useClient();
  const mfa = createMfaResource();
  const snackbar = useSnackbar();
  const { t } = useLingui();
  const { openModal, mfaFlow, mfaEnableTOTP, showError } = useModals();

  async function showRecoveryCodes() {
    const ticket = await mfaFlow(mfa.data!);
    if (!ticket) return;

    ticket
      .fetchRecoveryCodes()
      .then((codes) =>
        openModal({
          type: "mfa_recovery",
          mfa: mfa.data!,
          codes,
        }),
      )
      .catch(showError);
  }

  async function generateRecoveryCodes() {
    const ticket = await mfaFlow(mfa.data!);
    if (!ticket) return;

    ticket
      .generateRecoveryCodes()
      .then((codes) =>
        openModal({
          type: "mfa_recovery",
          mfa: mfa.data!,
          codes,
        }),
      )
      .catch(showError);
  }

  async function setupAuthenticatorApp() {
    const ticket = await mfaFlow(mfa.data!);
    if (!ticket) {
      snackbar.show({ message: t`MFA setup canceled.` });
      return;
    }
    const secret = await ticket!.generateAuthenticatorSecret();

    try {
      const enabled = await mfaEnableTOTP(
        secret,
        client().user!.username,
        (code) => mfa.data!.enableAuthenticator(code),
      );

      if (!enabled) {
        snackbar.show({ message: t`MFA setup canceled.` });
      }
    } catch (err) {
      if (err === "MFACancelled") {
        snackbar.show({ message: t`MFA setup canceled.` });
        return;
      }

      showError(err);
    }
  }

  function disableAuthenticatorApp() {
    mfaFlow(mfa.data!).then((ticket) =>
      ticket?.disableAuthenticator().catch(showError),
    );
  }

  const status = (enabled?: boolean) => (
    <Switch
      fallback={
        <SettingsStatus>
          <Trans>Not set up</Trans>
        </SettingsStatus>
      }
    >
      <Match when={mfa.isLoading}>
        <SettingsStatus>
          <Trans>Checking…</Trans>
        </SettingsStatus>
      </Match>
      <Match when={enabled}>
        <SettingsStatus tone="success">
          <Trans>Enabled</Trans>
        </SettingsStatus>
      </Match>
    </Switch>
  );

  return (
    <SettingsSection
      title={<Trans>Security</Trans>}
      description={
        <Trans>
          Two-factor authentication protects your account even if your password
          leaks.
        </Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="device-mobile" size={20} />}
        title={
          <Row gap="sm" align>
            <Trans>Authenticator app</Trans>
            {status(mfa.data?.authenticatorEnabled)}
          </Row>
        }
        description={
          <Trans>Sign in with a one-time code from your phone.</Trans>
        }
        control={() => (
          <Show
            when={!mfa.isLoading && mfa.data?.authenticatorEnabled}
            fallback={
              <Button
                size="sm"
                isDisabled={mfa.isLoading}
                onPress={setupAuthenticatorApp}
              >
                <Trans>Set up</Trans>
              </Button>
            }
          >
            <Button
              size="sm"
              variant="outlined"
              onPress={disableAuthenticatorApp}
            >
              <Trans>Remove</Trans>
            </Button>
          </Show>
        )}
      />
      <SettingsRow
        icon={<Icon name="key" size={20} />}
        title={
          <Row gap="sm" align>
            <Trans>Recovery codes</Trans>
            {status(mfa.data?.recoveryEnabled)}
          </Row>
        }
        description={
          <Trans>
            One-time backup codes for when you can't use your authenticator.
          </Trans>
        }
        control={() => (
          <Show
            when={!mfa.isLoading && mfa.data?.recoveryEnabled}
            fallback={
              <Button
                size="sm"
                variant="tonal"
                isDisabled={mfa.isLoading}
                onPress={generateRecoveryCodes}
              >
                <Trans>Generate</Trans>
              </Button>
            }
          >
            <Row gap="sm">
              <Button size="sm" variant="tonal" onPress={showRecoveryCodes}>
                <Trans>View</Trans>
              </Button>
              <Button
                size="sm"
                variant="text"
                onPress={generateRecoveryCodes}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: t`Replaces your current codes`,
                  },
                }}
              >
                <Trans>Reset</Trans>
              </Button>
            </Row>
          </Show>
        )}
      />
      <SettingsRow
        icon={<Icon name="desktop" size={20} />}
        title={<Trans>Sessions</Trans>}
        description={
          <Trans>See where you're signed in and sign out devices.</Trans>
        }
        onClick={props.onSessions}
        navigational
      />
    </SettingsSection>
  );
}

/**
 * Account management (danger zone)
 */
function ManageAccount() {
  const client = useClient();
  const mfa = createMfaResource();
  const { mfaFlow, showError } = useModals();
  const { logout } = useClientLifecycle();

  // the number of days and the contact address come from the server, so
  // each exists once
  const [deletionInfo] = createResource(async () => {
    try {
      const info = await fetchDataExport(client().api as unknown as RawApi);
      return {
        days: info.deletion_grace_days,
        contact: info.contact_email,
      };
    } catch {
      return undefined;
    }
  });
  const graceDays = () => deletionInfo()?.days;
  const contact = () => deletionInfo()?.contact ?? "privacy@zrzur.com";

  const stillOwnServers = createMemo(
    () =>
      client().servers.filter((server) => server.owner?.self || false).length >
      0,
  );

  function disableAccount() {
    // closing or cancelling the confirmation leaves the account untouched
    mfaFlow(mfa.data!).then((ticket) =>
      ticket
        ?.disableAccount()
        .then(() => logout())
        .catch(showError),
    );
  }

  function deleteAccount() {
    mfaFlow(mfa.data!).then((ticket) =>
      ticket
        ?.deleteAccount()
        .then(() => logout())
        .catch(showError),
    );
  }

  return (
    <SettingsSection title={<Trans>Account management</Trans>}>
      <SettingsRow
        danger
        icon={<Icon name="prohibit" size={20} />}
        title={<Trans>Disable account</Trans>}
        description={
          <Trans>
            You won't be able to access your account unless you contact support
            - however, your data will not be deleted.
          </Trans>
        }
        control={() => (
          <Button
            size="sm"
            variant="outlined"
            isDisabled={mfa.isLoading}
            onPress={disableAccount}
          >
            <Trans>Disable</Trans>
          </Button>
        )}
      />
      <SettingsRow
        danger
        icon={<Icon name="trash" size={20} />}
        title={<Trans>Delete account</Trans>}
        description={
          <Switch
            fallback={
              <Show
                when={graceDays()}
                fallback={
                  <Trans>
                    Your account and your data (including your messages and
                    friends list) will be erased after you confirm by email and
                    a waiting period. Some records we must keep by law, such as
                    payments, stay for the time the law requires. You can
                    cancel before then by writing to {contact()}. Download a
                    copy of your data first: after you confirm, you can no
                    longer sign in.
                  </Trans>
                }
              >
                <Trans>
                  Your account and your data (including your messages and
                  friends list) will be erased {graceDays()} days after you
                  confirm by email. Some records we must keep by law, such as
                  payments, stay for the time the law requires. You can cancel
                  before then by writing to {contact()}. Download a copy of
                  your data first: after you confirm, you can no longer sign
                  in.
                </Trans>
              </Show>
            }
          >
            <Match when={stillOwnServers()}>
              <Trans>
                Cannot delete account until servers are deleted or transferred
              </Trans>
            </Match>
          </Switch>
        }
        control={() => (
          <Button
            size="sm"
            variant="_error"
            isDisabled={mfa.isLoading || stillOwnServers()}
            onPress={deleteAccount}
          >
            <Trans>Delete</Trans>
          </Button>
        )}
      />
    </SettingsSection>
  );
}
