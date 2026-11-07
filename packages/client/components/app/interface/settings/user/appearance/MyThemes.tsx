import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { Button } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { APPEARANCE_PRESETS } from "@revolt/ui/themes/appearancePresets";
import {
  SavedTheme,
  parseThemeImport,
  readSavedThemes,
  writeSavedThemes,
} from "@revolt/ui/themes/savedThemes";

/**
 * Saved themes (local), import/export and reset — compact rows
 */
export function MyThemes() {
  const state = useState();
  const { t } = useLingui();
  const [themes, setThemes] = createSignal<SavedTheme[]>([]);
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  let fileInput!: HTMLInputElement;

  try {
    setThemes(readSavedThemes());
  } catch {
    setError(
      t`Saved themes could not be read. Export or repair local browser storage before saving.`,
    );
  }

  function update(next: SavedTheme[]) {
    try {
      writeSavedThemes(next);
      setThemes(next);
      setError("");
    } catch {
      setError(
        t`Could not save. Check browser storage and the limit of 32 themes.`,
      );
    }
  }

  function exportTheme(theme: SavedTheme) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "zrzur-theme.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importTheme(file?: File) {
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error();
      update([...themes(), parseThemeImport(await file.text())]);
    } catch {
      setError(
        t`Invalid theme file. Only validated Zrzur JSON themes up to 64 KB are supported.`,
      );
    }
  }

  function save() {
    try {
      update([
        ...themes(),
        {
          version: 1,
          name: name().trim(),
          settings: state.theme.exportSnapshot(),
        },
      ]);
      setName("");
    } catch {
      setError(t`Current preferences could not be saved as a theme.`);
    }
  }

  return (
    <Base>
      <Hint>
        <Trans>
          Themes are stored in this browser and contain appearance preferences
          only.
        </Trans>
      </Hint>

      <SaveRow
        onSubmit={(e) => {
          e.preventDefault();
          if (name().trim() && themes().length < 32) save();
        }}
      >
        <NameInput
          maxlength={60}
          placeholder={t`Name this look`}
          aria-label={t`Theme name`}
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
        />
        <Button
          size="sm"
          type="submit"
          isDisabled={!name().trim() || themes().length >= 32}
          onPress={save}
        >
          <Trans>Save current</Trans>
        </Button>
        <Button size="sm" variant="tonal" onPress={() => fileInput.click()}>
          <Icon name="upload-simple" size={16} />
          <Trans>Import</Trans>
        </Button>
        <Button
          size="sm"
          variant="text"
          onPress={() => {
            state.theme.applyAppearancePreset(APPEARANCE_PRESETS[0]);
            state.theme.setIconStyle("expressive");
            state.theme.setIconAccent("");
          }}
        >
          <Trans>Reset to default</Trans>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void importTheme(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </SaveRow>

      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>

      <Show when={themes().length}>
        <List>
          <For each={themes()}>
            {(theme, index) => (
              <Item>
                <Icon name="palette" size={18} />
                <ItemName>{theme.name}</ItemName>
                <Button
                  size="xs"
                  variant="tonal"
                  onPress={() => state.theme.applySnapshot(theme.settings)}
                >
                  <Trans>Apply</Trans>
                </Button>
                <Button
                  size="xs"
                  variant="text"
                  isDisabled={!name().trim()}
                  onPress={() =>
                    update(
                      themes().map((item, i) =>
                        i === index() ? { ...item, name: name().trim() } : item,
                      ),
                    )
                  }
                  use:floating={{
                    tooltip: {
                      placement: "top",
                      content: t`Type a new name above, then rename`,
                    },
                  }}
                >
                  <Trans>Rename</Trans>
                </Button>
                <Button
                  size="xs"
                  variant="text"
                  onPress={() =>
                    update([
                      ...themes(),
                      { ...theme, name: theme.name.slice(0, 53) + " (copy)" },
                    ])
                  }
                >
                  <Trans>Duplicate</Trans>
                </Button>
                <Button
                  size="xs"
                  variant="text"
                  onPress={() => exportTheme(theme)}
                >
                  <Trans>Export</Trans>
                </Button>
                <Button
                  size="xs"
                  variant="text"
                  onPress={() =>
                    update(themes().filter((_, i) => i !== index()))
                  }
                >
                  <Trans>Delete</Trans>
                </Button>
              </Item>
            )}
          </For>
        </List>
      </Show>
    </Base>
  );
}

const Base = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px" },
});

const Hint = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-fg-muted)" },
});

const SaveRow = styled("form", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
});

const NameInput = styled("input", {
  base: {
    width: "220px",
    height: "32px",
    paddingInline: "10px",
    borderRadius: "6px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    fontFamily: "inherit",
    outline: "none",
    "&::placeholder": { color: "var(--z-fg-muted)" },
    "&:focus-visible": { boxShadow: "0 0 0 2px var(--z-focus)" },
  },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column" },
});

const Item = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "44px",
    borderBottom: "1px solid var(--z-border-subtle)",
    "--z-icon-color": "var(--z-icon-neutral)",
    "&:last-child": { borderBottom: "none" },
  },
});

const ItemName = styled("span", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    marginInlineStart: "4px",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-fg-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
