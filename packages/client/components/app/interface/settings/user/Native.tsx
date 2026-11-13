import { Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import {
  Button,
  Column,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

declare type DesktopConfig = {
  firstLaunch: boolean;
  customFrame: boolean;
  minimiseToTray: boolean;
  startMinimisedToTray: boolean;
  spellchecker: boolean;
  hardwareAcceleration: boolean;
  discordRpc: boolean;
  windowState: {
    isMaximised: boolean;
  };
};

declare global {
  interface Window {
    native: {
      versions: {
        node(): string;
        chrome(): string;
        electron(): string;
        desktop(): string;
      };
      minimise(): void;
      maximise(): void;
      close(): void;
      /** Restart the app (missing from older desktop apps) */
      relaunch?(): void;
      onceScreenPicker(
        onScreenPick: (
          sources: {
            idx: number;
            kind?: "screen" | "window";
            name: string;
            isFullScreen: boolean;
            screenNumber?: number;
            screenCount?: number;
            thumbnail?: string;
            image?: string;
          }[],
        ) => void,
      ): void;
      screenPickerCallback(idx: number, audio: boolean): void;
      isWayland?(): boolean;
    };

    desktopConfig: {
      get(): DesktopConfig;
      set(config: Partial<DesktopConfig>): void;
      getAutostart(): Promise<boolean>;
      setAutostart(value: boolean): Promise<boolean>;
    };
  }
}

type Switchable = keyof Omit<DesktopConfig, "windowState" | "firstLaunch">;

/**
 * Desktop Configuration Page: the same sections, rows and switches as every
 * other settings page (it used the older button cards, in a lighter colour)
 */
export default function Native() {
  const { t } = useLingui();
  const [autostart, setAutostart] = createSignal(false);
  const [config, setConfig] = createSignal(window.desktopConfig.get());

  function set(config: Partial<DesktopConfig>) {
    window.desktopConfig.set(config);
    setConfig((conf) => ({ ...conf, ...config }));
  }

  onMount(async () => {
    const value = await window.desktopConfig.getAutostart();
    setAutostart(value);
  });

  async function toggleAutostart() {
    const newValue = !autostart();
    const savedValue = await window.desktopConfig.setAutostart(newValue);
    setAutostart(savedValue);
  }

  /** What the app started with: these two only change after a restart */
  const started = window.desktopConfig.get();
  const needsRestart = () =>
    config().customFrame !== started.customFrame ||
    config().hardwareAcceleration !== started.hardwareAcceleration;

  const toggle = (key: Switchable) => () => set({ [key]: !config()[key] });

  /** One setting with a switch, as on the other settings pages */
  const SwitchRow = (props: {
    key: Switchable;
    icon: Parameters<typeof Icon>[0]["name"];
    title: string;
    description: string;
  }) => (
    <SettingsRow
      icon={<Icon name={props.icon} size={20} />}
      title={props.title}
      description={props.description}
      onClick={toggle(props.key)}
      control={(ids) => (
        <Toggle
          checked={!!config()[props.key]}
          onChange={toggle(props.key)}
          aria-labelledby={ids.labelId}
          aria-describedby={ids.descriptionId}
        />
      )}
    />
  );

  return (
    <Column gap="xl">
      <Show when={needsRestart()}>
        <SettingsSection>
          <SettingsRow
            icon={<Icon name="arrow-clockwise" size={20} />}
            title={<Trans>Restart Zrzur to apply your changes</Trans>}
            description={
              <Trans>
                The title bar and hardware acceleration change when Zrzur
                starts. A call you are in ends.
              </Trans>
            }
            control={() => (
              <Show when={window.native.relaunch}>
                <Button
                  size="sm"
                  variant="filled"
                  onPress={() => window.native.relaunch?.()}
                  data-testid="desktop-restart"
                >
                  <Trans>Restart now</Trans>
                </Button>
              </Show>
            )}
          />
        </SettingsSection>
      </Show>

      <SettingsSection title={<Trans>Startup</Trans>}>
        <SettingsRow
          icon={<Icon name="rocket-launch" size={20} />}
          title={<Trans>Open Zrzur when the computer starts</Trans>}
          description={
            <Trans>
              Zrzur opens by itself after you sign in to your computer.
            </Trans>
          }
          onClick={toggleAutostart}
          control={(ids) => (
            <Toggle
              checked={autostart()}
              onChange={toggleAutostart}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
          )}
        />
        <Show when={autostart()}>
          <SwitchRow
            key="startMinimisedToTray"
            icon="minus"
            title={t`Start in the tray`}
            description={t`Zrzur starts hidden. Open it from its icon next to the clock.`}
          />
        </Show>
      </SettingsSection>

      <SettingsSection title={<Trans>Window</Trans>}>
        <SwitchRow
          key="minimiseToTray"
          icon="tray"
          title={t`Keep running when the window is closed`}
          description={t`Zrzur stays in the tray, so calls and notifications continue.`}
        />
        <SwitchRow
          key="customFrame"
          icon="squares-four"
          title={t`Zrzur title bar`}
          description={t`Zrzur draws its own title bar instead of the system's. Changes after a restart.`}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>Typing and performance</Trans>}>
        <SwitchRow
          key="spellchecker"
          icon="text-aa"
          title={t`Spell check`}
          description={t`Marks misspelled words and suggests corrections as you type.`}
        />
        <SwitchRow
          key="hardwareAcceleration"
          icon="lightning"
          title={t`Hardware acceleration`}
          description={t`Uses the graphics card for a smoother app. Turn it off if a game stutters or the window flickers. Changes after a restart.`}
        />
      </SettingsSection>

      <SettingsSection title={<Trans>About</Trans>}>
        <SettingsRow
          icon={<Icon name="desktop" size={20} />}
          title={<Trans>Zrzur for Desktop</Trans>}
          description={
            <>
              <Trans>Version:</Trans>{" "}
              <bdi dir="ltr">{window.native.versions.desktop()}</bdi>
            </>
          }
        />
      </SettingsSection>
    </Column>
  );
}
