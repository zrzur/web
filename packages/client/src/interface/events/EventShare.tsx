import { For, Show, createResource, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  Button,
  FloatingSelect,
  MenuItem,
  TextField,
  Toggle,
} from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { invitationLink, linkBase, shareLink } from "./eventLinks";

type Invitation = API.ServerEventInvitation;

/** Copy a text; false when the browser refuses */
async function copyText(text: string) {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Organisers: the share link of an event (make it, name it, open it to
 * people outside the server, take it away) and, for an event that is for
 * invited people, its invitation links.
 */
export function EventShare(props: { event: API.ServerEvent; serverId: string }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const [error, setError] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);
  const [copied, setCopied] = createSignal<string>();
  const [name, setName] = createSignal<string>();
  const [uses, setUses] = createSignal("0");
  const [expires, setExpires] = createSignal("0");

  const base = () =>
    linkBase(client().configuration?.app || location.origin);
  const link = () => props.event.link ?? undefined;
  const publicAllowed = () =>
    (
      client().configuration?.features as
        | { server_event_public_links?: boolean }
        | undefined
    )?.server_event_public_links === true;
  const invitedOnly = () => props.event.visibility === "Invited";
  const typedName = () => name() ?? link()?.name ?? "";

  const [invitations, { refetch }] = createResource(
    () => (invitedOnly() ? props.event._id : undefined),
    (id) => client().serverEvents.fetchInvitations(props.serverId, id),
  );

  async function act(action: () => Promise<unknown>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function copy(key: string, text: string) {
    setCopied((await copyText(text)) ? key : `failed:${key}`);
    setTimeout(() => setCopied(undefined), 2500);
  }

  const setLink = (data: { name?: string; public?: boolean }) =>
    act(() =>
      client().serverEvents.setLink(props.serverId, props.event._id, data),
    );

  function until(invitation: Invitation) {
    if (!invitation.expires_at) return undefined;
    return new Intl.DateTimeFormat(i18n().locale ?? "en", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: hour12From(timeLocale()[1].formats?.LT),
    }).format(new Date(invitation.expires_at));
  }

  return (
    <Box data-testid="event-share-panel">
      <Title>
        <Trans context="scheduled events">Sharing</Trans>
      </Title>

      <Show
        when={link()}
        fallback={
          <>
            <Note>
              <Trans>
                A short link that opens this event. Only people who can already
                see the event can open it.
              </Trans>
            </Note>
            <Row>
              <Button
                size="sm"
                variant="tonal"
                isDisabled={busy()}
                onPress={() => void setLink({})}
                data-testid="event-link-make"
              >
                <Icon name="link" size={16} />
                <Trans>Make a share link</Trans>
              </Button>
            </Row>
          </>
        }
      >
        <LinkLine>
          <code dir="ltr" data-testid="event-link">
            {shareLink(base(), link()!)}
          </code>
          <Button
            size="sm"
            variant="text"
            onPress={() => void copy("link", shareLink(base(), link()!))}
            data-testid="event-link-copy"
          >
            <Icon name="copy" size={16} />
            {copied() === "link" ? (
              <Trans>Copied</Trans>
            ) : (
              <Trans context="scheduled events">Copy</Trans>
            )}
          </Button>
        </LinkLine>
        <Show when={copied() === "failed:link"}>
          <Problem role="alert">
            <Trans>The link could not be copied. Select it and copy it.</Trans>
          </Problem>
        </Show>

        <NameLine>
          <TextField
            variant="outlined"
            label={t`Name in the link`}
            maxlength={40}
            value={typedName()}
            onInput={(event) => setName(event.currentTarget.value)}
            data-testid="event-link-name"
          />
          <Button
            size="sm"
            variant="tonal"
            isDisabled={busy() || typedName() === (link()?.name ?? "")}
            onPress={() =>
              void setLink({ name: typedName() }).then(() =>
                setName(undefined),
              )
            }
            data-testid="event-link-name-save"
          >
            <Trans context="scheduled events">Save</Trans>
          </Button>
        </NameLine>

        <Show when={publicAllowed() && props.event.status !== "Draft"}>
          <ToggleRow>
            <label for={`event-link-public-${props.event._id}`}>
              <Trans>People outside the server can open it</Trans>
              <small>
                <Trans>
                  They see the title, the time, the cover and the server's
                  name. Never who is coming.
                </Trans>
              </small>
            </label>
            <Toggle
              id={`event-link-public-${props.event._id}`}
              checked={props.event.link_public === true}
              onChange={(value: boolean) => void setLink({ public: value })}
              data-testid="event-link-public"
            />
          </ToggleRow>
        </Show>

        <Row>
          <Button
            size="sm"
            variant="text"
            isDisabled={busy()}
            onPress={() =>
              void act(() =>
                client().serverEvents.removeLink(
                  props.serverId,
                  props.event._id,
                ),
              )
            }
            data-testid="event-link-remove"
          >
            <Icon name="x" size={16} />
            <Trans>Remove the link</Trans>
          </Button>
        </Row>
      </Show>

      <Show when={invitedOnly()}>
        <Divider />
        <Title>
          <Trans>Invitation links</Trans>
        </Title>
        <Note>
          <Trans>
            A member of the server who opens one joins the invited people.
          </Trans>
        </Note>
        <List data-testid="event-invitations">
          <For each={invitations() ?? []}>
            {(invitation) => (
              <Invite data-testid="event-invitation">
                <div>
                  <code dir="ltr">
                    {invitationLink(base(), invitation.code)}
                  </code>
                  <small>
                    <Show
                      when={invitation.max_uses}
                      fallback={
                        <Plural
                          value={invitation.uses}
                          one="Used # time"
                          other="Used # times"
                        />
                      }
                    >
                      <Trans>
                        Used {invitation.uses} of {invitation.max_uses}
                      </Trans>
                    </Show>
                    <Show when={until(invitation)}>
                      {" · "}
                      <Trans>until {until(invitation)}</Trans>
                    </Show>
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="text"
                  aria-label={t`Copy the invitation link`}
                  onPress={() =>
                    void copy(
                      invitation.code,
                      invitationLink(base(), invitation.code),
                    )
                  }
                  data-testid="event-invitation-copy"
                >
                  <Icon
                    name={copied() === invitation.code ? "check" : "copy"}
                    size={16}
                  />
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  aria-label={t`Remove the invitation link`}
                  isDisabled={busy()}
                  onPress={() =>
                    void act(async () => {
                      await client().serverEvents.deleteInvitation(
                        props.serverId,
                        props.event._id,
                        invitation.code,
                      );
                      await refetch();
                    })
                  }
                  data-testid="event-invitation-remove"
                >
                  <Icon name="trash" size={16} />
                </Button>
              </Invite>
            )}
          </For>
        </List>
        <NewInvite>
          <FloatingSelect
            id={`event-invitation-uses-${props.event._id}`}
            label={t`How many people`}
            value={uses()}
            onChange={(event) => setUses(event.currentTarget.value)}
          >
            <MenuItem value="0">{t`No limit`}</MenuItem>
            <MenuItem value="1">1</MenuItem>
            <MenuItem value="5">5</MenuItem>
            <MenuItem value="10">10</MenuItem>
            <MenuItem value="25">25</MenuItem>
            <MenuItem value="50">50</MenuItem>
          </FloatingSelect>
          <FloatingSelect
            id={`event-invitation-expires-${props.event._id}`}
            label={t`Works for`}
            value={expires()}
            onChange={(event) => setExpires(event.currentTarget.value)}
          >
            <MenuItem value="0">{t`Until the event`}</MenuItem>
            <MenuItem value="3600">{t`1 hour`}</MenuItem>
            <MenuItem value="86400">{t`1 day`}</MenuItem>
            <MenuItem value="604800">{t`7 days`}</MenuItem>
          </FloatingSelect>
          <Button
            size="sm"
            variant="tonal"
            isDisabled={busy() || (invitations()?.length ?? 0) >= 10}
            onPress={() =>
              void act(async () => {
                await client().serverEvents.createInvitation(
                  props.serverId,
                  props.event._id,
                  {
                    max_uses: Number(uses()) || undefined,
                    expires_in: Number(expires()) || undefined,
                  },
                );
                await refetch();
              })
            }
            data-testid="event-invitation-make"
          >
            <Icon name="plus" size={16} />
            <Trans>New invitation link</Trans>
          </Button>
        </NewInvite>
        <Show when={(invitations()?.length ?? 0) >= 10}>
          <Note>
            <Trans>An event has at most 10 invitation links.</Trans>
          </Note>
        </Show>
      </Show>

      <Show when={error()}>
        <Problem role="alert">
          <TranslatedError error={error()} />
        </Problem>
      </Show>
    </Box>
  );
}

const Box = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    minWidth: 0,
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-raised)",
  },
});

const Title = styled("h3", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 650,
    color: "var(--z-fg-muted)",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Row = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const code = {
  minWidth: 0,
  fontFamily: "var(--z-font-mono, monospace)",
  fontSize: "13px",
  lineHeight: "20px",
  color: "var(--z-fg-primary)",
  overflowWrap: "anywhere",
  textAlign: "start",
} as const;

const LinkLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minHeight: "44px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-input)",
    "& code": code,
    _phone: { paddingInlineEnd: "4px" },
  },
});

const NameLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    "& > :first-child": { flex: 1, minWidth: 0 },
  },
});

const ToggleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "44px",
    color: "var(--z-fg-primary)",
    fontSize: "15px",
    "& label": { display: "flex", flexDirection: "column", minWidth: 0 },
    "& small": {
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Divider = styled("hr", {
  base: {
    margin: "4px 0",
    border: "none",
    borderBlockStart: "1px solid var(--z-border-subtle)",
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    "&:empty": { display: "none" },
  },
});

const Invite = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "48px",
    paddingBlock: "4px",
    "& > div": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
    },
    "& code": code,
    "& small": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
    "& + &": { borderBlockStart: "1px solid var(--z-border-subtle)" },
  },
});

const NewInvite = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    alignItems: "center",
    "& > :last-child": { gridColumn: "1 / -1", justifySelf: "start" },
    _phone: { gridTemplateColumns: "1fr" },
  },
});

const Problem = styled("span", {
  base: { fontSize: "13px", lineHeight: "18px", color: "var(--z-danger)" },
});
