import { Show, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { Column, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
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
      onceScreenPicker(
        onScreenPick: (
          sources: {
            idx: number;
            name: string;
            isFullScreen: boolean;
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
      <SettingsSection>
        <SettingsRow
          icon={<Icon name="rocket-launch" size={20} />}
          title={<Trans>Start with Computer</Trans>}
          description={<Trans>Launch Zrzur when you log into your computer.</Trans>}
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
            title={t`Start Minimised to Tray`}
            description={t`Zrzur will start in the system tray.`}
          />
        </Show>
        <SwitchRow
          key="minimiseToTray"
          icon="tray"
          title={t`Minimise to Tray`}
          description={t`Instead of closing, Zrzur will hide in your tray.`}
        />
        <SwitchRow
          key="customFrame"
          icon="squares-four"
          title={t`Custom window frame`}
          description={t`Let Zrzur use its own custom titlebar.`}
        />
      </SettingsSection>

      <SettingsSection>
        <SwitchRow
          key="discordRpc"
          icon="users-three"
          title={t`Discord RPC`}
          description={t`Show Zrzur using Discord rich presence.`}
        />
        <SwitchRow
          key="spellchecker"
          icon="text-aa"
          title={t`Spellchecker`}
          description={t`Show corrections and suggestions as you type.`}
        />
        <SwitchRow
          key="hardwareAcceleration"
          icon="lightning"
          title={t`Hardware acceleration`}
          description={t`Use the graphics card to improve performance.`}
        />
      </SettingsSection>

      <SettingsSection>
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
