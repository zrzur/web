import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Bot, Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  CATEGORIES,
  CardRoom,
  DiscoverRequest,
  LANGUAGES,
  Listing,
  ListingCard,
  MAX_TAGS,
  PrimaryButton,
  discoverApi,
  paletteTokens,
  statusKind,
  statusReason,
  useDiscoverLabels,
} from "@revolt/app/interface/discover";
import { useClient } from "@revolt/client";
import { billingAvailable } from "@revolt/client/billing";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { CircularProgress, FloatingSelect, MenuItem } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { usePageSaveRegistration } from "../server/pageSave";

/**
 * Submit a server or bot to Discover, edit how it is listed, preview the
 * card, and take it off Discover at any time.
 *
 * Discover is served by the Zrzur API (`/discover`), not upstream.
 */
export function Discoverable(props: {
  discoverable: Bot | Server;
  fullPage?: boolean;
}) {
  const client = useClient();
  const navigate = useNavigate();
  const err = useError();
  const { openModal } = useModals();
  const { t } = useLingui();
  const labels = useDiscoverLabels();

  const isBot = () => props.discoverable instanceof Bot;
  const kind = (): "bots" | "servers" => (isBot() ? "bots" : "servers");
  const id = () => props.discoverable.id;

  // null: never submitted
  const [request, { mutate, refetch }] = createResource(
    id,
    async (itemId): Promise<DiscoverRequest | null> => {
      try {
        return await discoverApi.status(client(), kind(), itemId);
      } catch (error) {
        if (typeof error === "string" && error.includes('"NotFound"')) {
          return null;
        }
        throw error;
      }
    },
  );

  const [profile] = createResource(
    () => (isBot() ? (props.discoverable as Bot).user : undefined),
    (user) => user.fetchProfile().catch(() => undefined),
  );

  // Form state, reset whenever the stored request changes
  const [category, setCategory] = createSignal<string>();
  const [language, setLanguage] = createSignal<string>();
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  createEffect(
    on(request, (value) => {
      if (value === undefined) return;
      setCategory(value?.category);
      setLanguage(value?.language);
      setTags(value?.tags ?? []);
      setConfirmRemove(false);
    }),
  );

  const state = () => {
    const value = request();
    return value ? statusKind(value.status) : "none";
  };

  const dirty = () => {
    const value = request();
    return (
      (value?.category ?? undefined) !== category() ||
      (value?.language ?? undefined) !== language() ||
      (value?.tags ?? []).join() !== tags().join()
    );
  };

  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#+/, "").toLowerCase();
    setTagInput("");
    if (!tag || tags().includes(tag) || tags().length >= MAX_TAGS) return;
    if (tag.length < 2 || tag.length > 24 || !/^[\p{L}\p{N}_-]+$/u.test(tag)) {
      setError(t`Tags use 2–24 letters, numbers, - or _.`);
      return;
    }
    setError(undefined);
    setTags([...tags(), tag]);
  }

  const listingBody = () => ({
    tags: tags(),
    category: category() ?? "",
    language: language() ?? "",
  });

  async function run(action: () => Promise<DiscoverRequest | void>) {
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const result = await action();
      if (result) {
        mutate(result);
        setSaved(true);
      } else {
        await refetch();
      }
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  }

  const inPageBar = usePageSaveRegistration({
    dirty: () =>
      !!request() && state() !== "none" && state() !== "denied" && dirty(),
    saving: busy,
    error,
    reset: () => {
      const value = request();
      setCategory(value?.category);
      setLanguage(value?.language);
      setTags(value?.tags ?? []);
      setError(undefined);
    },
    save: () => save(),
  });

  const submit = () =>
    run(() => discoverApi.submit(client(), kind(), id(), listingBody()));
  const save = () =>
    run(() => discoverApi.edit(client(), kind(), id(), listingBody()));
  const withdraw = () => {
    if (!confirmRemove()) {
      setConfirmRemove(true);
      return;
    }
    return run(async () => {
      await discoverApi.withdraw(client(), kind(), id());
      mutate(null);
    });
  };

  const preview = (): Listing => {
    if (isBot()) {
      const bot = props.discoverable as Bot;
      return {
        kind: "bots",
        id: bot.id,
        name: bot.user?.username ?? "",
        description: profile()?.content,
        icon: bot.user?.avatar,
        banner: profile()?.banner,
        verified: false,
        featured: !!request()?.featured,
        tags: tags(),
        category: category(),
        language: language(),
        count: 0,
      };
    }

    const server = props.discoverable as Server;
    return {
      kind: "servers",
      id: server.id,
      name: server.name,
      description: server.description,
      icon: server.icon,
      banner: server.banner,
      verified: !!(server.flags & 3),
      featured: !!request()?.featured,
      tags: tags(),
      category: category(),
      language: language(),
      count: server.approximateMemberCount ?? 0,
    };
  };

  const notPublic = () => isBot() && !(props.discoverable as Bot).public;

  return (
    <Base>
      <Show when={!props.fullPage}>
        <Heading>
          <Icon name="compass" size={18} />
          <Trans>Discover</Trans>
        </Heading>
      </Show>

      <Show when={!request.loading} fallback={<CircularProgress />}>
        <Show
          when={!request.error}
          fallback={
            <Banner data-tone="danger">
              <Icon name="warning-circle" size={20} />
              <div>
                <strong>
                  <Trans>Can't get discover request status right now</Trans>
                </strong>
                <span>{err(request.error)}</span>
              </div>
            </Banner>
          }
        >
          <StatusBanner
            state={state()}
            reason={request() ? statusReason(request()!.status) : null}
            bot={isBot()}
          />

          <Show when={notPublic()}>
            <Banner data-tone="warning">
              <Icon name="warning" size={20} />
              <div>
                <strong>
                  <Trans>Make your bot public first</Trans>
                </strong>
                <span>
                  <Trans>
                    Only public bots can be listed, so others can add them to
                    their servers.
                  </Trans>
                </span>
              </div>
            </Banner>
          </Show>

          <Show when={state() !== "removed"}>
            <Columns>
              <Form>
                <Field>
                  <Label>
                    <Trans>Category</Trans>
                  </Label>
                  <Hint>
                    <Trans>Where people browsing Discover will find it.</Trans>
                  </Hint>
                  <Options>
                    <For each={CATEGORIES[kind()]}>
                      {(item) => (
                        <Option
                          type="button"
                          data-active={category() === item.id}
                          aria-pressed={category() === item.id}
                          onClick={() =>
                            setCategory(
                              category() === item.id ? undefined : item.id,
                            )
                          }
                        >
                          <Icon name={item.icon} size={17} />
                          {labels.category(item.id)}
                        </Option>
                      )}
                    </For>
                  </Options>
                </Field>

                <Field>
                  <Label for="discover-language">
                    <Trans>Main language</Trans>
                  </Label>
                  <FloatingSelect
                    id="discover-language"
                    value={language() ?? ""}
                    onChange={(e) =>
                      setLanguage(e.currentTarget.value || undefined)
                    }
                  >
                    <MenuItem value="">{t`Not set`}</MenuItem>
                    <For each={LANGUAGES}>
                      {(code) => (
                        <MenuItem value={code}>
                          {labels.language(code)}
                        </MenuItem>
                      )}
                    </For>
                  </FloatingSelect>
                </Field>

                <Field>
                  <Label for="discover-tags">
                    <Trans>Tags</Trans>
                    <Counter>
                      {tags().length}/{MAX_TAGS}
                    </Counter>
                  </Label>
                  <Hint>
                    <Trans>
                      Up to five words people might search for. Press Enter to
                      add.
                    </Trans>
                  </Hint>
                  <TagBox>
                    <For each={tags()}>
                      {(tag) => (
                        <TagChip>
                          #{tag}
                          <button
                            type="button"
                            aria-label={t`Remove tag ${tag}`}
                            onClick={() =>
                              setTags(tags().filter((x) => x !== tag))
                            }
                          >
                            <Icon name="x" size={12} />
                          </button>
                        </TagChip>
                      )}
                    </For>
                    <Show when={tags().length < MAX_TAGS}>
                      <input
                        id="discover-tags"
                        value={tagInput()}
                        placeholder={t`Add a tag`}
                        maxLength={25}
                        onInput={(e) => {
                          const value = e.currentTarget.value;
                          if (/[,\s]$/.test(value)) addTag(value);
                          else setTagInput(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(tagInput());
                          } else if (
                            e.key === "Backspace" &&
                            !tagInput() &&
                            tags().length
                          ) {
                            setTags(tags().slice(0, -1));
                          }
                        }}
                        onBlur={() => tagInput() && addTag(tagInput())}
                      />
                    </Show>
                  </TagBox>
                </Field>

                <Note>
                  <Icon name="info" size={16} />
                  <span>
                    <Trans>
                      Every listing gets its own public page on
                      discover.zrzur.com. Anyone can open it without an account
                      and search engines index it, with a preview image and the
                      approximate member and online counts.
                    </Trans>
                  </span>
                </Note>

                <Note>
                  <Icon name="info" size={16} />
                  <span>
                    <Show
                      when={!isBot()}
                      fallback={
                        <Trans>
                          The name, avatar, banner and description come from the
                          bot's profile.
                        </Trans>
                      }
                    >
                      <Trans>
                        The name, icon, banner and description come from your
                        server's Overview settings.
                      </Trans>
                    </Show>
                  </span>
                </Note>

                <Show when={error()}>
                  <ErrorText role="alert">{error()}</ErrorText>
                </Show>

                <Actions>
                  <Switch>
                    <Match when={state() === "none" || state() === "denied"}>
                      <PrimaryButton
                        type="button"
                        data-size="large"
                        disabled={busy() || notPublic()}
                        onClick={submit}
                      >
                        <Icon name="paper-plane-tilt" size={16} />
                        <Show
                          when={state() === "denied"}
                          fallback={<Trans>Submit to Discover</Trans>}
                        >
                          <Trans>Submit again</Trans>
                        </Show>
                      </PrimaryButton>
                    </Match>
                    <Match when={true}>
                      <Show when={!inPageBar}>
                        <PrimaryButton
                          type="button"
                          data-size="large"
                          disabled={busy() || !dirty()}
                          onClick={save}
                        >
                          <Trans>Save changes</Trans>
                        </PrimaryButton>
                      </Show>
                      <Show when={state() === "approved"}>
                        <PrimaryButton
                          type="button"
                          data-variant="secondary"
                          data-size="large"
                          onClick={() =>
                            navigate(`/discover/${kind()}/${id()}`)
                          }
                        >
                          <Icon name="compass" size={16} />
                          <Trans>View on Discover</Trans>
                        </PrimaryButton>
                      </Show>
                      <PrimaryButton
                        type="button"
                        data-variant="danger"
                        data-size="large"
                        disabled={busy()}
                        onClick={withdraw}
                      >
                        <Switch>
                          <Match when={confirmRemove()}>
                            <Trans>Click again to confirm</Trans>
                          </Match>
                          <Match when={state() === "approved"}>
                            <Trans>Remove from Discover</Trans>
                          </Match>
                          <Match when={true}>
                            <Trans>Cancel request</Trans>
                          </Match>
                        </Switch>
                      </PrimaryButton>
                    </Match>
                  </Switch>
                  <Show when={saved() && !busy()}>
                    <Saved>
                      <Icon name="check" size={14} />
                      <Trans>Saved</Trans>
                    </Saved>
                  </Show>
                </Actions>
              </Form>

              <PreviewColumn>
                <Label as="span">
                  <Trans>Preview</Trans>
                </Label>
                <Hint>
                  <Trans>This is how it will look on Discover.</Trans>
                </Hint>
                <CardRoom style={paletteTokens}>
                  <ListingCard listing={preview()} />
                </CardRoom>
              </PreviewColumn>
            </Columns>
          </Show>
        </Show>
      </Show>

      <Show when={billingAvailable() && props.discoverable.discoverable}>
        <PromoteCta>
          <Icon name="megaphone" size={20} />
          <div>
            <strong>
              <Trans>Promote on Discover</Trans>
            </strong>
            <span>
              <Trans>Move it up the list or take a place in the top row.</Trans>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const item = props.discoverable;
              if (item instanceof Bot) {
                openModal({
                  type: "promote_bot",
                  target: {
                    kind: "bot",
                    id: item.id,
                    name: item.user?.displayName ?? item.id,
                    icon: item.user?.animatedAvatarURL,
                  },
                });
              } else {
                openModal({ type: "promote_server", server: item });
              }
            }}
          >
            <Trans>Promote</Trans>
          </button>
        </PromoteCta>
      </Show>
    </Base>
  );
}

/** Way into paid promotion once a listing is approved */
const PromoteCta = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "16px",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid color-mix(in srgb, var(--z-premium) 40%, transparent)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--z-premium) 10%, transparent), transparent 60%), var(--z-bg-raised)",
    "& > svg": { color: "var(--z-premium)", flexShrink: 0 },
    "& > div": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& strong": { fontSize: "14px", color: "var(--z-fg-primary)" },
    "& span": { fontSize: "13px", color: "var(--z-fg-secondary)" },
    "& button": {
      height: "34px",
      padding: "0 16px",
      border: "none",
      borderRadius: "10px",
      fontSize: "13px",
      fontWeight: 700,
      color: "var(--z-on-premium)",
      background: "var(--z-premium)",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    "& button:hover": { filter: "brightness(1.06)" },
  },
});

function StatusBanner(props: {
  state: ReturnType<typeof statusKind> | "none";
  reason: string | null;
  bot: boolean;
}) {
  const reason = (): JSX.Element =>
    props.reason ? (
      <Reason>
        <Trans>Reason: {props.reason}</Trans>
      </Reason>
    ) : undefined;

  return (
    <Switch>
      <Match when={props.state === "none"}>
        <Banner>
          <Icon name="compass" size={20} />
          <div>
            <strong>
              <Show
                when={props.bot}
                fallback={<Trans>Your server isn't on Discover</Trans>}
              >
                <Trans>Your bot isn't on Discover</Trans>
              </Show>
            </strong>
            <span>
              <Show
                when={props.bot}
                fallback={
                  <Trans>
                    Let people find and join your server. A moderator reviews
                    every request, and you can take it off at any time.
                  </Trans>
                }
              >
                <Trans>
                  Let people find your bot and add it to their servers. A
                  moderator reviews every request, and you can take it off at
                  any time.
                </Trans>
              </Show>
            </span>
          </div>
        </Banner>
      </Match>
      <Match when={props.state === "pending" || props.state === "review"}>
        <Banner data-tone="accent">
          <Icon name="hourglass" size={20} />
          <div>
            <strong>
              <Show
                when={props.bot}
                fallback={<Trans>Your server is under review</Trans>}
              >
                <Trans>Your bot is under review</Trans>
              </Show>
            </strong>
            <span>
              <Trans>
                You can still change the details below while you wait.
              </Trans>
            </span>
          </div>
        </Banner>
      </Match>
      <Match when={props.state === "approved"}>
        <Banner data-tone="success">
          <Icon name="check-circle" size={20} />
          <div>
            <strong>
              <Show
                when={props.bot}
                fallback={<Trans>This server is listed on Discover</Trans>}
              >
                <Trans>This bot is listed on Discover</Trans>
              </Show>
            </strong>
            <span>
              <Trans>
                Changes to the details below show up right away. You can remove
                it at any time.
              </Trans>
            </span>
            {reason()}
          </div>
        </Banner>
      </Match>
      <Match when={props.state === "denied"}>
        <Banner data-tone="warning">
          <Icon name="x-circle" size={20} />
          <div>
            <strong>
              <Trans>Your discover request has been denied</Trans>
            </strong>
            <span>
              <Trans>You can request again below</Trans>
            </span>
            {reason()}
          </div>
        </Banner>
      </Match>
      <Match when={props.state === "removed"}>
        <Banner data-tone="danger">
          <Icon name="prohibit" size={20} />
          <div>
            <strong>
              <Trans>Your discover request has been removed</Trans>
            </strong>
            <span>
              <Trans>Contact support for more information.</Trans>
            </span>
            {reason()}
          </div>
        </Banner>
      </Match>
    </Switch>
  );
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    color: "var(--z-fg-primary)",
  },
});

const Heading = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "16px",
    fontWeight: 700,
  },
});

/**
 * Status card: a calm surface like the rest of settings. Only the icon tile
 * carries the status colour, so the card doesn't shout.
 */
const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 16px 12px 12px",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
    "--tone": "var(--z-fg-secondary)",
    "--z-icon-color": "var(--tone)",

    // the icon sits in a soft tinted tile
    "& > .z-icon": {
      flexShrink: 0,
      boxSizing: "border-box",
      // overrides the icon's inline 20px: a 38px tile around a 20px glyph
      width: "38px !important",
      height: "38px !important",
      padding: "9px",
      borderRadius: "var(--z-radius, 10px)",
      background: "color-mix(in srgb, var(--tone) 14%, transparent)",
    },
    "& > div": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: 0,
    },
    "& strong": { fontSize: "14px", fontWeight: 650, lineHeight: "20px" },
    "& span": {
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },

    "&[data-tone='accent']": {
      "--tone": "var(--z-accent-text, var(--z-accent))",
    },
    "&[data-tone='success']": { "--tone": "var(--z-presence-online, #55DCC8)" },
    "&[data-tone='warning']": { "--tone": "var(--z-accent)" },
    "&[data-tone='danger']": { "--tone": "var(--z-danger, #F27488)" },
  },
});

const Reason = styled("em", {
  base: {
    fontStyle: "normal",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Columns = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "24px",
    alignItems: "flex-start",
    // the form takes the room; the preview stays the size of a real card
    "& > *:first-child": { flex: "1 1 300px", minWidth: 0 },
    "& > *:last-child": { flex: "0 1 274px", minWidth: 0 },
  },
});

/** In a box like every other settings section */
const Form = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "16px",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-card-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
  },
});

const Field = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const Label = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--z-fg-secondary)",
  },
});

const Counter = styled("span", {
  base: {
    marginInlineStart: "auto",
    fontWeight: 600,
    letterSpacing: 0,
    direction: "ltr",
    unicodeBidi: "isolate",
    color: "var(--z-fg-muted)",
  },
});

const Hint = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-muted)" },
});

/** Categories wrap like a row of buttons */
const Options = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "4px",
  },
});

/**
 * Same shape as the page's buttons ("View on Discover"); the chosen
 * category takes the accent fill like "Save changes"
 */
const Option = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    height: "40px",
    paddingInlineStart: "13px",
    paddingInlineEnd: "16px",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition:
      "border-color 0.12s ease, background-color 0.12s ease, color 0.12s ease",
    "--z-icon-color": "var(--z-icon-neutral)",

    _hover: {
      borderColor: "var(--z-border-strong)",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-icon-hover)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[data-active='true']": {
      borderColor: "transparent",
      background: "var(--z-accent-fill, var(--z-accent))",
      color: "var(--z-on-accent, #fff)",
      "--z-icon-color": "currentColor",
    },
    "&[data-active='true']:hover": {
      background: "var(--z-accent-hover, var(--z-accent))",
    },
  },
});

const TagBox = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    minHeight: "44px",
    padding: "6px 8px",
    borderRadius: "12px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    _focusWithin: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },

    "& input": {
      flex: 1,
      minWidth: "120px",
      height: "30px",
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
    },
  },
});

const TagChip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    height: "28px",
    padding: "0 4px 0 10px",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--z-accent) 18%, var(--z-bg-raised))",
    fontSize: "13px",
    fontWeight: 650,

    "& button": {
      width: "22px",
      height: "22px",
      display: "grid",
      placeItems: "center",
      border: "none",
      borderRadius: "6px",
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      _hover: { background: "rgba(0, 0, 0, 0.2)" },
    },
  },
});

const Note = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "19px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",
  },
});

const ErrorText = styled("div", {
  base: { fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
});

const Saved = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-presence-online, #55DCC8)",
    "--z-icon-color": "currentColor",
  },
});

const PreviewColumn = styled("div", {
  base: {
    position: "sticky",
    top: "0",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
});
