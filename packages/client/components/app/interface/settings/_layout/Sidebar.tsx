import { Accessor, For, Setter, Show, createSignal, onMount } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Column, OverflowingText } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

// import { error as MdError } from "@revolt/ui/icons/legacy";
// import { open_in_new as MdOpenInNew } from "@revolt/ui/icons/legacy";
import { SettingsEntry, SettingsList } from "..";
import { useSettingsNavigation } from "../Settings";
import { matchesSearch } from "./search";

import {
  SidebarButton,
  SidebarButtonContent,
  SidebarButtonTitle,
} from "./SidebarButton";

/**
 * Settings Sidebar Layout
 */
export function SettingsSidebar(props: {
  list: Accessor<SettingsList<unknown>>;
  setPage: Setter<string | undefined>;
  page: Accessor<string | undefined>;
}) {
  const { navigate } = useSettingsNavigation();
  const { t } = useLingui();

  // settings search: pages match on their keywords (name and settings)
  const [query, setQuery] = createSignal("");
  const needle = () => query().trim();
  const matches = (entry: SettingsEntry) =>
    matchesSearch(entry.keywords, query());
  const categoryMatches = (category: { entries: SettingsEntry[] }) =>
    category.entries.some((entry) => !entry.hidden && matches(entry));

  /**
   * Select the first page this person can see on load
   */
  onMount(() => {
    if (!props.page()) {
      const first = props
        .list()
        .entries.filter((category) => !category.hidden)
        .flatMap((category) => category.entries)
        .find((entry) => !entry.hidden && entry.id);
      props.setPage(first?.id);
    }
  });

  return (
    <Base class="settings_sidebar">
      <div use:invisibleScrollable>
        <Content class="content">
          <Column gap="lg">
            {props.list().prepend}
            <Show when={props.list().search}>
              <Search>
                <Icon name="magnifying-glass" size={16} />
                <input
                  type="search"
                  value={query()}
                  placeholder={t`Search settings`}
                  aria-label={t`Search settings`}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    // Enter opens the first page that matches
                    if (event.key !== "Enter" || !needle()) return;
                    const first = props
                      .list()
                      .entries.filter((category) => !category.hidden)
                      .flatMap((category) => category.entries)
                      .find(
                        (entry) => !entry.hidden && entry.id && matches(entry),
                      );
                    if (first) navigate(first);
                  }}
                />
              </Search>
              <Show
                when={
                  needle() &&
                  !props
                    .list()
                    .entries.some(
                      (category) =>
                        !category.hidden && categoryMatches(category),
                    )
                }
              >
                <NoResults role="status">{t`Nothing found`}</NoResults>
              </Show>
            </Show>
            <For each={props.list().entries}>
              {(category) => (
                <Show when={!category.hidden && categoryMatches(category)}>
                  <Column>
                    <Show when={category.title}>
                      <CategoryTitle>{category.title}</CategoryTitle>
                    </Show>
                    <Column gap="s">
                      <For each={category.entries}>
                        {(entry) => (
                          <Show when={!entry.hidden && matches(entry)}>
                            <SidebarButton
                              onClick={() => navigate(entry)}
                              aria-selected={
                                props.page()?.split("/")[0] ===
                                entry.id?.split("/")[0]
                              }
                            >
                              <SidebarButtonTitle>
                                {entry.icon}
                                <SidebarButtonContent>
                                  <OverflowingText>
                                    {entry.title}
                                  </OverflowingText>
                                </SidebarButtonContent>
                              </SidebarButtonTitle>
                              {/*<SidebarButtonIcon>
                                <MdOpenInNew
                                  {...iconSize(20)}
                                  fill={theme!.colour("primary")}
                                />
                                <MdError
                                  {...iconSize(20)}
                                  fill={theme!.colour("primary")}
                                />
                              </SidebarButtonIcon>*/}
                            </SidebarButton>
                            {/* while searching: the parts of the page that match */}
                            <Show when={needle() && entry.sections?.length}>
                              <For each={entry.sections}>
                                {(section) => (
                                  <Show
                                    when={matchesSearch(
                                      section.keywords,
                                      query(),
                                    )}
                                  >
                                    <SidebarButton
                                      class="section_result"
                                      onClick={() =>
                                        navigate(`${entry.id}#${section.id}`)
                                      }
                                    >
                                      <SectionResult>
                                        <OverflowingText>
                                          {section.title}
                                        </OverflowingText>
                                      </SectionResult>
                                    </SidebarButton>
                                  </Show>
                                )}
                              </For>
                            </Show>
                          </Show>
                        )}
                      </For>
                    </Column>
                  </Column>
                </Show>
              )}
            </For>
            {props.list().append}
          </Column>
        </Content>
      </div>
    </Base>
  );
}

/**
 * Base layout of the sidebar
 */
const Base = styled("div", {
  base: {
    display: "flex",
    flex: "1 0 218px",
    paddingLeft: "8px",
    justifyContent: "flex-end",
    height: "100%",

    _phone: {
      position: "absolute",
      width: "100vw",
      paddingInline: "12px",

      "& > *": {
        width: "100%",
      },
    },
  },
});

/**
 * Aligned content within the sidebar
 */
const Content = styled("div", {
  base: {
    width: "236px",
    padding: "24px 0 16px",
    display: "flex",
    gap: "2px",

    flexDirection: "column",

    "& a > div": {
      margin: 0,
    },

    _tablet: {
      padding: "8px 0",
    },
    _phone: {
      width: "100%",
      padding: "12px 0 32px",
      maxWidth: "unset",
    },
  },
});

/**
 * Settings search field
 */
const Search = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    margin: "0 2px",
    padding: "0 12px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-field-border, var(--z-border-soft))",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-fg-muted)",
    _focusWithin: { outline: "2px solid var(--z-focus)", outlineOffset: "1px" },
    _phone: { height: "44px" },

    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      _phone: { fontSize: "16px" },
      "&::placeholder": { color: "var(--z-fg-muted)" },
    },
  },
});

/**
 * A section found by the search, indented under its page
 */
const SectionResult = styled("div", {
  base: {
    minWidth: 0,
    paddingInlineStart: "30px",
    fontSize: "14px",
    fontWeight: 400,
  },
});

/**
 * Shown when the search finds no page
 */
const NoResults = styled("span", {
  base: {
    margin: "0 12px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

/**
 * Titles for each category
 */
const CategoryTitle = styled("span", {
  base: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",

    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    margin: "0 8px 4px",
    marginInlineEnd: "20px",

    color: "var(--z-fg-muted, var(--md-sys-color-outline))",
  },
});
