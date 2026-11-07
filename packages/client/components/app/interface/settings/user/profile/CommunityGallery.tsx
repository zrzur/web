import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { createStore } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useDesignMotion } from "@revolt/ui/components/features/profiles/NameplateMotion";
import {
  communityFileUrl,
  communityStillUrl,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { CreatorChip, useDate } from "./CommunityParts";
import { FavouriteButton } from "./StyleEditors";
import {
  CommunityCreator,
  CommunityFilter,
  CommunityItem,
  CommunityKind,
  communityApi,
  communityParams,
} from "./communityApi";

const PAGE = 60;

/**
 * Community tab: browse, search, favourite and wear designs made by
 * creators. Everything here is reviewed and free; nobody uploads from here
 * (creators use Creator Studio).
 */
export function CommunityGallery(props: {
  kind: CommunityKind;
  /** value being tried on in the dialog (`c:<id>`) */
  selected?: string;
  /** value the user wears now */
  current?: string;
  /** try a design on in the dialog's preview */
  onSelect: (ref: string, fileId: string) => void;
  /** wear it now (or take it off with `undefined`) and close */
  onApplyNow: (ref: string | undefined, fileId?: string) => void;
  /** how a design looks in a card, given its image URL */
  preview: (url: string, large?: boolean) => JSX.Element;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const date = useDate();
  const { openModal } = useModals();

  const [filter, setFilter] = createSignal<CommunityFilter>("all");
  const [typed, setTyped] = createSignal("");
  const [query, setQuery] = createSignal("");
  const [state, setState] = createStore({
    items: [] as CommunityItem[],
    creators: {} as Record<string, CommunityCreator>,
    loading: true,
    failed: false,
    more: false,
  });
  const [open, setOpen] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  createEffect(() => {
    const value = typed().trim();
    const timer = setTimeout(() => setQuery(value), 300);
    onCleanup(() => clearTimeout(timer));
  });

  let request = 0;
  async function load(offset: number) {
    const mine = ++request;
    setState({ loading: true, failed: false });
    try {
      const page = await communityApi.list(
        client(),
        props.kind,
        communityParams(filter(), query(), offset, PAGE),
      );
      if (mine !== request) return;
      const creators = { ...state.creators };
      for (const creator of page.creators) creators[creator._id] = creator;
      setState({
        items: offset ? [...state.items, ...page.items] : page.items,
        creators,
        more: page.items.length === PAGE,
        loading: false,
      });
    } catch {
      if (mine === request) setState({ loading: false, failed: true });
    }
  }

  createEffect(
    on([() => props.kind, filter, query], () => {
      setOpen(undefined);
      void load(0);
    }),
  );

  const motion = useDesignMotion();
  const still = (item: CommunityItem) =>
    communityStillUrl(instance.mediaUrl, item.file._id) ?? "";
  const url = (item: CommunityItem) =>
    motion()
      ? (communityFileUrl(instance.mediaUrl, item.file._id) ?? "")
      : still(item);
  const ref = (item: CommunityItem) => `c:${item._id}`;
  const detail = createMemo(() =>
    state.items.find((item) => item._id === open()),
  );

  async function toggleFavourite(item: CommunityItem) {
    const on = !item.favourite;
    const set = (value: boolean) =>
      setState("items", (entry) => entry._id === item._id, "favourite", value);
    set(on);
    try {
      await communityApi.favourite(client(), item._id, on);
      if (!on && filter() === "favourites") {
        setState("items", (list) => list.filter((e) => e._id !== item._id));
      }
    } catch (failure) {
      set(!on);
      setError(describeError(failure));
    }
  }

  /** Reports go through Trust & Safety, which also counts them for the gallery */
  function report(item: CommunityItem) {
    openModal({
      type: "report_content",
      client: client(),
      target: { kind: "CommunityItem", id: item._id, label: item.name },
    });
  }

  const filters = () =>
    [
      { id: "all", label: t`All` },
      { id: "new", label: t`Newest` },
      { id: "popular", label: t`Popular` },
      { id: "favourites", label: t`Favourites` },
    ] as const;

  return (
    <Wrap>
      <Show
        when={detail()}
        fallback={
          <>
            <Toolbar>
              <Search>
                <Icon name="magnifying-glass" size={16} />
                <input
                  type="search"
                  placeholder={t`Search by design or creator`}
                  aria-label={t`Search by design or creator`}
                  value={typed()}
                  onInput={(e) => setTyped(e.currentTarget.value)}
                />
              </Search>
              <Pills role="group" aria-label={t`Filter`}>
                <For each={filters()}>
                  {(entry) => (
                    <Pill
                      type="button"
                      aria-pressed={filter() === entry.id}
                      onClick={() => setFilter(entry.id)}
                    >
                      <Show when={entry.id === "favourites"}>
                        <Icon name="heart" size={13} />
                      </Show>
                      {entry.label}
                    </Pill>
                  )}
                </For>
              </Pills>
            </Toolbar>

            <Show when={error()}>
              <Error role="alert">{error()}</Error>
            </Show>

            <Switch>
              <Match when={state.loading && !state.items.length}>
                <Grid aria-busy="true">
                  <For each={[0, 1, 2, 3, 4, 5]}>{() => <Skeleton />}</For>
                </Grid>
              </Match>
              <Match when={state.failed}>
                <Empty>
                  <Icon name="warning-circle" size={22} />
                  <Trans>The community gallery couldn't be loaded.</Trans>
                  <button type="button" onClick={() => void load(0)}>
                    <Trans>Try again</Trans>
                  </button>
                </Empty>
              </Match>
              <Match when={!state.items.length}>
                <Empty>
                  <Icon name="sparkle" size={22} />
                  <Switch
                    fallback={
                      <Trans>
                        No community designs yet. Approved designs from creators
                        show up here.
                      </Trans>
                    }
                  >
                    <Match when={query()}>
                      <Trans>Nothing matches your search.</Trans>
                    </Match>
                    <Match when={filter() === "favourites"}>
                      <Trans>Tap the heart on a design to save it here.</Trans>
                    </Match>
                  </Switch>
                </Empty>
              </Match>
              <Match when={state.items.length}>
                <Grid>
                  <For each={state.items}>
                    {(item) => (
                      <Card
                        type="button"
                        aria-pressed={props.selected === ref(item)}
                        onClick={() => {
                          props.onSelect(ref(item), item.file._id);
                          setOpen(item._id);
                        }}
                      >
                        <Thumb>{props.preview(still(item))}</Thumb>
                        <strong title={item.name}>
                          <bdi>{item.name}</bdi>
                        </strong>
                        <CreatorChip
                          creator={state.creators[item.creator_id]}
                        />
                        <FavouriteButton
                          active={!!item.favourite}
                          onToggle={() => void toggleFavourite(item)}
                        />
                        <Show when={props.current === ref(item)}>
                          <Check title={t`You wear this`}>
                            <Icon name="check" size={12} />
                          </Check>
                        </Show>
                      </Card>
                    )}
                  </For>
                </Grid>
                <Show when={state.more}>
                  <More
                    type="button"
                    disabled={state.loading}
                    onClick={() => void load(state.items.length)}
                  >
                    <Show
                      when={state.loading}
                      fallback={<Trans>Show more</Trans>}
                    >
                      <Trans>Loading…</Trans>
                    </Show>
                  </More>
                </Show>
              </Match>
            </Switch>
          </>
        }
      >
        {(item) => (
          <Details>
            <Back type="button" onClick={() => setOpen(undefined)}>
              <Icon name="caret-left" size={16} />
              <Trans>All designs</Trans>
            </Back>
            <DetailBody>
              <Large>{props.preview(url(item()), true)}</Large>
              <div>
                <h3>
                  <bdi>{item().name}</bdi>
                </h3>
                <CreatorChip
                  creator={state.creators[item().creator_id]}
                  size={20}
                  verbose
                />
                <Show when={item().description}>
                  <p dir="auto">{item().description}</p>
                </Show>
                <Show when={item().tags?.length}>
                  <Tags>
                    <For each={item().tags}>
                      {(tag) => (
                        <button
                          type="button"
                          onClick={() => {
                            setTyped(tag);
                            setOpen(undefined);
                          }}
                        >
                          <bdi>#{tag}</bdi>
                        </button>
                      )}
                    </For>
                  </Tags>
                </Show>
                <Meta>
                  <Show when={item().published_at}>
                    <span>
                      <Trans>Published {date(item().published_at)}</Trans>
                    </span>
                  </Show>
                  <span>
                    <Trans>Used by {item().popularity}</Trans>
                  </span>
                </Meta>
                <Actions>
                  <Show
                    when={props.current === ref(item())}
                    fallback={
                      <button
                        type="button"
                        data-primary
                        onClick={() =>
                          props.onApplyNow(ref(item()), item().file._id)
                        }
                      >
                        <Trans>Apply</Trans>
                      </button>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => props.onApplyNow(undefined)}
                    >
                      <Trans>Remove</Trans>
                    </button>
                  </Show>
                  <FavouriteButton
                    active={!!item().favourite}
                    onToggle={() => void toggleFavourite(item())}
                  />
                  <Show when={item().creator_id !== client().user?.id}>
                    <button type="button" onClick={() => report(item())}>
                      <Icon name="flag" size={14} />
                      <Trans>Report</Trans>
                    </button>
                  </Show>
                </Actions>
              </div>
            </DetailBody>
          </Details>
        )}
      </Show>
    </Wrap>
  );
}

const Wrap = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 },
});

const Toolbar = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
});

const Search = styled("label", {
  base: {
    flex: "1 1 180px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "36px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "& input": {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      textAlign: "start",
    },
  },
});

const Pills = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    padding: "3px",
    gap: "2px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
  },
});

const Pill = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    height: "30px",
    paddingInline: "11px",
    border: "none",
    borderRadius: "calc(var(--z-radius, 10px) - 3px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    "&[aria-pressed='true']": {
      background: "var(--z-tab-active-bg)",
      boxShadow: "var(--z-tab-active-lift)",
      color: "var(--z-fg-primary)",
    },
  },
});

const Error = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "32px 12px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-accent)",
    "& button": {
      height: "32px",
      paddingInline: "14px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      cursor: "pointer",
    },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))",
    gap: "10px",
    maxHeight: "min(400px, 52dvh)",
    overflowY: "auto",
    padding: "4px",
  },
});

const Skeleton = styled("div", {
  base: {
    height: "148px",
    borderRadius: "var(--z-radius, 10px)",
    background:
      "linear-gradient(90deg, var(--z-bg-raised), var(--z-bg-input), var(--z-bg-raised))",
    backgroundSize: "200% 100%",
    animation: "pulse 1.4s ease-in-out infinite",
  },
});

const Card = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    minHeight: "148px",
    padding: "14px 8px 10px",
    border: "1px solid var(--z-btn-surface-border)",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    cursor: "pointer",
    overflow: "hidden",
    _hover: { borderColor: "var(--z-border-strong)" },
    "&[aria-pressed='true']": {
      borderColor: "var(--z-accent)",
      boxShadow: "inset 0 0 0 1px var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 9%, var(--z-bg-raised))",
    },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > strong": {
      maxWidth: "100%",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      fontSize: "13px",
      fontWeight: 650,
    },
  },
});

const Thumb = styled("div", {
  base: {
    width: "100%",
    // decoration art is 1.5x the avatar: leave room so none of it is cut
    minHeight: "84px",
    paddingBlock: "6px",
    display: "grid",
    placeItems: "center",
  },
});

const Check = styled("span", {
  base: {
    position: "absolute",
    top: "6px",
    insetInlineEnd: "6px",
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "var(--z-accent-fill, var(--z-accent))",
    color: "var(--z-on-accent, #fff)",
    "--z-icon-color": "currentColor",
  },
});

const More = styled("button", {
  base: {
    alignSelf: "center",
    height: "32px",
    paddingInline: "16px",
    border: "1px solid var(--z-border-subtle)",
    borderRadius: "999px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    _disabled: { opacity: 0.6, cursor: "default" },
  },
});

const Details = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "10px" },
});

const Back = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "30px",
    paddingInline: "8px",
    border: "none",
    borderRadius: "var(--z-radius, 10px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    // the chevron points back, which is right in Arabic
    "&:dir(rtl) svg": { transform: "scaleX(-1)" },
    _hover: { background: "var(--z-bg-raised)" },
  },
});

const DetailBody = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "180px minmax(0, 1fr)",
    gap: "18px",
    alignItems: "start",
    "@media (max-width: 560px)": { gridTemplateColumns: "minmax(0, 1fr)" },
    "& h3": { margin: "0 0 6px", fontSize: "16px", fontWeight: 750 },
    "& p": {
      margin: "10px 0 0",
      fontSize: "14px",
      lineHeight: "19px",
      color: "var(--z-fg-secondary)",
      textAlign: "start",
      whiteSpace: "pre-wrap",
    },
  },
});

const Large = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    minHeight: "180px",
    padding: "16px",
    borderRadius: "14px",
    background:
      "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--z-accent) 16%, transparent), transparent 70%), var(--z-bg-input)",
  },
});

const Tags = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
    "& button": {
      height: "24px",
      paddingInline: "9px",
      border: "none",
      borderRadius: "999px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
      font: "inherit",
      fontSize: "12px",
      cursor: "pointer",
      _hover: { color: "var(--z-fg-primary)" },
    },
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "10px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginTop: "14px",
    "& > button": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      height: "34px",
      paddingInline: "14px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontWeight: 650,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
    },
    "& > button[data-primary]": {
      border: "none",
      color: "var(--z-on-accent, #fff)",
      background: "var(--z-accent-gradient)",
      boxShadow:
        "0 6px 18px color-mix(in srgb, var(--z-accent) 25%, transparent)",
    },
    "& > button[data-danger='true']": {
      borderColor: "var(--z-danger, #F27488)",
      color: "var(--z-danger, #F27488)",
    },
    // the heart sits in the row, not in a corner
    "& > [role='button']": {
      position: "static",
      opacity: 1,
      width: "34px",
      height: "34px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});
