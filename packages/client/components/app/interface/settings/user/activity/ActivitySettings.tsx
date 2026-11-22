import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  type DesktopActivityEntry,
  type DesktopActivityState,
  desktopActivity,
  setActivitySharing,
} from "@revolt/client/ActivityWorker";
import { directMessagesFriendsOnly } from "@revolt/client/age";
import { useModals } from "@revolt/modal";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { ProfileActivity } from "@revolt/ui/components/features/activity/ProfileActivity";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

type Privacy = {
  share_activity?: boolean;
  share_steam_activity?: boolean;
};

/** Entries shown before "Show all" */
const FIRST = 12;

/**
 * Settings → Activity: whether others see what you are doing right now,
 * Steam "now playing", the programs this computer may recognise, the apps
 * that told it what they do, and what is kept (nothing).
 */
export function ActivitySettings() {
  const { t } = useLingui();
  const client = useClient();
  const { showError } = useModals();
  const bridge = desktopActivity();

  const [privacy, { mutate }] = createResource(
    () => client().users.fetchPrivacy() as Promise<Privacy>,
  );
  const shares = () => privacy()?.share_activity === true;
  const steamFeature = () =>
    !!(client()?.configuration?.features as { rich_presence_steam?: boolean })
      ?.rich_presence_steam;
  // under 18 the same rule as direct messages: friends only, sharing off
  const young = () => directMessagesFriendsOnly();

  async function change(update: Privacy) {
    const before = privacy();
    if (!before) return;
    mutate({ ...before, ...update });
    try {
      const after = (await client().users.editPrivacy(
        update as never,
      )) as Privacy;
      mutate(after);
      setActivitySharing(after.share_activity === true);
    } catch (error) {
      mutate(before);
      showError(error);
    }
  }

  /* the desktop part */
  const [state, setState] = createSignal<DesktopActivityState>();
  const [filter, setFilter] = createSignal("");
  const [all, setAll] = createSignal(false);
  const [editing, setEditing] = createSignal<string>();
  const [draft, setDraft] = createSignal("");
  const [adding, setAdding] = createSignal(false);
  const [running, setRunning] = createSignal<{ pid: number; name: string }[]>(
    [],
  );
  const [pick, setPick] = createSignal<string>("");
  const [pickName, setPickName] = createSignal("");
  const [pickKind, setPickKind] = createSignal("Playing");

  onMount(() => {
    if (!bridge) return;
    void bridge.state().then(setState);
    onCleanup(bridge.onState(setState));
  });

  const desktop = async (run: () => Promise<DesktopActivityState>) => {
    try {
      setState(await run());
    } catch (error) {
      showError(error);
    }
  };

  const entries = createMemo(() => {
    const list = state()?.entries ?? [];
    const q = filter().trim().toLocaleLowerCase();
    const found = q
      ? list.filter((e) => e.name.toLocaleLowerCase().includes(q))
      : list;
    // running and added first, then games, then apps
    return [...found].sort(
      (a, b) =>
        Number(b.running) - Number(a.running) ||
        Number(b.added) - Number(a.added) ||
        (a.category === b.category ? 0 : a.category === "game" ? -1 : 1),
    );
  });
  const shown = () =>
    all() || filter() ? entries() : entries().slice(0, FIRST);

  const kindLabel = (entry: Pick<DesktopActivityEntry, "kind" | "category">) =>
    entry.kind === "Listening"
      ? t`Music`
      : entry.kind === "Watching"
        ? t`Video`
        : entry.category === "game"
          ? t`Game`
          : t`App`;

  async function openAdd() {
    if (!bridge) return;
    setAdding(true);
    setRunning(await bridge.running());
  }

  async function add() {
    const process = running().find((p) => String(p.pid) === pick());
    if (!bridge || !process) return;
    await desktop(() =>
      bridge.add(
        process.pid,
        pickName().trim() || process.name.replace(/\.exe$/i, ""),
        pickKind(),
      ),
    );
    setAdding(false);
    setPick("");
    setPickName("");
  }

  return (
    <Page data-testid="activity-settings">
      <SettingsSection
        title={<Trans>Share your activity</Trans>}
        description={
          <Trans>
            Friends and people in your servers see the game or app you are
            using, with how long you have been at it.
          </Trans>
        }
      >
        <SettingsRow
          icon={<Symbol size={20}>sports_esports</Symbol>}
          title={<Trans>Share what you are doing</Trans>}
          description={
            <Show
              when={young()}
              fallback={
                <Trans>
                  Hidden while you are invisible or offline. Turn it off and it
                  disappears at once.
                </Trans>
              }
            >
              <Trans>
                Under 18 this starts off. Turn it on only if you want others to
                see it.
              </Trans>
            </Show>
          }
          disabled={!privacy()}
          onClick={() => change({ share_activity: !shares() })}
          data-testid="activity-share"
          control={(ids) => (
            <Toggle
              checked={shares()}
              disabled={!privacy()}
              onChange={() => change({ share_activity: !shares() })}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
          )}
        />
        <Show when={steamFeature()}>
          <SettingsRow
            icon={<Symbol size={20}>cloud</Symbol>}
            title={<Trans>Show what you play on Steam</Trans>}
            description={
              <Trans>
                Read from your linked Steam account about once a minute while
                you are online. Works on the web and on phones too. Link Steam
                in Connections first.
              </Trans>
            }
            disabled={!privacy() || !shares()}
            onClick={() =>
              change({ share_steam_activity: !privacy()?.share_steam_activity })
            }
            data-testid="activity-steam"
            control={(ids) => (
              <Toggle
                checked={!!privacy()?.share_steam_activity}
                disabled={!privacy() || !shares()}
                onChange={() =>
                  change({
                    share_steam_activity: !privacy()?.share_steam_activity,
                  })
                }
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
              />
            )}
          />
        </Show>
        <Show when={client().user}>
          {(me) => (
            <Preview>
              <PreviewTitle>
                <Trans>What others see now</Trans>
              </PreviewTitle>
              <Show
                when={shares() && me().activities.length}
                fallback={
                  <Hint data-testid="activity-nothing">
                    <Show
                      when={shares()}
                      fallback={<Trans>Nothing: sharing is off.</Trans>}
                    >
                      <Trans>Nothing right now.</Trans>
                    </Show>
                  </Hint>
                }
              >
                <ProfileActivity user={me()} />
              </Show>
            </Preview>
          )}
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Games and apps on this computer</Trans>}>
        <Show
          when={bridge}
          fallback={
            <Hint data-testid="activity-browser-note">
              <Trans>
                A browser cannot see which games or programs are running, so
                nothing is detected here. The Zrzur desktop app can, and apps
                can tell it what they do. Steam works everywhere.
              </Trans>
            </Hint>
          }
        >
          <SettingsRow
            icon={<Symbol size={20}>desktop_windows</Symbol>}
            title={<Trans>Detect games and apps</Trans>}
            description={
              <Trans>
                Looks at the names of running programs every 15 seconds, on this
                computer only. Only the program's name is shown, never window
                titles, tabs or files.
              </Trans>
            }
            disabled={!shares()}
            onClick={() =>
              desktop(() => bridge!.setDetection(!state()?.detection))
            }
            data-testid="activity-detection"
            control={(ids) => (
              <Toggle
                checked={!!state()?.detection}
                disabled={!shares()}
                onChange={() =>
                  desktop(() => bridge!.setDetection(!state()?.detection))
                }
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
              />
            )}
          />
          <Tools>
            <TextField
              aria-label={t`Find a game or app`}
              placeholder={t`Find a game or app`}
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
            <Button
              variant="tonal"
              onPress={openAdd}
              data-testid="activity-add-open"
            >
              <Trans>Add a program</Trans>
            </Button>
          </Tools>
          <Show when={adding()}>
            <AddBox data-testid="activity-add">
              <FloatingSelect
                aria-label={t`Running program`}
                value={pick()}
                onChange={(e) => {
                  setPick(e.currentTarget.value);
                  const p = running().find(
                    (r) => String(r.pid) === e.currentTarget.value,
                  );
                  if (p && !pickName())
                    setPickName(p.name.replace(/\.exe$/i, ""));
                }}
              >
                <For each={running()}>
                  {(p) => <MenuItem value={String(p.pid)}>{p.name}</MenuItem>}
                </For>
              </FloatingSelect>
              <TextField
                aria-label={t`Name others see`}
                placeholder={t`Name others see`}
                maxlength={128}
                value={pickName()}
                onInput={(e) => setPickName(e.currentTarget.value)}
              />
              <FloatingSelect
                aria-label={t`Kind`}
                value={pickKind()}
                onChange={(e) => setPickKind(e.currentTarget.value)}
              >
                <MenuItem value="Playing">{t`Game`}</MenuItem>
                <MenuItem value="Using">{t`App`}</MenuItem>
                <MenuItem value="Listening">{t`Music`}</MenuItem>
                <MenuItem value="Watching">{t`Video`}</MenuItem>
              </FloatingSelect>
              <Actions>
                <Button variant="text" onPress={() => setAdding(false)}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button variant="filled" isDisabled={!pick()} onPress={add}>
                  <Trans>Add</Trans>
                </Button>
              </Actions>
            </AddBox>
          </Show>
          <For each={shown()}>
            {(entry) => (
              <SettingsRow
                data-testid={`activity-entry-${entry.id}`}
                icon={
                  <Symbol size={20}>
                    {entry.category === "game" ? "sports_esports" : "apps"}
                  </Symbol>
                }
                title={
                  <Show
                    when={editing() === entry.id}
                    fallback={<span dir="auto">{entry.name}</span>}
                  >
                    <TextField
                      aria-label={t`Name others see`}
                      maxlength={128}
                      value={draft()}
                      onInput={(e) => setDraft(e.currentTarget.value)}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === "Enter") {
                          void desktop(() =>
                            bridge!.setEntry(entry.id, { name: draft() }),
                          );
                          setEditing(undefined);
                        }
                        if (e.key === "Escape") setEditing(undefined);
                      }}
                    />
                  </Show>
                }
                description={
                  <>
                    {kindLabel(entry)}
                    <Show when={entry.running}> · {t`Running now`}</Show>
                    <Show when={entry.name !== entry.originalName}>
                      {" · "}
                      <bdi dir="auto">{entry.originalName}</bdi>
                    </Show>
                  </>
                }
                secondary={
                  <Show
                    when={editing() === entry.id}
                    fallback={
                      <Row>
                        <Button
                          variant="text"
                          onPress={() => {
                            setDraft(entry.name);
                            setEditing(entry.id);
                          }}
                        >
                          <Trans>Rename</Trans>
                        </Button>
                        <Show when={entry.added}>
                          <Button
                            variant="text"
                            onPress={() =>
                              desktop(() => bridge!.removeAdded(entry.id))
                            }
                          >
                            <Trans>Remove</Trans>
                          </Button>
                        </Show>
                      </Row>
                    }
                  >
                    <Button
                      variant="tonal"
                      onPress={() => {
                        void desktop(() =>
                          bridge!.setEntry(entry.id, { name: draft() }),
                        );
                        setEditing(undefined);
                      }}
                    >
                      <Trans>Save</Trans>
                    </Button>
                  </Show>
                }
                control={(ids) => (
                  <Toggle
                    checked={!entry.off}
                    onChange={() =>
                      desktop(() =>
                        bridge!.setEntry(entry.id, { off: !entry.off }),
                      )
                    }
                    aria-labelledby={ids.labelId}
                    aria-describedby={ids.descriptionId}
                  />
                )}
              />
            )}
          </For>
          <Show when={!filter() && entries().length > FIRST}>
            <Button variant="text" onPress={() => setAll(!all())}>
              <Show when={all()} fallback={<Trans>Show all</Trans>}>
                <Trans>Show fewer</Trans>
              </Show>
            </Button>
          </Show>
        </Show>
      </SettingsSection>

      <SettingsSection
        title={<Trans>Connected apps</Trans>}
        description={
          <Trans>
            Games and apps that told Zrzur what you are doing, through the
            desktop app. Block one and it is never shown.
          </Trans>
        }
      >
        <Show
          when={bridge}
          fallback={
            <Hint>
              <Trans>Apps connect through the Zrzur desktop app.</Trans>
            </Hint>
          }
        >
          <Show
            when={state()?.apps.length}
            fallback={
              <Hint data-testid="activity-no-apps">
                <Trans>
                  No app has connected yet. Zrzur for VS Code and the Zrzur
                  browser extension show here once they connect.
                </Trans>
              </Hint>
            }
          >
            <For each={state()?.apps}>
              {(app) => (
                <SettingsRow
                  data-testid={`activity-app-${app.id}`}
                  icon={
                    <Symbol size={20}>
                      {app.id === "zrzur-browser-extension"
                        ? "public"
                        : "terminal"}
                    </Symbol>
                  }
                  title={<span dir="auto">{app.name}</span>}
                  description={
                    app.blocked
                      ? t`Blocked: never shown`
                      : app.active
                        ? t`Showing your activity now`
                        : t`Allowed`
                  }
                  secondary={
                    <Button
                      variant="text"
                      onPress={() => desktop(() => bridge!.forgetApp(app.id))}
                    >
                      <Trans>Forget</Trans>
                    </Button>
                  }
                  control={(ids) => (
                    <Toggle
                      checked={!app.blocked}
                      onChange={() =>
                        desktop(() => bridge!.blockApp(app.id, !app.blocked))
                      }
                      aria-labelledby={ids.labelId}
                      aria-describedby={ids.descriptionId}
                    />
                  )}
                />
              )}
            </For>
          </Show>
          <SettingsRow
            icon={<Symbol size={20}>public</Symbol>}
            title={<Trans>Browser extension</Trans>}
            description={
              <Show
                when={state()?.extension.pairingCode}
                fallback={
                  <Show
                    when={state()?.extension.paired}
                    fallback={
                      <Trans>
                        Shows the site you choose, never the page or its title.
                      </Trans>
                    }
                  >
                    <Trans>Paired.</Trans>
                  </Show>
                }
              >
                {(code) => (
                  <span>
                    {t`Type this code in the extension:`}{" "}
                    <Code dir="ltr" data-testid="activity-pairing-code">
                      {code()}
                    </Code>
                  </span>
                )}
              </Show>
            }
            control={() => (
              <Show
                when={state()?.extension.pairingCode}
                fallback={
                  <Button
                    variant="tonal"
                    isDisabled={!shares()}
                    onPress={() => desktop(() => bridge!.startPairing())}
                    data-testid="activity-pair"
                  >
                    <Trans>Pair</Trans>
                  </Button>
                }
              >
                <Button
                  variant="text"
                  onPress={() => desktop(() => bridge!.stopPairing())}
                >
                  <Trans>Cancel</Trans>
                </Button>
              </Show>
            )}
          />
          <SettingsRow
            icon={<Symbol size={20}>sync</Symbol>}
            title={<Trans>Games made for other chat apps</Trans>}
            description={
              <Trans>
                Many games already report what you do to another chat app. Zrzur
                can listen in its place, only while that app is closed.
              </Trans>
            }
            disabled={!shares()}
            onClick={() =>
              desktop(() => bridge!.setCompat(!state()?.discordCompat))
            }
            data-testid="activity-compat"
            control={(ids) => (
              <Toggle
                checked={!!state()?.discordCompat}
                disabled={!shares()}
                onChange={() =>
                  desktop(() => bridge!.setCompat(!state()?.discordCompat))
                }
                aria-labelledby={ids.labelId}
                aria-describedby={ids.descriptionId}
              />
            )}
          />
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Your privacy</Trans>}>
        <Facts data-testid="activity-privacy">
          <li>
            <Trans>
              Zrzur keeps no history: an activity exists only while you are
              online and goes when you go offline.
            </Trans>
          </li>
          <li>
            <Trans>
              Who sees it: the people who can see that you are online. Nobody
              while you are invisible.
            </Trans>
          </li>
          <li>
            <Trans>
              The desktop app reads program names on this computer only; the
              list of programs never leaves it.
            </Trans>
          </li>
          <li>
            <Trans>
              Apps never learn who you are from Zrzur. Pictures are shown
              through Zrzur's servers, and links open with a warning.
            </Trans>
          </li>
          <li>
            <Trans>
              Your choices here (programs turned off or renamed, blocked apps)
              stay on this computer.
            </Trans>
          </li>
        </Facts>
      </SettingsSection>
    </Page>
  );
}

const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxWidth: "920px",
  },
});

const Preview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 16px",
  },
});

const PreviewTitle = styled("h4", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    padding: "12px 16px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: "8px 16px",
    "& > :first-child": { flex: 1, minWidth: 0 },
    _phone: { flexDirection: "column", alignItems: "stretch" },
  },
});

const AddBox = styled("div", {
  base: {
    display: "grid",
    gap: "8px",
    margin: "0 16px 8px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    _phone: { flexDirection: "column-reverse", alignItems: "stretch" },
  },
});

const Row = styled("div", {
  base: { display: "flex", gap: "4px" },
});

const Code = styled("strong", {
  base: {
    fontFamily: "var(--z-font-mono, monospace)",
    fontSize: "15px",
    letterSpacing: "2px",
    color: "var(--z-fg-primary)",
  },
});

const Facts = styled("ul", {
  base: {
    margin: 0,
    paddingBlock: "12px",
    paddingInlineStart: "36px",
    paddingInlineEnd: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});
