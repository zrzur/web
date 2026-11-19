import { For, JSX } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { saveData, setSaveData } from "@revolt/common/lib/saveData";
import { SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import type { IconName } from "@revolt/ui/icons/registry";

/**
 * Settings page "Save data": one switch for this device, and under it what
 * the switch changes, one plain line each. The lines are the promise the
 * code keeps (`common/lib/saveData.ts`); nothing is listed that the app does
 * not do.
 */
export function SaveDataSettings() {
  const changes: { icon: IconName; text: () => JSX.Element }[] = [
    {
      icon: "image",
      text: () => (
        <Trans>Large pictures wait for a tap. Small ones load as usual.</Trans>
      ),
    },
    {
      icon: "gif",
      text: () => (
        <Trans>GIFs and videos do not load or play until you tap them.</Trans>
      ),
    },
    {
      icon: "link",
      text: () => (
        <Trans>
          Link previews show their text. Their pictures wait for a tap.
        </Trans>
      ),
    },
    {
      icon: "user-circle",
      text: () => (
        <Trans>
          Avatars, server icons and banners load as previews, never as the
          animated original.
        </Trans>
      ),
    },
    {
      icon: "sparkle",
      text: () => (
        <Trans>
          Animated decorations, nameplates and profile effects stay still.
        </Trans>
      ),
    },
    {
      icon: "cloud-arrow-down",
      text: () => (
        <Trans>
          Nothing is downloaded ahead for screens you have not opened.
        </Trans>
      ),
    },
    {
      icon: "microphone",
      text: () => (
        <Trans>
          In calls your voice is sent at a lower bitrate, and other people's
          cameras and screens wait for a tap.
        </Trans>
      ),
    },
  ];

  return (
    <SettingsSection
      // the page's own title says "Save data"; a second one here would repeat it
      description={
        <Trans>
          For weak or metered internet. The choice is kept on this device only,
          so your phone and your computer can differ.
        </Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="cloud-arrow-down" size={20} />}
        title={<Trans>Save data</Trans>}
        description={
          <Trans>
            Uses less mobile data. You can load anything with a tap.
          </Trans>
        }
        onClick={() => setSaveData(!saveData())}
        control={(ids) => (
          <Toggle
            checked={saveData()}
            onChange={setSaveData}
            aria-labelledby={ids.labelId}
            aria-describedby={ids.descriptionId}
          />
        )}
      />
      <Changes data-save-data-changes>
        <Heading>
          <Trans>What changes while it is on</Trans>
        </Heading>
        <List>
          <For each={changes}>
            {(change) => (
              <li>
                <Mark aria-hidden="true">
                  <Icon name={change.icon} size={20} />
                </Mark>
                <span>{change.text()}</span>
              </li>
            )}
          </For>
        </List>
      </Changes>
    </SettingsSection>
  );
}

const Changes = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    color: "var(--z-fg-primary)",
  },
});

const Heading = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const List = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      fontSize: "14px",
      lineHeight: "20px",
      minWidth: 0,
    },
    "& li > span:last-child": {
      minWidth: 0,
      overflowWrap: "anywhere",
    },
  },
});

const Mark = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "20px",
    height: "20px",
    color: "var(--z-fg-secondary)",
  },
});
