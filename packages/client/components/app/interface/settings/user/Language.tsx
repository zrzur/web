import { For, Show, createMemo, createSignal, createUniqueId } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Language, Languages } from "@revolt/i18n";
import type { LanguageEntry } from "@revolt/i18n/Languages";
import { LANGUAGE_COVERAGE } from "@revolt/i18n/coverage";
import { timeLocale, useTime } from "@revolt/i18n/dayjs";
import { useState } from "@revolt/state";
import {
  Column,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  SettingsSection,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Language
 */
export function LanguageSettings() {
  return (
    <Column gap="xl">
      <PickLanguage />
      <PickDateTime />
      <SettingsSection>
        <SettingsRow
          icon={<Icon name="translate" size={20} />}
          title={<Trans>Contribute a language</Trans>}
          description={
            <Trans>Help translate Zrzur into an existing or new language</Trans>
          }
          onClick={() => window.open("/translate", "_blank", "noopener")}
          navigational
          control={() => <Icon name="arrow-square-out" size={16} />}
        />
      </SettingsSection>
    </Column>
  );
}

/**
 * Short code shown before each language (AR, EN, DE …). No flags: a
 * language is not a country, and the interface shows no flags.
 * @param id Language id, e.g. "en_GB"
 */
export function languageCode(id: string) {
  const [base, region] = id.split(/[-_]/);
  return (
    region && region.length <= 2 && base === "en" ? `${base}-${region}` : base
  ).toUpperCase();
}

type Item = {
  id: Language;
  entry: LanguageEntry;
  coverage: number;
  /** Name of the language in the current UI language, e.g. "German" */
  localName?: string;
};

const COMPLETE = 95;
const PARTIAL = 50;

/**
 * Pick user's preferred language
 */
function PickLanguage() {
  const { locale } = useState();
  const { i18n, t } = useLingui();

  const [query, setQuery] = createSignal("");
  const [showMore, setShowMore] = createSignal(false);
  // the full list only appears after clicking the current-language row
  const [open, setOpen] = createSignal(false);
  const listId = createUniqueId();
  let trigger: HTMLButtonElement | undefined;
  let searchRow: HTMLDivElement | undefined;

  const openList = () => {
    setOpen(true);
    // land in the search field so typing filters straight away
    queueMicrotask(() => searchRow?.querySelector("input")?.focus());
  };

  const current = () => i18n().locale as Language;

  const items = createMemo(() => {
    let names: Intl.DisplayNames | undefined;
    try {
      names = new Intl.DisplayNames([i18n().locale, "en"], {
        type: "language",
      });
    } catch {
      // older engines: no localized names, native names only
    }
    const collator = new Intl.Collator(i18n().locale);

    return (Object.keys(Languages) as Language[])
      .map((id): Item => {
        const entry = Languages[id];
        let localName: string | undefined;
        try {
          const name = names?.of(id);
          if (name && name !== id && name !== entry.display) localName = name;
        } catch {
          // unknown tag
        }
        return {
          id,
          entry,
          coverage:
            entry.i18n === "en" ? 100 : (LANGUAGE_COVERAGE[entry.i18n] ?? 0),
          localName,
        };
      })
      .sort((a, b) => collator.compare(a.entry.display, b.entry.display));
  });

  const filtered = () => {
    const q = query().trim().toLocaleLowerCase();
    if (!q) return undefined;
    return items().filter(
      (item) =>
        item.entry.display.toLocaleLowerCase().includes(q) ||
        item.localName?.toLocaleLowerCase().includes(q) ||
        item.id.toLowerCase().startsWith(q),
    );
  };

  const complete = () => items().filter((i) => i.coverage >= COMPLETE);
  const partial = () =>
    items().filter((i) => i.coverage >= PARTIAL && i.coverage < COMPLETE);
  const more = () => items().filter((i) => i.coverage < PARTIAL);

  // the current language is always visible, even if it lives under "more"
  const moreOpen = () =>
    showMore() || more().some((item) => item.id === current());

  const close = () => {
    setOpen(false);
    setQuery("");
    trigger?.focus();
  };

  const select = (id: Language) => {
    if (id !== current()) locale.switch(id);
    close();
  };

  /** Roving focus between the visible options */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // close the list, not the whole settings page
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const radios = [
      ...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        '[role="radio"]',
      ),
    ];
    const index = radios.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? radios.length - 1
          : Math.min(
              radios.length - 1,
              Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)),
            );
    e.preventDefault();
    radios[next]?.focus();
  };

  const marker = (item: Item) => (
    <Marker aria-hidden="true" lang="en">
      {languageCode(item.id)}
    </Marker>
  );

  const currentItem = () => items().find((item) => item.id === current());

  const option = (item: Item) => {
    const selected = () => item.id === current();
    return (
      <Option
        type="button"
        role="radio"
        aria-checked={selected()}
        // roving focus: the selected option is the Tab stop; while searching
        // every match is (the selection may be filtered out)
        tabIndex={selected() || filtered() ? 0 : -1}
        data-selected={selected()}
        lang={item.id}
        onClick={() => select(item.id)}
      >
        {marker(item)}
        <Names>
          <NativeName dir="auto">{item.entry.display}</NativeName>
          <Show when={item.localName}>
            <LocalName lang={i18n().locale}>{item.localName}</LocalName>
          </Show>
        </Names>
        <Show when={item.coverage < COMPLETE}>
          <Coverage lang={i18n().locale} dir="auto">
            <Trans>{item.coverage}% translated</Trans>
          </Coverage>
        </Show>
        <Check aria-hidden="true">
          <Show when={selected()}>
            <Icon name="check" size={16} />
          </Show>
        </Check>
      </Option>
    );
  };

  return (
    <Column gap="md">
      <SettingsSection
        title={<Trans>Language</Trans>}
        description={<Trans>Untranslated text falls back to English.</Trans>}
      >
        <div
          // while open, Escape anywhere in the picker closes the list and
          // must not reach the global "close settings" keybind on <body>;
          // a native listener, since delegated onKeyDown runs after it
          on:keydown={(e: KeyboardEvent) => {
            if (e.key === "Escape" && open()) {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
        >
          <Trigger
            ref={trigger}
            type="button"
            aria-expanded={open()}
            aria-controls={listId}
            data-open={open()}
            onClick={() => (open() ? close() : openList())}
          >
            <Show
              when={currentItem()}
              fallback={<Icon name="globe" size={20} />}
            >
              {marker(currentItem()!)}
            </Show>
            <Names>
              <NativeName dir="auto">{currentItem()?.entry.display}</NativeName>
              <Show when={currentItem()?.localName}>
                <LocalName lang={i18n().locale}>
                  {currentItem()!.localName}
                </LocalName>
              </Show>
            </Names>
            <TriggerHint>
              <Show when={open()} fallback={<Trans>Change</Trans>}>
                <Trans>Close</Trans>
              </Show>
            </TriggerHint>
            <Chevron aria-hidden="true" data-chevron>
              <Icon name="caret-down" size={16} />
            </Chevron>
          </Trigger>
          <Show when={open()}>
            <SearchRow ref={searchRow}>
              <TextField
                type="search"
                aria-label={t`Search languages`}
                placeholder={t`Search languages`}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                autocomplete="off"
                spellcheck={false}
              />
            </SearchRow>
            <div
              id={listId}
              role="radiogroup"
              aria-label={t`Language`}
              onKeyDown={onKeyDown}
            >
              <Show
                when={filtered()}
                fallback={
                  <>
                    <GroupLabel>
                      <Trans>Fully translated</Trans>
                    </GroupLabel>
                    <For each={complete()}>{option}</For>
                    <Show when={partial().length}>
                      <GroupLabel>
                        <Trans>Partly translated</Trans>
                      </GroupLabel>
                      <For each={partial()}>{option}</For>
                    </Show>
                    <Show
                      when={moreOpen()}
                      fallback={
                        <MoreButton
                          type="button"
                          onClick={() => setShowMore(true)}
                        >
                          <Icon name="caret-down" size={16} />
                          <Trans>
                            Show {more().length} more languages in progress
                          </Trans>
                        </MoreButton>
                      }
                    >
                      <GroupLabel>
                        <Trans>In progress</Trans>
                      </GroupLabel>
                      <For each={more()}>{option}</For>
                    </Show>
                  </>
                }
              >
                <Show
                  when={filtered()!.length}
                  fallback={
                    <Empty>
                      <Trans>No language matches “{query().trim()}”.</Trans>
                    </Empty>
                  }
                >
                  <For each={filtered()}>{option}</For>
                </Show>
              </Show>
            </div>
          </Show>
        </div>
      </SettingsSection>
    </Column>
  );
}

/**
 * Pick user's preferred date and time format, with live examples
 */
function PickDateTime() {
  const { locale } = useState();
  const dayjs = useTime();

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const now = new Date();

  const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
  const dateName = (format: string) =>
    format === "DD/MM/YYYY" ? (
      <Trans>Day first</Trans>
    ) : format === "MM/DD/YYYY" ? (
      <Trans>Month first</Trans>
    ) : (
      <Trans>ISO 8601</Trans>
    );

  return (
    <SettingsSection title={<Trans>Date and time</Trans>}>
      <SettingsRow
        icon={<Icon name="calendar" size={20} />}
        title={<Trans>Date format</Trans>}
        description={<Trans>Used in message timestamps and lists.</Trans>}
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={timeLocale()[1].formats.L}
              onChange={(e) => {
                if (e.currentTarget.value)
                  locale.setDateFormat(e.currentTarget.value);
              }}
            >
              <For each={DATE_FORMATS}>
                {(format) => (
                  <MenuItem value={format}>
                    {dayjs(lastWeek).format(format)} · {dateName(format)}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
      <SettingsRow
        icon={<Icon name="clock" size={20} />}
        title={<Trans>Time format</Trans>}
        control={(ids) => (
          <SelectWidth>
            <FloatingSelect
              aria-labelledby={ids.labelId}
              value={timeLocale()[1].formats.LT}
              onChange={(e) => {
                if (e.currentTarget.value)
                  locale.setTimeFormat(e.currentTarget.value);
              }}
            >
              <MenuItem value="HH:mm">
                {dayjs(now).format("HH:mm")} · <Trans>24-hour</Trans>
              </MenuItem>
              <MenuItem value="h:mm A">
                {dayjs(now).format("h:mm A")} · <Trans>12-hour</Trans>
              </MenuItem>
            </FloatingSelect>
          </SelectWidth>
        )}
      />
    </SettingsSection>
  );
}

/**
 * Collapsed state: one row with the current language; opens the list
 */
const Trigger = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    minHeight: "52px",
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 0.1s ease",

    _hover: { background: "var(--z-nav-hover)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    "&[data-open='true']": {
      borderBottom: "1px solid var(--z-border-subtle)",
    },
    "&[data-open='true'] [data-chevron]": {
      transform: "rotate(180deg)",
    },
  },
});

const TriggerHint = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--z-fg-muted)",
  },
});

const Chevron = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    transition: "transform 0.15s ease",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});

const SearchRow = styled("div", {
  base: {
    padding: "12px 12px 4px",
  },
});

const GroupLabel = styled("div", {
  base: {
    padding: "12px 16px 4px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const Option = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "calc(100% - 12px)",
    minHeight: "44px",
    margin: "0 6px",
    padding: "6px 10px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background-color 0.1s ease",

    _hover: {
      background: "var(--z-nav-hover)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
    "&[data-selected='true']": {
      background: "var(--z-nav-selected)",
    },
    "&:last-child": {
      marginBottom: "6px",
    },
  },
});

const Marker = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    minWidth: "32px",
    height: "22px",
    paddingInline: "4px",
    flexShrink: 0,
    borderRadius: "6px",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    lineHeight: 1,
  },
});

const Names = styled("span", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    flexWrap: "wrap",
  },
});

const NativeName = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
  },
});

const LocalName = styled("span", {
  base: {
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Coverage = styled("span", {
  base: {
    flexShrink: 0,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-fg-muted)",
  },
});

const Check = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "18px",
    flexShrink: 0,
    "--z-icon-color": "var(--z-accent)",
  },
});

const MoreButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "calc(100% - 12px)",
    margin: "4px 6px 6px",
    padding: "10px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    "--z-icon-color": "var(--z-icon-muted)",

    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "none",
      boxShadow: "inset 0 0 0 2px var(--z-focus)",
    },
  },
});

const Empty = styled("div", {
  base: {
    padding: "16px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const SelectWidth = styled("div", {
  base: {
    width: "min(240px, 40vw)",
  },
});
