import {
  Accessor,
  For,
  Match,
  Show,
  Switch,
  batch,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Session } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import {
  Button,
  CircularProgress,
  Column,
  Row,
  SettingsRow,
  SettingsSection,
  Time,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  ListedSession,
  byLastUsed,
  readLastUsed,
  sessionDevice,
} from "./sessionList";

/**
 * Sessions
 */
export function Sessions() {
  const client = useClient();
  const [lastUsed, setLastUsed] = createSignal<LastUsed>();
  const [failure, setFailure] = createSignal<unknown>();

  /**
   * Ask the server, not the SDK's `sessions.fetch()`: its `Session` keeps only
   * the id and the name, and the page needs the last use too.
   */
  async function load() {
    setFailure(undefined);
    try {
      const list = await client().api.get("/auth/session/all");
      batch(() => {
        for (const session of list) {
          client().sessions.getOrCreate(session._id, session);
        }
        setLastUsed(readLastUsed(list as ListedSession[]));
      });
    } catch (error) {
      setFailure(error);
    }
  }

  onMount(load);

  /**
   * The other sessions the server still has, most recently used first
   */
  const otherSessions = createMemo(() => {
    const known = lastUsed();
    if (!known) return [];
    return byLastUsed(
      client().sessions.filter(
        (session) => !session.current && known.has(session.id),
      ),
      known,
    );
  });

  return (
    <Column gap="xl">
      <Switch fallback={<CircularProgress />}>
        <Match when={failure()}>
          <Failure role="alert">
            <span>
              <Trans>We could not load your sessions.</Trans>{" "}
              <TranslatedError error={failure()} />
            </span>
            <div>
              <Button variant="outlined" onPress={load}>
                <Trans>Try again</Trans>
              </Button>
            </div>
          </Failure>
        </Match>
        <Match when={lastUsed()}>
          {(known) => (
            <>
              <ManageCurrentSession otherSessions={otherSessions} />
              <ListOtherSessions
                otherSessions={otherSessions}
                lastUsed={known()}
              />
            </>
          )}
        </Match>
      </Switch>
    </Column>
  );
}

/**
 * A session's name; one made at sign-in is shown in the current language
 * with proper browser and OS names, whatever language it was made in
 */
function SessionName(props: { name?: string }) {
  const { t } = useLingui();
  const label = () => {
    const device = sessionDevice(props.name ?? "");
    if (!device) return props.name ?? "";
    const { browser: name, os } = device;
    return t`Zrzur for Web (${name} on ${os})`;
  };
  return <bdi>{label()}</bdi>;
}

/** When each session was last used, once the list has loaded */
type LastUsed = ReturnType<typeof readLastUsed>;

/**
 * This device: its name, and the actions on it
 */
function ManageCurrentSession(props: { otherSessions: Accessor<Session[]> }) {
  const client = useClient();
  const { openModal } = useModals();

  /**
   * Resolve current session
   */
  const currentSession = () => client().sessions.get(client().sessionId!);

  return (
    <SettingsSection title={<Trans>This device</Trans>}>
      <SettingsRow
        icon={<SessionIcon session={currentSession()} />}
        title={
          <Capitalise>
            <SessionName name={currentSession()?.name} />
          </Capitalise>
        }
        control={() => (
          <SessionActions
            onRename={() =>
              currentSession() &&
              openModal({
                type: "rename_session",
                session: currentSession()!,
              })
            }
            onLogOut={() =>
              currentSession() &&
              openModal({
                type: "sign_out_sessions",
                client: client(),
                session: currentSession()!,
              })
            }
          />
        )}
      />
      <Show when={props.otherSessions().length}>
        <SettingsRow
          icon={<Icon name="sign-out" size={20} />}
          title={<Trans>Log out other sessions</Trans>}
          danger
          navigational
          onClick={() =>
            openModal({
              type: "sign_out_sessions",
              client: client(),
            })
          }
        />
      </Show>
    </SettingsSection>
  );
}

/** Rename and log out, as buttons in the row like the other pages */
function SessionActions(props: { onRename: () => void; onLogOut: () => void }) {
  return (
    <Row gap="sm">
      <Button size="sm" variant="text" onPress={props.onRename}>
        <Trans>Rename</Trans>
      </Button>
      <Button size="sm" variant="tonal" onPress={props.onLogOut}>
        <Trans>Log out</Trans>
      </Button>
    </Row>
  );
}

/**
 * List other logged in sessions
 */
function ListOtherSessions(props: {
  otherSessions: Accessor<Session[]>;
  lastUsed: LastUsed;
}) {
  const { openModal } = useModals();
  const client = useClient();

  return (
    <SettingsSection title={<Trans>Other devices</Trans>}>
      <Show
        when={props.otherSessions().length}
        fallback={
          <SettingsRow
            icon={<Icon name="check-circle" size={20} />}
            title={<Trans>No other device is signed in.</Trans>}
          />
        }
      >
        <For each={props.otherSessions()}>
          {(session) => (
            <SettingsRow
              icon={<SessionIcon session={session} />}
              title={
                <Capitalise>
                  <SessionName name={session.name} />
                </Capitalise>
              }
              description={
                <Show
                  when={props.lastUsed.get(session.id)}
                  fallback={
                    <Trans>
                      Created{" "}
                      <Time value={session.createdAt} format="relative" />
                    </Trans>
                  }
                >
                  {(time) => (
                    <Trans>
                      Last used <Time value={time()} format="relative" />
                    </Trans>
                  )}
                </Show>
              }
              control={() => (
                <SessionActions
                  onRename={() =>
                    openModal({
                      type: "rename_session",
                      session,
                    })
                  }
                  onLogOut={() =>
                    openModal({
                      type: "sign_out_sessions",
                      client: client(),
                      session,
                    })
                  }
                />
              )}
            />
          )}
        </For>
      </Show>
    </SettingsSection>
  );
}

/**
 * Capitalize the first letter of session titles only (title case would
 * also capitalise words like "für" or "on")
 */
const Capitalise = styled("div", {
  base: {
    "&::first-letter": { textTransform: "uppercase" },
  },
});

const Failure = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    border: "var(--z-box-border)",
  },
});

/**
 * Show icon for session
 */
function SessionIcon(props: { session?: Session }) {
  // device type rather than OS brand marks, so these follow the icon
  // style; the OS name is already shown in the row text
  const name = () => props.session?.name ?? "";
  // judged by the OS alone: the browser id "ios-webview" also runs on a Mac
  const system = () => sessionDevice(name())?.os ?? name();
  return (
    <Switch fallback={<Icon name="desktop" size={20} />}>
      <Match when={!name()}>
        <Icon name="question" size={20} />
      </Match>
      <Match when={/android|i(Pad|Phone)?os|mobile/i.test(system())}>
        <Icon name="device-mobile" size={20} />
      </Match>
    </Switch>
  );
}
