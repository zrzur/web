import { Match, Show, Switch, createEffect, createSignal, on } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { API } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useApi, useClient, useClientLifecycle } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { useNavigate, useParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button } from "@revolt/ui";
import { hour12From } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { eventTimes } from "./eventFormat";
import { isInvitationCode, isSharePath } from "./eventLinks";
import { Ticket, TicketStub } from "./Ticket";

type Preview = API.ServerEventLinkPreview;

/**
 * Where a share link (`/e/<name>-<code>`) lands. A member of the event's
 * server goes straight to the event. Anyone else, signed in or not, sees
 * the ticket of an event whose organiser opened the link: its title, time
 * and server, nothing about who comes.
 */
export function EventLinkPage() {
  const params = useParams();
  const api = useApi();
  const client = useClient();
  const navigate = useNavigate();
  const state = useState();
  const { i18n } = useLingui();
  const { isLoggedIn } = useClientLifecycle();
  const [preview, setPreview] = createSignal<Preview>();
  const [missing, setMissing] = createSignal(false);

  const path = () => {
    try {
      return decodeURIComponent(params.path ?? "");
    } catch {
      return "";
    }
  };

  createEffect(
    on([path, isLoggedIn], async ([path, signedIn]) => {
      if (!isSharePath(path)) return setMissing(true);
      try {
        // signed in: the server says where the event is, if you may see it
        const found: Preview = await (signedIn ? client().api : api).get(
          `/invites/event/${encodeURIComponent(path) as ""}`,
        );
        if (found.server && found.event)
          return navigate(`/server/${found.server}/events/${found.event}`, {
            replace: true,
          });
        setMissing(false);
        setPreview(found);
      } catch {
        setPreview(undefined);
        setMissing(true);
      }
    }),
  );

  /** After signing in the app comes back to this link */
  function signIn() {
    state.layout.setNextPath(location.pathname);
    navigate("/login");
  }

  return (
    <Page data-testid="event-link-page">
      <Switch>
        <Match when={preview()}>
          <Ticket data-testid="event-link-ticket">
            <TicketStub
              startsAt={preview()!.starts_at}
              quiet={
                preview()!.status === "Cancelled" ||
                preview()!.status === "Completed"
              }
            />
            <Body>
              <Server>{preview()!.server_name}</Server>
              <h1 dir="auto">{preview()!.title}</h1>
              <Line>
                <Icon name="calendar" size={16} />
                <time datetime={preview()!.starts_at}>
                  {eventTimes(
                    preview()!,
                    i18n().locale ?? "en",
                    hour12From(timeLocale()[1].formats?.LT),
                  )}
                </time>
              </Line>
              <Show when={preview()!.status === "Cancelled"}>
                <Line data-tone="off">
                  <Trans>This event was called off.</Trans>
                </Line>
              </Show>
              <Show when={preview()!.status === "Completed"}>
                <Line data-tone="off">
                  <Trans>This event is over</Trans>
                </Line>
              </Show>
            </Body>
          </Ticket>
          <Note>
            <Trans>
              Members of the server see the whole event and can answer it.
            </Trans>
          </Note>
        </Match>
        <Match when={missing()}>
          <Empty>
            <Icon name="calendar" size={32} />
            <h1>
              <Trans>This link does not open an event</Trans>
            </h1>
            <Note>
              <Trans>
                It may have been removed, or the event is only for the members
                of its server.
              </Trans>
            </Note>
          </Empty>
        </Match>
      </Switch>
      <Show when={preview() || missing()}>
        <Row>
          <Show
            when={isLoggedIn()}
            fallback={
              <Button onPress={signIn} data-testid="event-link-sign-in">
                <Trans>Sign in</Trans>
              </Button>
            }
          >
            <Button onPress={() => navigate("/")} data-testid="event-link-open">
              <Trans>Open Zrzur</Trans>
            </Button>
          </Show>
        </Row>
      </Show>
    </Page>
  );
}

/**
 * Where an invitation link (`/e/join/<code>`) lands: the person joins the
 * invited people of the event and goes to it.
 */
export function EventInvitationPage() {
  const params = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const [problem, setProblem] = createSignal<"member" | "gone">();

  createEffect(
    on(
      () => params.code ?? "",
      async (code) => {
        if (!isInvitationCode(code)) return setProblem("gone");
        try {
          const found = await client().serverEvents.acceptInvitation(code);
          navigate(`/server/${found.server}/events/${found.event}`, {
            replace: true,
          });
        } catch (failure) {
          setProblem(
            (failure as { type?: string } | undefined)?.type ===
              "InvalidOperation"
              ? "member"
              : "gone",
          );
        }
      },
    ),
  );

  return (
    <Page data-testid="event-invitation-page">
      <Show when={problem()}>
        <Empty>
          <Icon name="calendar" size={32} />
          <h1 data-testid="event-invitation-problem" data-problem={problem()}>
            <Show
              when={problem() === "member"}
              fallback={<Trans>This invitation no longer works</Trans>}
            >
              <Trans>Join the server first</Trans>
            </Show>
          </h1>
          <Note>
            <Show
              when={problem() === "member"}
              fallback={
                <Trans>
                  It ran out or was taken away. Ask the organiser for a new
                  one.
                </Trans>
              }
            >
              <Trans>
                This invitation is for the members of the event's server. Join
                it, then open the link again.
              </Trans>
            </Show>
          </Note>
        </Empty>
        <Row>
          <Button onPress={() => navigate("/")}>
            <Trans>Open Zrzur</Trans>
          </Button>
        </Row>
      </Show>
    </Page>
  );
}

const Page = styled("main", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    gap: "16px",
    width: "100%",
    maxWidth: "560px",
    minHeight: "100dvh",
    marginInline: "auto",
    padding: "24px 16px",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-chat)",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "20px 24px",
    minWidth: 0,
    "& h1": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      overflowWrap: "anywhere",
      color: "var(--z-header-primary, var(--z-fg-primary))",
    },
    _phone: { padding: "16px", "& h1": { fontSize: "18px", lineHeight: "26px" } },
  },
});

const Server = styled("span", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});

const Line = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "15px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
    "&[data-tone=off]": { color: "var(--z-status-warning)" },
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

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
    color: "var(--z-fg-secondary)",
    "& h1": {
      margin: 0,
      fontSize: "20px",
      lineHeight: "28px",
      fontWeight: 700,
      color: "var(--z-header-primary, var(--z-fg-primary))",
    },
  },
});

const Row = styled("div", {
  base: { display: "flex", justifyContent: "center", gap: "8px" },
});
