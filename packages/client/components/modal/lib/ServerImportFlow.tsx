import { Trans, useLingui } from "@lingui/solid/macro";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { getInviteLink } from "@revolt/modal/modals/inviteLink";
import {
  type Dialog,
  Button,
  Column,
  Form2,
  TextField,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import type { Client, Server } from "@zrzur/sdk/solid";
import { createFormControl, createFormGroup } from "solid-forms";
import {
  type ComponentProps,
  type JSX,
  For,
  Match,
  Show,
  Switch,
  batch,
  createSignal,
  createUniqueId,
} from "solid-js";
import { styled } from "styled-system/jsx";
import { useModals } from "..";
import {
  Failure,
  IconPicker,
  PlusBadge,
  Progress,
  Rules,
} from "./ServerFlowParts";
import {
  type ImportFailure,
  type ImportPreview,
  asksForText,
  buildServer,
  importAvailability,
  importFailure,
  openingChannelId,
  previewRows,
  readPreview,
  sourceOf,
} from "./serverImport";

const NAME_LIMIT = 32;
/** Names in a row, joined the way the app's language joins a list */
const listed = (names: string[]) =>
  new Intl.ListFormat(document.documentElement.lang || undefined, {
    style: "short",
    type: "conjunction",
  }).format(names);
const SERVER_RULES = "https://zrzur.com/legal/server-owner-rules";
/** Where a template's text can be read in a browser, by its code */
const TEMPLATE_ADDRESS = "https://discord.com/api/v10/guilds/templates/";

type DialogAction = NonNullable<
  ComponentProps<typeof Dialog>["actions"]
>[number];
type Stage = "link" | "preview" | "done";

/** The code at the end of a template link, to name the address of its text */
export function codeIn(link: string) {
  return /(?:^|\/)([A-Za-z0-9]{2,32})\/?$/.exec(link.trim())?.[1];
}

/**
 * "Copy a server setup": paste a server template link from Discord, see what
 * will be built, build it, and get an invite for the old community. It runs
 * inside the dialog that hosts it and hands back its title and actions.
 * Call it while the host component is being set up.
 */
export function createServerImport(options: {
  client: Client;
  /** build into this empty server instead of making a new one */
  into?: Server;
  /** Back on the first step */
  onLeave?: () => void;
  /** the person opens what was built */
  onOpen: (serverId: string, channelId?: string) => void;
}) {
  const { t } = useLingui();
  const instance = useInstance();
  const { openModal } = useModals();
  const rulesLabel = createUniqueId();
  const availability = () => importAvailability(options.client);

  const [stage, setStage] = createSignal<Stage>("link");
  const [link, setLink] = createSignal("");
  const [text, setText] = createSignal("");
  // with link reading off, the text is the only way in
  const [pasting, setPasting] = createSignal(!availability().byLink);
  const [busy, setBusy] = createSignal(false);
  const [failure, setFailure] = createSignal<ImportFailure>();
  const [cause, setCause] = createSignal<unknown>();
  const [preview, setPreview] = createSignal<ImportPreview>();
  const [agreed, setAgreed] = createSignal(false);
  const [built, setBuilt] = createSignal<{
    serverId: string;
    channelId?: string;
    invite: string;
  }>();
  const [message, setMessage] = createSignal("");
  const [copied, setCopied] = createSignal<string>();

  const group = createFormGroup({
    name: createFormControl("", { required: true }),
    icon: createFormControl<File[] | string | null>(null),
  });
  const typedName = () => group.controls.name.value.trim();

  function fail(error: unknown) {
    const kind = importFailure(error);
    setCause(error);
    setFailure(kind);
    if (asksForText(kind)) setPasting(true);
  }

  async function read() {
    if (busy()) return;
    const given = pasting() && text().trim() ? text() : link();
    setFailure(undefined);
    if (!given.trim()) return void setFailure("nothing_given");
    // a link can't be read here: ask for the text without a wasted request
    if ("link" in sourceOf(given) && !availability().byLink) {
      setPasting(true);
      return void setFailure("unavailable");
    }
    setBusy(true);
    try {
      const result = await readPreview(options.client, given);
      batch(() => {
        setPreview(result);
        if (!typedName())
          group.controls.name.setValue(
            Array.from(result.name).slice(0, NAME_LIMIT).join(""),
          );
        setStage("preview");
      });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  const canBuild = () =>
    !busy() && !!preview() && (!!options.into || (!!typedName() && agreed()));

  async function build() {
    const layout = preview()?.structure;
    if (!canBuild() || !layout) return;
    setBusy(true);
    setFailure(undefined);
    group.controls.icon.markDisabled(true);
    try {
      const file = group.controls.icon.value;
      const icon =
        !options.into && Array.isArray(file)
          ? await options.client.uploadFile("icons", file[0], instance.mediaUrl)
          : undefined;
      const made = await buildServer(options.client, {
        name: options.into ? options.into.name : typedName(),
        icon,
        structure: layout,
        into: options.into?.id,
      });
      batch(() => {
        for (const channel of made.channels)
          options.client.channels.getOrCreate(channel._id, channel);
        options.client.servers.getOrCreate(made.server._id, made.server, true);
      });
      const channelId = openingChannelId(layout, made.channels);
      // an invite that never runs out: it is posted once and found for months
      let invite = "";
      try {
        const channel = channelId && options.client.channels.get(channelId);
        if (channel)
          invite = getInviteLink(
            (await channel.createInvite({ expiresIn: null }))._id,
            instance,
          );
      } catch {
        /* the server is built; an invite can be made from its menu */
      }
      batch(() => {
        setBuilt({ serverId: made.server._id, channelId, invite });
        setMessage(
          invite
            ? t`We are opening a home on Zrzur. The channels and roles are set up. Join here: ${invite}`
            : "",
        );
        setStage("done");
      });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
      group.controls.icon.markDisabled(false);
    }
  }

  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(
        () => setCopied((now) => (now === what ? undefined : now)),
        2000,
      );
    } catch {
      /* the field stays selectable for a manual copy */
    }
  }

  const failureText = (): JSX.Element => {
    switch (failure()) {
      case "invite_link":
        return t`This is an invite link, not a template link. Follow the three steps above to make a template link.`;
      case "not_a_link":
        return t`This is not a server template link.`;
      case "not_a_template":
        return t`This is not a complete server template. Copy the whole text and paste it again.`;
      case "empty":
        return t`This template has no channels or roles to copy.`;
      case "too_large":
        return t`This template is too large to read.`;
      case "nothing_given":
        return t`Paste your template link first.`;
      case "not_found":
        return t`This template link does not work any more. Generate a new one in Discord and paste it again.`;
      case "unavailable":
        return t`Zrzur can't read the link from Discord right now. Paste the template text instead.`;
      case "not_empty":
        return t`This server already has channels or roles. Copy the setup into a new server.`;
      case "limited":
        return t`Too many tries. Wait a little and try again.`;
      default:
        return <TranslatedError error={cause()} />;
    }
  };

  const title = (): JSX.Element => (
    <Switch>
      <Match when={stage() === "link"}>
        <Trans>Copy your server's channels and roles from Discord</Trans>
      </Match>
      <Match when={stage() === "preview"}>
        <Trans>This is what will be built</Trans>
      </Match>
      <Match when={stage() === "done"}>
        <Trans>Your server is ready</Trans>
      </Match>
    </Switch>
  );

  /** The line under the title, where the dialog shows its description */
  const description = (): JSX.Element => (
    <Switch>
      <Match when={stage() === "link"}>
        <Trans>
          Zrzur builds them from a server template that you make in Discord.
          Zrzur never asks for your Discord password.
        </Trans>
      </Match>
      <Match when={stage() === "preview"}>
        <Trans>Nothing exists yet. Check it, then build.</Trans>
      </Match>
    </Switch>
  );

  const actions = (): DialogAction[] => {
    const back = (onClick: () => void): DialogAction => ({
      variant: "secondary",
      text: <Trans>Back</Trans>,
      isDisabled: busy(),
      onClick: () => {
        onClick();
        return false;
      },
    });
    if (stage() === "link") {
      const main: DialogAction = {
        text: busy() ? t`Reading…` : t`Read the template`,
        isDisabled: busy(),
        onClick: () => {
          void read();
          return false;
        },
      };
      return options.onLeave ? [back(options.onLeave), main] : [main];
    }
    if (stage() === "preview")
      return [
        back(() => {
          setFailure(undefined);
          setStage("link");
        }),
        {
          text: busy() ? t`Building…` : t`Build the server`,
          isDisabled: !canBuild(),
          onClick: () => {
            void build();
            return false;
          },
        },
      ];
    return [
      {
        text: <Trans>Open the server</Trans>,
        onClick: () => {
          const made = built();
          if (made) options.onOpen(made.serverId, made.channelId);
          return false;
        },
      },
    ];
  };

  const address = () => {
    const code = codeIn(link());
    return code ? TEMPLATE_ADDRESS + code : undefined;
  };

  function LinkStep() {
    return (
      <Stack>
        <Steps>
          <li>
            <span>
              <Trans>
                In Discord, open <b>Server Settings</b>, then{" "}
                <b>Server Templates</b>.
              </Trans>
            </span>
          </li>
          <li>
            <span>
              <Trans>
                Give the template a name and press <b>Generate Template</b>.
              </Trans>
            </span>
          </li>
          <li>
            <span>
              <Trans>Copy the link and paste it here.</Trans>
            </span>
          </li>
        </Steps>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void read();
          }}
        >
          <TextField
            name="template-link"
            label={t`Template link`}
            placeholder="https://discord.new/…"
            dir="ltr"
            autocomplete="off"
            spellcheck={false}
            disabled={busy()}
            value={link()}
            onInput={(event) => setLink(event.currentTarget.value)}
          />
        </form>
        <Show
          when={pasting()}
          fallback={
            <TextLink
              type="button"
              data-import-paste
              onClick={() => setPasting(true)}
            >
              <Trans>No link? Paste the template text instead</Trans>
            </TextLink>
          }
        >
          <Paste>
            <Lead>
              <Show
                when={address()}
                fallback={
                  <Trans>
                    Open the template's address in your browser, copy all the
                    text on that page and paste it here.
                  </Trans>
                }
              >
                <Trans>
                  Open this address in your browser, copy all the text on that
                  page and paste it here.
                </Trans>
              </Show>
            </Lead>
            <Show when={address()}>
              {(value) => (
                <CopyRow>
                  <input
                    readOnly
                    dir="ltr"
                    aria-label={t`Address of the template text`}
                    value={value()}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button
                    variant="tonal"
                    size="md"
                    shape="square"
                    onPress={() => void copy("address", value())}
                  >
                    <Show
                      when={copied() === "address"}
                      fallback={<Trans>Copy</Trans>}
                    >
                      <Trans>Copied</Trans>
                    </Show>
                  </Button>
                </CopyRow>
              )}
            </Show>
            <TextField
              name="template-text"
              label={t`Template text`}
              rows={5}
              dir="ltr"
              autocomplete="off"
              spellcheck={false}
              disabled={busy()}
              value={text()}
              onInput={(event) => setText(event.currentTarget.value)}
            />
          </Paste>
        </Show>
        <Show when={failure()}>
          <Failure role="alert" data-import-failure={failure()}>
            {failureText()}
          </Failure>
        </Show>
        <Two>
          <div>
            <h4 data-moves>
              <Trans>Comes over</Trans>
            </h4>
            <p>
              <Trans>
                Categories, text and voice channels, topics, order, roles and
                colours. Permissions as closely as Zrzur can match them.
              </Trans>
            </p>
          </div>
          <div>
            <h4>
              <Trans>Stays behind</Trans>
            </h4>
            <p>
              <Trans>
                Messages, members, bots, emoji, files and pins. Forum,
                announcement and stage channels are not in a template.
              </Trans>
            </p>
          </div>
        </Two>
        <Fine>
          <Trans>
            Zrzur keeps only what becomes your server. Nothing changes in
            Discord. Zrzur is not affiliated with Discord.
          </Trans>
        </Fine>
      </Stack>
    );
  }

  function PreviewStep(props: { preview: ImportPreview }) {
    const report = () => props.preview.report;
    const rows = () => previewRows(props.preview.structure);
    const held = () => new Set(report().held_back);
    return (
      <Stack>
        <Counts>
          <div>
            <b data-import-count="categories">{report().categories}</b>
            <Trans>Categories</Trans>
          </div>
          <div>
            <b data-import-count="channels">{report().channels}</b>
            <Trans>Channels</Trans>
          </div>
          <div>
            <b data-import-count="roles">{report().roles}</b>
            <Trans>Roles</Trans>
          </div>
        </Counts>
        <Panes>
          <Pane data-import-channels aria-label={t`Channels`} role="list">
            <For each={rows()}>
              {(row) =>
                row.kind === "category" ? (
                  <CategoryTitle role="listitem">{row.title}</CategoryTitle>
                ) : (
                  <Line role="listitem">
                    <Icon
                      size={16}
                      name={
                        row.type === "Voice"
                          ? "speaker-high"
                          : row.type === "Forum"
                            ? "chats-circle"
                            : row.announcement
                              ? "megaphone"
                              : "hash"
                      }
                    />
                    <span>{row.name}</span>
                    <Show when={row.mature}>
                      <small>18+</small>
                    </Show>
                    <Show when={row.private}>
                      <small>
                        <Icon name="lock-simple" size={12} />
                        <Trans>Private</Trans>
                      </small>
                    </Show>
                    <Show when={row.readOnly}>
                      <small>
                        <Trans>Read-only</Trans>
                      </small>
                    </Show>
                  </Line>
                )
              }
            </For>
          </Pane>
          <Show when={props.preview.structure.roles.length}>
            <Pane data-import-roles aria-label={t`Roles`} role="list">
              <PaneTitle>
                <Trans>Roles, highest first</Trans>
              </PaneTitle>
              <For each={props.preview.structure.roles}>
                {(role) => (
                  <Line role="listitem">
                    <Dot
                      style={{
                        background: role.colour ?? "var(--z-fg-muted)",
                      }}
                    />
                    <span>{role.name}</span>
                    <Show when={held().has(role.name)}>
                      <small data-held>
                        <Trans>Control held back</Trans>
                      </small>
                    </Show>
                  </Line>
                )}
              </For>
            </Pane>
          </Show>
        </Panes>
        <Wont data-import-wont>
          <h4>
            <Trans>Will not come over</Trans>
          </h4>
          <ul>
            <Show when={report().held_back.length}>
              <li data-warn>
                {t`Control of the server (managing the server, its roles and permissions) is not copied. You switch it on yourself in Roles for: ${listed(report().held_back)}`}
              </li>
            </Show>
            <Show when={report().skipped_channels.length}>
              <li data-warn>
                {t`Channels of a kind Zrzur can't build: ${listed(report().skipped_channels)}`}
              </li>
            </Show>
            <Show
              when={report().over_limit_channels + report().over_limit_roles}
            >
              <li data-warn>
                {t`Beyond what one server holds here and left out: ${report().over_limit_channels} channels, ${report().over_limit_roles} roles`}
              </li>
            </Show>
            <Show when={report().shortened.length}>
              <li data-warn>
                {t`Names longer than ${NAME_LIMIT} characters were shortened: ${report().shortened.length}`}
              </li>
            </Show>
            <Show when={report().unmatched_permissions.length}>
              <li>
                {t`Kinds of permission Zrzur has no match for: ${report().unmatched_permissions.length}`}
              </li>
            </Show>
            <Show when={report().member_overrides}>
              <li>
                {t`Permissions set for single members: ${report().member_overrides}`}
              </li>
            </Show>
            <Show when={report().mature_channels}>
              <li>
                {t`Age-restricted channels stay age-restricted and follow Zrzur's age rules: ${report().mature_channels}`}
              </li>
            </Show>
            <li>
              <Trans>
                Voice quality settings, the AFK channel and the server picture
              </Trans>
            </li>
            <li>
              <Trans>
                Messages, members, bots, emoji, files and pins. Members join
                only through your invite link.
              </Trans>
            </li>
          </ul>
        </Wont>
        <Fine>
          <Trans>
            Permissions are matched as closely as Zrzur can. Check them before
            you invite people.
          </Trans>
        </Fine>
        <Show when={!options.into}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void build();
            }}
          >
            <Column>
              <IconPicker>
                <Form2.FileInput
                  control={group.controls.icon}
                  accept="image/*"
                  label={t`Add a server icon`}
                  removeLabel={t`Remove server icon`}
                  imageJustify={false}
                  imageHeight={80}
                  hideMaxSize
                  maxSize={instance.limits().file_upload_size_limits["icons"]}
                  process={cropProcess({
                    ratio: 1,
                    ratioLabel: t`Square`,
                    openModal,
                    circularMask: true,
                    allowModeToggle: false,
                    dialogTitle: t`Crop server icon`,
                  })}
                />
                <Show when={!group.controls.icon.value}>
                  <PlusBadge aria-hidden="true">
                    <Icon name="plus" size={14} />
                  </PlusBadge>
                </Show>
              </IconPicker>
              <fieldset
                disabled={busy()}
                style={{ border: 0, padding: 0, margin: 0, "min-width": 0 }}
              >
                <Form2.TextField
                  minlength={1}
                  maxlength={NAME_LIMIT}
                  counter
                  name="name"
                  control={group.controls.name}
                  label={t`Server name`}
                />
              </fieldset>
              <Rules
                data-flow-rules
                onClick={() => {
                  if (!busy()) setAgreed(!agreed());
                }}
              >
                <span id={rulesLabel}>
                  <Trans>
                    I agree to{" "}
                    <a
                      href={SERVER_RULES}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Zrzur's rules for server owners
                    </a>
                  </Trans>
                </span>
                <Toggle
                  checked={agreed()}
                  onChange={setAgreed}
                  disabled={busy()}
                  aria-labelledby={rulesLabel}
                />
              </Rules>
            </Column>
          </form>
        </Show>
        <Fine>
          <Trans>Only copy a server you run or have permission to copy.</Trans>
        </Fine>
        <Show when={busy()}>
          <Progress role="status" aria-live="polite">
            {t`Building your server…`}
          </Progress>
        </Show>
        <Show when={failure()}>
          <Failure role="alert" data-import-failure={failure()}>
            {failureText()}
          </Failure>
        </Show>
      </Stack>
    );
  }

  function DoneStep() {
    const report = () => preview()?.report;
    return (
      <Stack>
        <Ready role="status" data-import-ready>
          <Icon name="check-circle" size={18} />
          <span>
            {t`${report()?.categories ?? 0} categories, ${report()?.channels ?? 0} channels and ${report()?.roles ?? 0} roles are in place.`}
          </span>
        </Ready>
        <Show
          when={built()?.invite}
          fallback={
            <Fine>
              <Trans>
                Make an invite from the server's menu when you are ready to
                bring people in.
              </Trans>
            </Fine>
          }
        >
          {(invite) => (
            <>
              <FieldLabel>
                <Trans>Invite link</Trans>
              </FieldLabel>
              <CopyRow>
                <input
                  readOnly
                  dir="ltr"
                  data-import-invite
                  aria-label={t`Invite link`}
                  value={invite()}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  variant="tonal"
                  size="md"
                  shape="square"
                  onPress={() => void copy("invite", invite())}
                >
                  <Show
                    when={copied() === "invite"}
                    fallback={<Trans>Copy</Trans>}
                  >
                    <Trans>Copied</Trans>
                  </Show>
                </Button>
              </CopyRow>
              <TextField
                name="community-message"
                label={t`A message for your old community`}
                rows={4}
                value={message()}
                onInput={(event) => setMessage(event.currentTarget.value)}
              />
              <Tail>
                <Fine>
                  <Trans>
                    Yours to edit and post. Zrzur posts nothing anywhere.
                  </Trans>
                </Fine>
                <Button
                  variant="tonal"
                  size="md"
                  shape="square"
                  onPress={() => void copy("message", message())}
                >
                  <Show
                    when={copied() === "message"}
                    fallback={<Trans>Copy message</Trans>}
                  >
                    <Trans>Copied</Trans>
                  </Show>
                </Button>
              </Tail>
            </>
          )}
        </Show>
        <Fine>
          <Trans>
            Roles are empty until people join: give them out in Server settings.
            A role that belonged to a bot can be removed there.
          </Trans>
        </Fine>
      </Stack>
    );
  }

  const Body = () => (
    <div data-import-stage={stage()}>
      <Switch>
        <Match when={stage() === "link"}>
          <LinkStep />
        </Match>
        <Match when={stage() === "preview" && preview()}>
          {(current) => <PreviewStep preview={current()} />}
        </Match>
        <Match when={stage() === "done"}>
          <DoneStep />
        </Match>
      </Switch>
    </div>
  );

  return { stage, busy, title, description, actions, Body };
}

/** One step of the flow: its parts 16 px apart, the rhythm of the app's pages */
const Stack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});
const text13 = { fontSize: "13px", lineHeight: "20px" } as const;
const Lead = styled("p", {
  base: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
  },
});
const Fine = styled("p", {
  base: { margin: 0, ...text13, color: "var(--z-fg-muted)" },
});
const FieldLabel = styled("div", {
  base: { ...text13, fontWeight: 600, color: "var(--z-fg-secondary)" },
});
const Steps = styled("ol", {
  base: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    counterReset: "step",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "15px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
    "& b": { fontWeight: 600, color: "var(--z-fg-primary)" },
    "& li": {
      counterIncrement: "step",
      display: "grid",
      gridTemplateColumns: "24px minmax(0, 1fr)",
      columnGap: "8px",
      alignItems: "start",
    },
    // the number, in the app's own digits for the language
    "& li::before": {
      content: "counter(step)",
      width: "22px",
      height: "22px",
      display: "grid",
      placeItems: "center",
      borderRadius: "50%",
      border: "1px solid var(--z-border-subtle)",
      fontSize: "12px",
      lineHeight: 1,
      fontWeight: 600,
      color: "var(--z-fg-muted)",
    },
    "& li > span": { minWidth: 0 },
  },
});
const TextLink = styled("button", {
  base: {
    alignSelf: "flex-start",
    minHeight: "24px",
    padding: "4px 0",
    border: 0,
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-link)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    ...text13,
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});
const Paste = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
});
const box = {
  border: "1px solid var(--z-border-subtle)",
  borderRadius: "10px",
  background: "var(--z-bg-sidebar)",
} as const;
const CopyRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "stretch",
    gap: "8px",
    minWidth: 0,
    "& input": {
      flex: 1,
      minWidth: 0,
      height: "44px",
      paddingInline: "12px",
      borderRadius: "var(--z-radius, 10px)",
      border:
        "1px solid color-mix(in srgb, var(--z-fg-primary) 10%, transparent)",
      background: "var(--z-field-bg)",
      boxShadow: "var(--z-field-shadow)",
      color: "var(--z-fg-primary)",
      fontFamily: "var(--fonts-monospace, monospace)",
      fontSize: "14px",
      textAlign: "left",
      textOverflow: "ellipsis",
      _focusVisible: {
        outline: "none",
        borderColor: "var(--z-accent)",
        boxShadow: "var(--z-field-focus-shadow)",
      },
      _phone: { fontSize: "16px" },
    },
    "& button": { flexShrink: 0, minHeight: "44px" },
  },
});
const Two = styled("div", {
  base: {
    ...box,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    "& > div": { padding: "12px 16px", minWidth: 0 },
    "& > div + div": { borderInlineStart: "1px solid var(--z-border-subtle)" },
    "& h4": {
      margin: "0 0 4px",
      ...text13,
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
    },
    "& h4[data-moves]": { color: "var(--z-status-success)" },
    "& p": { margin: 0, ...text13, color: "var(--z-fg-secondary)" },
    _phone: {
      gridTemplateColumns: "1fr",
      "& > div + div": {
        borderInlineStart: 0,
        borderBlockStart: "1px solid var(--z-border-subtle)",
      },
    },
  },
});
const Counts = styled("div", {
  base: {
    display: "flex",
    gap: "24px",
    ...text13,
    color: "var(--z-fg-secondary)",
    "& > div": { display: "flex", flexDirection: "column" },
    "& b": {
      fontSize: "22px",
      lineHeight: "28px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
  },
});
const Panes = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});
const Pane = styled("div", {
  base: {
    ...box,
    padding: "8px 0",
    maxHeight: "264px",
    overflowY: "auto",
    minWidth: 0,
  },
});
const PaneTitle = styled("div", {
  base: {
    padding: "8px 16px 4px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});
const CategoryTitle = styled("div", {
  base: {
    padding: "12px 16px 4px",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "&:first-child": { paddingBlockStart: "4px" },
  },
});
const Line = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "32px",
    padding: "4px 16px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-icon-muted)",
    "& > .z-icon": { flexShrink: 0 },
    "& > span:not(.z-icon)": {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      flexShrink: 0,
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
    "& small[data-held]": { color: "var(--z-status-warning)" },
  },
});
const Dot = styled("span", {
  base: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    flex: "0 0 10px!",
  },
});
const Wont = styled("div", {
  base: {
    ...box,
    padding: "12px 16px",
    "& h4": {
      margin: "0 0 8px",
      fontSize: "14px",
      lineHeight: "20px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& ul": {
      margin: 0,
      paddingInlineStart: "18px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      ...text13,
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
    "& li[data-warn]": { color: "var(--z-fg-primary)" },
    "& li[data-warn]::marker": { color: "var(--z-status-warning)" },
  },
});
const Ready = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-status-success)",
    "--z-icon-color": "currentColor",
    "& > .z-icon": { flexShrink: 0 },
  },
});
const Tail = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    "& button": { flexShrink: 0, minHeight: "44px" },
  },
});
