import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
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
  desktopDetected,
  setActivitySharing,
  setDesktopDetected,
} from "@revolt/client/ActivityWorker";
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
import { ActivityArt } from "@revolt/ui/components/features/activity/ActivityArt";
import { useActivityLabel } from "@revolt/ui/components/features/activity/ActivityLineBody";
import { ProfileActivity } from "@revolt/ui/components/features/activity/ProfileActivity";
import {
  type Activity,
  localIcon,
  proxied,
} from "@revolt/ui/components/features/activity/activityText";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { Icon } from "@revolt/ui/icons/Icon";

import { detectedNow, detectionStatus } from "./detectionStatus";

type Privacy = {
  share_activity?: boolean | null;
  share_steam_activity?: boolean;
  /** Set by the server: under 18 or no stated age, friends only */
  activity_friends_only?: boolean;
  activity_intro_seen?: boolean;
};

type DesktopApp = DesktopActivityState["apps"][number];

/** Entries shown before "Show all" */
const FIRST = 12;

/** How often a shown pairing code is checked (it lasts five minutes) */
const PAIRING_CHECK_MS = 10_000;

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
  // the server decides: under 18 or no stated age, friends only
  const friendsOnly = () => privacy()?.activity_friends_only === true;

  async function change(update: Privacy) {
    const before = privacy();
    if (!before) return;
    mutate({ ...before, ...update });
    try {
      const after = (await client().users.editPrivacy(
        // answering here also answers the one-time question
        { ...update, activity_intro_seen: true } as never,
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
  const [running, setRunning] = createSignal<
    { pid: number; name: string; path?: string }[]
  >([]);
  const [pick, setPick] = createSignal<string>("");
  const [pickName, setPickName] = createSignal("");
  const [pickKind, setPickKind] = createSignal("Playing");

  /* pictures: the list's own through Zrzur's image proxy, else the
     program's icon from this computer (desktop apps since 26.3.0-beta.9) */
  const proxy = () => {
    const january = client()?.configuration?.features?.january;
    return january?.enabled ? january.url : undefined;
  };
  const [icons, setIcons] = createSignal<Record<string, string>>({});
  const loadIcons = () =>
    void bridge
      ?.icons?.()
      .then((found) => setIcons(found ?? {}))
      .catch(() => undefined);
  const pictureOf = (id: string, icon?: string) =>
    proxied(icon, proxy()) ?? localIcon(icons()[id]);
  const [privacyOpen, setPrivacyOpen] = createSignal(false);

  onMount(() => {
    if (!bridge) return;
    void bridge.state().then(setState);
    onCleanup(
      bridge.onState((next) => {
        setState(next);
        loadIcons();
      }),
    );
    loadIcons();
    // what is detected now, also before the desktop sends its next change
    void bridge.current().then(setDesktopDetected);
  });

  /* where activity is detected, said plainly: a browser and a desktop app
     from before rich presence detect nothing at all */
  const label = useActivityLabel();
  const status = () =>
    detectionStatus({
      native: !!window.native,
      bridge: !!bridge,
      sharing: shares(),
    });
  const now = () => detectedNow(desktopDetected()) as Activity | undefined;

  // a pairing code lasts five minutes and the desktop says nothing when it
  // runs out: look again while one is shown, so an old code never stays
  createEffect(
    on(
      () => state()?.extension.pairingCode,
      (code) => {
        if (!bridge || !code) return;
        const timer = setInterval(
          () => void bridge.state().then(setState),
          PAIRING_CHECK_MS,
        );
        onCleanup(() => clearInterval(timer));
      },
    ),
  );

  const desktop = async (run: () => Promise<DesktopActivityState>) => {
    try {
      setState(await run());
      loadIcons();
    } catch (error) {
      showError(error);
    }
  };

  /* rows are keyed by id, so a row keeps its focus and input while the
     desktop sends a new state */
  const entryById = createMemo(
    () => new Map((state()?.entries ?? []).map((entry) => [entry.id, entry])),
  );
  const entryIds = createMemo(() => {
    const list = state()?.entries ?? [];
    const q = filter().trim().toLocaleLowerCase();
    const found = q
      ? list.filter((e) => e.name.toLocaleLowerCase().includes(q))
      : list;
    // running and added first, then games, then apps
    return [...found]
      .sort(
        (a, b) =>
          Number(b.running) - Number(a.running) ||
          Number(b.added) - Number(a.added) ||
          (a.category === b.category ? 0 : a.category === "game" ? -1 : 1),
      )
      .map((entry) => entry.id);
  });
  const shownIds = () =>
    all() || filter() ? entryIds() : entryIds().slice(0, FIRST);

  const appById = createMemo(
    () => new Map((state()?.apps ?? []).map((app) => [app.id, app])),
  );
  // apps waiting for Show or Block come first
  const appIds = createMemo(() =>
    [...(state()?.apps ?? [])]
      .sort((a, b) => Number(a.decided !== false) - Number(b.decided !== false))
      .map((app) => app.id),
  );

  const kindLabel = (
    entry: Pick<DesktopActivityEntry, "kind" | "category" | "browser">,
  ) =>
    entry.browser
      ? t`Browser`
      : entry.kind === "Listening"
        ? t`Music`
        : entry.kind === "Watching"
          ? t`Video`
          : entry.category === "game"
            ? t`Game`
            : t`App`;

  const appStatus = (app: DesktopApp) =>
    app.decided === false
      ? t`${app.name} wants to show what you are doing on Zrzur.`
      : app.blocked
        ? t`Blocked: never shown`
        : app.active
          ? t`Showing your activity now`
          : t`Allowed`;

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
      <SettingsSection title={<Trans>Share your activity</Trans>}>
        <SettingsRow
          icon={<Icon name="pulse" size={20} />}
          title={<Trans>Share what you are doing</Trans>}
          description={
            <Lines>
              <span>
                <Trans>
                  Friends and people in your servers see the game or app you
                  use.
                </Trans>
              </span>
              <Show when={friendsOnly()}>
                <span data-testid="activity-friends-only">
                  <Trans>
                    Only your friends see this, because you are under 18 or have
                    not given your age.
                  </Trans>
                </span>
              </Show>
              <span>
                <Trans>
                  App names can say private things about you. Turn off or rename
                  any.
                </Trans>
              </span>
            </Lines>
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
                Your public Steam game, also without the desktop app. Link Steam
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
        <SettingsRow
          icon={<Icon name="desktop" size={20} />}
          title={<Trans>On this device</Trans>}
          data-testid="activity-status"
          description={
            <Lines>
              <span data-state={status()} data-testid="activity-status-text">
                <Switch>
                  <Match when={status() === "browser"}>
                    <span data-testid="activity-browser-note">
                      <Trans>
                        Activity is detected by the Zrzur desktop app. Open
                        Zrzur in the desktop app to share games and apps.
                      </Trans>
                    </span>
                  </Match>
                  <Match when={status() === "update"}>
                    <Trans>
                      Update the Zrzur desktop app to share what you are doing.
                    </Trans>
                  </Match>
                  <Match when={status() === "off"}>
                    <Trans>
                      Sharing is off, so the desktop app detects nothing.
                    </Trans>
                  </Match>
                  <Match when={status() === "live"}>
                    <Show
                      when={now()}
                      fallback={t`Detecting now: nothing running`}
                    >
                      {(activity) => (
                        <bdi data-testid="activity-detected">
                          {t`Detecting now: ${label(activity())}`}
                        </bdi>
                      )}
                    </Show>
                  </Match>
                </Switch>
              </span>
              <Show when={steamFeature()}>
                <span data-testid="activity-status-steam">
                  <Show
                    when={shares() && privacy()?.share_steam_activity}
                    fallback={
                      <Trans>
                        Without the desktop app, Steam can still show what you
                        play: turn on “Show what you play on Steam”.
                      </Trans>
                    }
                  >
                    <Trans>
                      Steam is on too: a game you play on Steam shows even
                      without the desktop app.
                    </Trans>
                  </Show>
                </span>
              </Show>
            </Lines>
          }
        />
        <Show when={client().user}>
          {(me) => (
            <Preview>
              <PreviewTitle>
                <Trans>What others see now</Trans>
              </PreviewTitle>
              <Show
                when={shares() && me().activities.length}
                fallback={
                  <PreviewHint data-testid="activity-nothing">
                    <Show
                      when={shares()}
                      fallback={<Trans>Nothing: sharing is off.</Trans>}
                    >
                      <Trans>Nothing right now.</Trans>
                    </Show>
                  </PreviewHint>
                }
              >
                <ProfileActivity user={me()} />
              </Show>
            </Preview>
          )}
        </Show>
      </SettingsSection>

      {/* the desktop app's own parts: a browser or a desktop app from before
          rich presence has none (the status row above says why) */}
      <Show when={bridge}>
        <SettingsSection title={<Trans>Games and apps on this computer</Trans>}>
          <SettingsRow
            icon={<Symbol size={20}>desktop_windows</Symbol>}
            title={<Trans>Detect games and apps</Trans>}
            description={
              <Trans>
                Program names only, never window titles, tabs or files.
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
          <For each={shownIds()}>
            {(id) => (
              <Show when={entryById().get(id)}>
                {(entry) => (
                  <SettingsRow
                    data-testid={`activity-entry-${id}`}
                    icon={
                      <ActivityArt
                        size="row"
                        name={entry().name}
                        src={pictureOf(id, entry().icon)}
                      />
                    }
                    title={
                      <Show
                        when={editing() === id}
                        fallback={<span dir="auto">{entry().name}</span>}
                      >
                        <TextField
                          aria-label={t`Name others see`}
                          maxlength={128}
                          value={draft()}
                          onInput={(e) => setDraft(e.currentTarget.value)}
                          onKeyDown={(e: KeyboardEvent) => {
                            if (e.key === "Enter") {
                              void desktop(() =>
                                bridge!.setEntry(id, { name: draft() }),
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
                        <Show
                          when={entry().browser && entry().off}
                          fallback={kindLabel(entry())}
                        >
                          {t`Browser · off until you turn it on`}
                        </Show>
                        <Show when={entry().running}>
                          {" · "}
                          <RunningNow>{t`Running now`}</RunningNow>
                        </Show>
                        <Show when={entry().name !== entry().originalName}>
                          {" · "}
                          <bdi dir="auto">{entry().originalName}</bdi>
                        </Show>
                      </>
                    }
                    secondary={
                      <Show
                        when={editing() === id}
                        fallback={
                          <Row>
                            <Button
                              variant="text"
                              onPress={() => {
                                setDraft(entry().name);
                                setEditing(id);
                              }}
                            >
                              <Trans>Rename</Trans>
                            </Button>
                            <Show when={entry().added}>
                              <Button
                                variant="text"
                                onPress={() =>
                                  desktop(() => bridge!.removeAdded(id))
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
                              bridge!.setEntry(id, { name: draft() }),
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
                        checked={!entry().off}
                        onChange={() =>
                          desktop(() =>
                            bridge!.setEntry(id, { off: !entry().off }),
                          )
                        }
                        aria-labelledby={ids.labelId}
                        aria-describedby={ids.descriptionId}
                      />
                    )}
                  />
                )}
              </Show>
            )}
          </For>
          <Show when={!filter() && entryIds().length > FIRST}>
            <Button variant="text" onPress={() => setAll(!all())}>
              <Show when={all()} fallback={<Trans>Show all</Trans>}>
                <Trans>Show fewer</Trans>
              </Show>
            </Button>
          </Show>
        </SettingsSection>

        <SettingsSection
          title={<Trans>Connected apps</Trans>}
          description={
            <Trans>Apps that report what you do. Block one to hide it.</Trans>
          }
        >
          <Show
            when={appIds().length}
            fallback={
              <Hint data-testid="activity-no-apps">
                <Trans>No app has connected yet.</Trans>
              </Hint>
            }
          >
            <For each={appIds()}>
              {(id) => (
                <Show when={appById().get(id)}>
                  {(app) => (
                    <SettingsRow
                      data-testid={`activity-app-${id}`}
                      icon={
                        <Show
                          when={id !== "zrzur-browser-extension"}
                          fallback={<Symbol size={20}>public</Symbol>}
                        >
                          <ActivityArt
                            size="row"
                            name={app().name}
                            src={localIcon(icons()[`app:${id}`])}
                          />
                        </Show>
                      }
                      title={<span dir="auto">{app().name}</span>}
                      description={
                        <Lines>
                          <span data-testid="activity-app-status">
                            {appStatus(app())}
                          </span>
                          <Show when={app().path}>
                            {(path) => (
                              <AppPath dir="ltr" title={path()}>
                                {path()}
                              </AppPath>
                            )}
                          </Show>
                        </Lines>
                      }
                      secondary={
                        <Show when={app().decided !== false && !app().blocked}>
                          <Button
                            variant="text"
                            onPress={() => desktop(() => bridge!.forgetApp(id))}
                          >
                            <Trans>Forget</Trans>
                          </Button>
                        </Show>
                      }
                      control={(ids) => (
                        <Show
                          when={app().decided === false}
                          fallback={
                            <Toggle
                              checked={!app().blocked}
                              onChange={() =>
                                desktop(() =>
                                  bridge!.blockApp(id, !app().blocked),
                                )
                              }
                              aria-labelledby={ids.labelId}
                              aria-describedby={ids.descriptionId}
                            />
                          }
                        >
                          {/* two answers of the same weight (legal RP-03) */}
                          <Choice data-testid="activity-app-ask">
                            <Button
                              variant="tonal"
                              onPress={() =>
                                desktop(() => bridge!.decideApp(id, false))
                              }
                              data-testid="activity-app-block"
                            >
                              {t({ message: "Block", context: "activity" })}
                            </Button>
                            <Button
                              variant="tonal"
                              onPress={() =>
                                desktop(() => bridge!.decideApp(id, true))
                              }
                              data-testid="activity-app-show"
                            >
                              {t({ message: "Show", context: "activity" })}
                            </Button>
                          </Choice>
                        </Show>
                      )}
                    />
                  )}
                </Show>
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
              <Lines>
                <span>
                  <Trans>Receive their reports while that app is closed.</Trans>
                </span>
                <Show
                  when={
                    shares() && state()?.discordCompat && !state()?.compatOpen
                  }
                >
                  <span data-testid="activity-compat-aside">
                    <Trans>Stepped aside: the other chat app is open.</Trans>
                  </span>
                </Show>
              </Lines>
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
        </SettingsSection>
      </Show>

      <SettingsSection title={<Trans>Your privacy</Trans>}>
        <SettingsRow
          icon={<Symbol size={20}>info</Symbol>}
          title={<Trans>No history is kept</Trans>}
          description={
            <Trans>
              Only in memory while you are online, at most 24 hours.
            </Trans>
          }
          control={() => (
            <Button
              variant="text"
              aria-expanded={privacyOpen()}
              aria-controls="activity-privacy"
              onPress={() => setPrivacyOpen(!privacyOpen())}
              data-testid="activity-privacy-open"
            >
              <Show when={privacyOpen()} fallback={<Trans>Details</Trans>}>
                <Trans>Hide details</Trans>
              </Show>
            </Button>
          )}
        />
        {/* the same words as the privacy policy (legal RP-04), one tap away */}
        <Show when={privacyOpen()}>
          <Facts id="activity-privacy" data-testid="activity-privacy">
            <li>
              <Trans>
                On your computer: when sharing and "Detect games and apps" are
                on, the Zrzur desktop app reads the names of running programs
                every 15 seconds and compares them with its list and the
                programs you added. This happens only on your computer: only the
                name of a matched program is sent to Zrzur, the list of running
                programs never leaves your computer, and window titles, files
                and tabs are never read. Your choices (programs turned off,
                renamed or added, blocked apps, the paired browser extension)
                are stored only on your computer. Games, apps and the Zrzur
                extensions for browsers and VS Code report to the desktop app on
                your computer; they learn nothing about your account from Zrzur.
                With sharing off, the desktop app reads nothing and listens for
                nothing.
              </Trans>
            </li>
            <li>
              <Trans>
                Your activity is shown to the people who can see that you are
                online: your friends and people in your Servers, and bots with
                access to presence in those Servers. Nobody sees it while you
                are invisible or offline, and people you blocked never see it.
                On accounts of people aged 16 or 17, and accounts with no stated
                age, only friends see it.
              </Trans>
            </li>
            <li>
              <Trans>
                Activity: kept only in memory while you are online, and never
                longer than 24 hours. We keep no history of what you did.
              </Trans>
            </li>
            <Show when={steamFeature()}>
              <li data-testid="activity-privacy-steam">
                <Trans>
                  While you are online, Zrzur asks Steam (Valve, USA) about once
                  a minute which game your linked account is playing, and shows
                  it as your activity. Only games your Steam profile shows
                  publicly. Turn it off and it stops at once. Works on the web
                  and on phones too. Link Steam in Connections first.
                </Trans>
              </li>
            </Show>
          </Facts>
        </Show>
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

const Lines = styled("span", {
  base: { display: "flex", flexDirection: "column", gap: "4px" },
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

/* inside the preview, which already has the row's padding */
const PreviewHint = styled("p", {
  base: {
    margin: 0,
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

const RunningNow = styled("span", {
  base: { color: "var(--z-status-success)", fontWeight: 500 },
});

/* Show and Block side by side, the same size */
const Choice = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    "& > button": { _phone: { minHeight: "44px" } },
  },
});

const AppPath = styled("bdi", {
  base: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--z-font-mono, monospace)",
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
    textAlign: "start",
  },
});

const Code = styled("strong", {
  base: {
    fontFamily: "var(--z-font-mono, monospace)",
    fontSize: "15px",
    letterSpacing: "2px",
    color: "var(--z-fg-primary)",
  },
});

/* the list sits on the same 16 px line as every row; each bullet is a dot
   in the start margin, so wrapped lines stay aligned in ltr and rtl */
const Facts = styled("ul", {
  base: {
    margin: 0,
    padding: "12px 16px",
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& > li": {
      position: "relative",
      paddingInlineStart: "16px",
    },
    "& > li::before": {
      content: '""',
      position: "absolute",
      insetInlineStart: "4px",
      top: "8px",
      width: "4px",
      height: "4px",
      borderRadius: "full",
      background: "var(--z-fg-muted)",
    },
  },
});
