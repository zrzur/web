import { Index, Show, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { User, UserProfile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useError } from "@revolt/i18n";
import {
  Button,
  Checkbox,
  Column,
  SettingsFormPanel,
  SettingsSaveBar,
  SettingsSection,
  TextField,
  useSnackbar,
} from "@revolt/ui";
import { useSectionLabels } from "@revolt/ui/components/features/profiles/labels";
import {
  CREATOR_SECTIONS,
  MAX_LINKS,
  SectionRow,
  linkProblem,
  moveRow,
  rowsToProfile,
  sectionRows,
  siteAddress,
} from "@revolt/ui/components/features/profiles/sections";
import {
  Draggable,
  createDragHandle,
} from "@revolt/ui/components/utils/Draggable";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Which sections show on your profile and in what order. Drag a row, use its
 * buttons, or press Alt with the up or down arrow. What you hide is not sent
 * to anyone.
 */
export function ProfileSectionsEditor(props: {
  user: User;
  profile?: UserProfile;
}) {
  const { t } = useLingui();
  const label = useSectionLabels();
  const [rows, setRows] = createSignal<SectionRow[]>(sectionRows());
  const [dirty, setDirty] = createSignal(false);
  const [announce, setAnnounce] = createSignal("");
  const offered = (row: SectionRow) =>
    !!props.profile?.creator || !CREATOR_SECTIONS.includes(row.id);
  const listed = () => rows().filter(offered);
  const box = useBoxSave(
    () =>
      props.user.edit({
        profile: rowsToProfile(rows(), props.profile?.hiddenSections),
      }),
    () => setDirty(false),
  );

  createEffect(
    on(
      () => props.profile,
      (profile) => {
        if (profile) {
          setRows(sectionRows(profile.sections, profile.hiddenSections));
          setDirty(false);
        }
      },
    ),
  );

  /** A new order of the listed rows; the rows not offered keep their place last */
  function change(next: SectionRow[]) {
    setRows([...next, ...rows().filter((row) => !offered(row))]);
    setDirty(true);
  }

  function move(index: number, by: number) {
    const list = listed();
    const next = moveRow(list, index, by);
    if (next === list) return;
    change(next);
    setAnnounce(t`${label(next[index + by].id)}: position ${index + by + 1}`);
  }

  function reset() {
    setRows(
      sectionRows(props.profile?.sections, props.profile?.hiddenSections),
    );
    setDirty(false);
    box.setError(undefined);
  }

  return (
    <Column gap="md">
      <SettingsSection
        title={<Trans>Profile sections</Trans>}
        description={
          <Trans>
            Choose what shows on your profile and in what order. Hidden sections
            are not sent to anyone.
          </Trans>
        }
      >
        <SettingsFormPanel>
          <div>
            <Draggable
              dragHandles
              items={listed()}
              onChange={(ids) => {
                const byId = new Map(
                  rows().map((row) => [row.id as string, row]),
                );
                change(ids.map((id) => byId.get(id)!));
              }}
            >
              {(entry) => {
                const index = () =>
                  listed().findIndex((r) => r.id === entry.item.id);
                return (
                  <Row
                    data-testid={`section-row-${entry.item.id}`}
                    tabIndex={0}
                    aria-label={label(entry.item.id)}
                    onKeyDown={(e) => {
                      if (!e.altKey) return;
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        move(index(), e.key === "ArrowUp" ? -1 : 1);
                        queueMicrotask(() => e.currentTarget?.focus?.());
                      }
                    }}
                  >
                    <Handle
                      {...createDragHandle(
                        entry.dragDisabled,
                        entry.setDragDisabled,
                      )}
                      aria-label={t`Drag to reorder ${label(entry.item.id)}`}
                    >
                      <Icon name="dots-six-vertical" size={16} />
                    </Handle>
                    <Checkbox
                      checked={entry.item.shown}
                      onChange={(e) =>
                        change(
                          listed().map((row) =>
                            row.id === entry.item.id
                              ? { ...row, shown: e.currentTarget.checked }
                              : row,
                          ),
                        )
                      }
                    >
                      {label(entry.item.id)}
                    </Checkbox>
                    <Moves>
                      <MoveButton
                        type="button"
                        aria-label={t`Move ${label(entry.item.id)} up`}
                        disabled={index() === 0}
                        onClick={() => move(index(), -1)}
                      >
                        <Icon name="caret-up" size={16} />
                      </MoveButton>
                      <MoveButton
                        type="button"
                        aria-label={t`Move ${label(entry.item.id)} down`}
                        disabled={index() === listed().length - 1}
                        onClick={() => move(index(), 1)}
                      >
                        <Icon name="caret-down" size={16} />
                      </MoveButton>
                    </Moves>
                  </Row>
                );
              }}
            </Draggable>
          </div>
          <Announce aria-live="polite">{announce()}</Announce>
          <Hint>
            <Trans>
              Roles, mutual servers and the message box keep their place.
            </Trans>
          </Hint>
        </SettingsFormPanel>
      </SettingsSection>
      <SettingsSaveBar
        show={dirty()}
        saving={box.saving()}
        error={box.error()}
        onReset={reset}
        onSave={() => void box.save()}
      />
    </Column>
  );
}

/** Saving one box: what its save bar shows, and the "Saved" notice */
function useBoxSave(send: () => Promise<unknown>, done: () => void) {
  const { t } = useLingui();
  const describeError = useError();
  const snackbar = useSnackbar();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      await send();
      done();
      snackbar.show({ message: t`Saved`, replaceActive: true });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, error, setError };
}

/** Links: real addresses only, checked again by the server */
export function ProfileLinksEditor(props: {
  user: User;
  profile?: UserProfile;
}) {
  const { t } = useLingui();
  const [links, setLinks] = createSignal<string[]>([]);
  const [dirty, setDirty] = createSignal(false);
  const [checked, setChecked] = createSignal(false);
  const box = useBoxSave(
    () =>
      props.user.edit({
        profile: {
          links: links()
            .map((l) => l.trim())
            .filter(Boolean),
        },
      }),
    () => setDirty(false),
  );

  /** What to say under a link, once the person tried to save */
  const problem = (link: string) => {
    if (!checked()) return undefined;
    switch (linkProblem(link)) {
      case "https":
        return t`Links must start with https://`;
      case "address":
        return t`Use a real site address, such as https://example.com`;
      default:
        return undefined;
    }
  };

  createEffect(
    on(
      () => props.profile,
      (profile) => {
        if (profile) {
          setLinks([...(profile.links ?? [])]);
          setDirty(false);
        }
      },
    ),
  );

  function set(next: string[]) {
    setLinks(next);
    setDirty(true);
  }

  function save() {
    setChecked(true);
    if (!links().some(linkProblem)) void box.save();
  }

  function reset() {
    setLinks([...(props.profile?.links ?? [])]);
    setDirty(false);
    setChecked(false);
    box.setError(undefined);
  }

  return (
    <Column gap="md">
      <SettingsSection
        title={<Trans>Links</Trans>}
        description={
          <Trans>
            Up to {MAX_LINKS} links, starting with https://. People see the real
            site address and a warning before they leave Zrzur. Others can see
            this.
          </Trans>
        }
      >
        <SettingsFormPanel>
          <Show when={!links().length}>
            <Hint>
              <Trans>No links yet.</Trans>
            </Hint>
          </Show>
          <Index each={links()}>
            {(link, index) => (
              <LinkLine>
                <LinkField>
                  <TextField
                    dir="ltr"
                    type="url"
                    aria-label={t`Link ${index + 1}`}
                    placeholder="https://"
                    maxlength={256}
                    value={link()}
                    error={problem(link())}
                    helper={
                      link().startsWith("https://")
                        ? siteAddress(link())
                        : undefined
                    }
                    onInput={(e) =>
                      set(
                        links().map((old, i) =>
                          i === index ? e.currentTarget.value : old,
                        ),
                      )
                    }
                  />
                </LinkField>
                <RemoveButton
                  type="button"
                  aria-label={t`Remove link ${index + 1}`}
                  onClick={() => set(links().filter((_, i) => i !== index))}
                >
                  <Icon name="x" size={16} />
                </RemoveButton>
              </LinkLine>
            )}
          </Index>
          <Show when={links().length < MAX_LINKS}>
            <div>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => set([...links(), ""])}
              >
                <Trans>Add link</Trans>
              </Button>
            </div>
          </Show>
        </SettingsFormPanel>
      </SettingsSection>
      <SettingsSaveBar
        show={dirty()}
        saving={box.saving()}
        error={box.error()}
        onReset={reset}
        onSave={save}
      />
    </Column>
  );
}

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    paddingInline: "8px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    marginBottom: "8px",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    "& > label": { flex: 1, minWidth: 0 },
    "@media (max-width: 600px)": { gap: "4px", paddingInline: "4px" },
  },
});

const Handle = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--z-icon-muted)",
    cursor: "grab",
    "--z-icon-color": "currentColor",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      borderRadius: "6px",
    },
    "@media (max-width: 600px)": { width: "44px", height: "44px" },
  },
});

const Moves = styled("div", {
  base: { display: "flex", gap: "4px", flexShrink: 0 },
});

const MoveButton = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-icon-muted)",
    cursor: "pointer",
    flexShrink: 0,
    "--z-icon-color": "currentColor",
    _hover: { color: "var(--z-icon-hover)" },
    _disabled: { opacity: 0.4, cursor: "default" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "@media (max-width: 600px)": { width: "44px", height: "44px" },
  },
});

const Announce = styled("div", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const LinkLine = styled("div", {
  base: { display: "flex", alignItems: "flex-start", gap: "8px" },
});

const LinkField = styled("div", {
  base: { flex: 1, minWidth: 0 },
});

const RemoveButton = styled("button", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "44px",
    height: "44px",
    padding: 0,
    border: "none",
    borderRadius: "var(--z-radius, 10px)",
    background: "transparent",
    color: "var(--z-icon-muted)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { color: "var(--z-danger)" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});
