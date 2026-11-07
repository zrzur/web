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

import { Trans } from "@lingui/solid/macro";
import { Session } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { useModals } from "@revolt/modal";
import {
  Button,
  CategoryButton,
  CircularProgress,
  Column,
  Time,
  iconSize,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { logout as MdLogout } from "@revolt/ui/icons/legacy";

import { ListedSession, byLastUsed, readLastUsed } from "./sessionList";

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
    <Column gap="lg">
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
              <Note>
                <Trans>
                  Devices signed in to your account. Unused ones log out by
                  themselves.
                </Trans>
              </Note>
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

/** When each session was last used, once the list has loaded */
type LastUsed = ReturnType<typeof readLastUsed>;

/**
 * Manage user's current session
 */
function ManageCurrentSession(props: { otherSessions: Accessor<Session[]> }) {
  const client = useClient();
  const { openModal } = useModals();

  /**
   * Resolve current session
   */
  const currentSession = () => client().sessions.get(client().sessionId!);

  return (
    <CategoryButton.Group>
      <CategoryButton.Collapse
        title={<Trans>This device</Trans>}
        description={<bdi>{currentSession()?.name}</bdi>}
        icon={<SessionIcon session={currentSession()} />}
      >
        <CategoryButton
          icon="blank"
          action="chevron"
          onClick={() =>
            currentSession() &&
            openModal({
              type: "rename_session",
              session: currentSession()!,
            })
          }
        >
          <Trans>Rename</Trans>
        </CategoryButton>
        <CategoryButton
          icon="blank"
          action="chevron"
          onClick={() =>
            currentSession() &&
            openModal({
              type: "sign_out_sessions",
              client: client(),
              session: currentSession()!,
            })
          }
        >
          <Trans>Log out</Trans>
        </CategoryButton>
      </CategoryButton.Collapse>
      {/* <CategoryButton
        action="chevron"
        icon={
          <MdAutoMode
            {...iconSize(24)}
            fill="var(--md-sys-color-error)"
          />
        }
        description={Keeps your last sessions active and automatically logs you out of other ones"}
      >
        Keep Last Active Sessions
      </CategoryButton> */}
      <Show when={props.otherSessions().length}>
        <CategoryButton
          action="chevron"
          onClick={() =>
            openModal({
              type: "sign_out_sessions",
              client: client(),
            })
          }
          icon={<MdLogout {...iconSize(24)} fill="var(--md-sys-color-error)" />}
          description={
            <Trans>Logs you out of all sessions except this device.</Trans>
          }
        >
          <Trans>Log out other sessions</Trans>
        </CategoryButton>
      </Show>
    </CategoryButton.Group>
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
    <Show
      when={props.otherSessions().length}
      fallback={
        <Note>
          <Trans>No other device is signed in.</Trans>
        </Note>
      }
    >
      <Column>
        <CategoryButton.Group>
          <For each={props.otherSessions()}>
            {(session) => (
              <CategoryButton.Collapse
                icon={<SessionIcon session={session} />}
                title={
                  <Capitalise>
                    <bdi>{session.name}</bdi>
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
              >
                <CategoryButton
                  icon="blank"
                  action="chevron"
                  onClick={() =>
                    openModal({
                      type: "rename_session",
                      session,
                    })
                  }
                >
                  <Trans>Rename</Trans>
                </CategoryButton>
                <CategoryButton
                  icon="blank"
                  action="chevron"
                  onClick={() =>
                    openModal({
                      type: "sign_out_sessions",
                      client: client(),
                      session,
                    })
                  }
                >
                  <Trans>Log out</Trans>
                </CategoryButton>
              </CategoryButton.Collapse>
            )}
          </For>
        </CategoryButton.Group>
      </Column>
    </Show>
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

const Note = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-muted)",
    fontSize: "13px",
  },
});

const Failure = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
  },
});

/**
 * Show icon for session
 */
function SessionIcon(props: { session?: Session }) {
  // device type rather than OS brand marks, so these follow the icon
  // style; the OS name is already shown in the row text
  const name = () => props.session?.name ?? "";
  return (
    <Switch fallback={<Icon name="desktop" size={20} />}>
      <Match when={!name()}>
        <Icon name="question" size={20} />
      </Match>
      <Match when={/android|i(Pad|Phone)?os|mobile/i.test(name())}>
        <Icon name="device-mobile" size={20} />
      </Match>
    </Switch>
  );
}
