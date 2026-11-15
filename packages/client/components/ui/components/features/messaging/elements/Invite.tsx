import { Match, Switch, createSignal } from "solid-js";

import { Plural, Trans } from "@lingui/solid/macro";
import { useNavigate } from "@solidjs/router";
import { useMutation, useQuery } from "@tanstack/solid-query";
import {
  JoinRequestCreated,
  PublicChannelInvite,
  ServerPublicInvite,
} from "@zrzur/sdk/solid";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { Avatar, Button, CircularProgress } from "@revolt/ui/components/design";

interface Props {
  code: string;
}

/**
 * Card for a server invite link posted in chat: the server, its members and
 * Join. An expired or unknown code says so; a server you are in opens.
 */
export function Invite(props: Props) {
  const client = useClient();
  const navigate = useNavigate();
  const { showError } = useModals();

  const query = useQuery(() => ({
    queryKey: ["invite", props.code],
    queryFn: () =>
      client()
        .api.get(`/invites/${props.code as ""}`)
        .then((invite) => PublicChannelInvite.from(client(), invite)),

    retry: false,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  }));

  const server = () =>
    query.data instanceof ServerPublicInvite ? query.data : undefined;
  const member = () => {
    const invite = server();
    return !!invite && !!client().servers?.has(invite.serverId);
  };

  const [requested, setRequested] = createSignal(false);
  const needsApproval = () => server()?.serverAccess === "Approval";

  const join = useMutation(() => ({
    mutationFn: () => server()!.join(),
    onSuccess(joined) {
      navigate(joined.path);
    },
    onError(error) {
      // a private server records a request instead of a membership
      if (error instanceof JoinRequestCreated) setRequested(true);
      else showError(error);
    },
  }));

  return (
    <Base data-invite-card data-state={state(query, server, member)}>
      <Switch
        fallback={
          <>
            <CircularProgress />
            <Line>
              <Trans>Loading…</Trans>
            </Line>
          </>
        }
      >
        <Match when={query.isError}>
          <Info>
            <Name>
              <span>
                <Trans>Invalid invite</Trans>
              </span>
            </Name>
            <Line>
              <Trans>This invite has expired or doesn't exist.</Trans>
            </Line>
          </Info>
        </Match>
        <Match when={server()}>
          {(invite) => (
            <>
              <Avatar
                size={48}
                src={invite().serverIcon?.previewUrl}
                fallback={invite().serverName}
              />
              <Info>
                <Name>
                  <span>{invite().serverName}</span>
                </Name>
                <Line>
                  <Switch
                    fallback={
                      <Plural
                        value={invite().memberCount}
                        one="# member"
                        other="# members"
                      />
                    }
                  >
                    <Match when={member()}>
                      <Trans>You're a member</Trans>
                    </Match>
                  </Switch>
                </Line>
              </Info>
              <div class={action}>
                <Switch
                  fallback={
                    <Button
                      isDisabled={join.isPending}
                      onPress={() => join.mutate()}
                    >
                      {needsApproval() ? (
                        <Trans>Request to join</Trans>
                      ) : (
                        <Trans>Join</Trans>
                      )}
                    </Button>
                  }
                >
                  <Match when={member()}>
                    <Button
                      variant="tonal"
                      onPress={() =>
                        navigate(client().servers.get(invite().serverId)!.path)
                      }
                    >
                      <Trans>Open server</Trans>
                    </Button>
                  </Match>
                  <Match when={requested()}>
                    <Button isDisabled>
                      <Trans>Requested</Trans>
                    </Button>
                  </Match>
                </Switch>
              </div>
            </>
          )}
        </Match>
        <Match when={query.data}>
          {/* an invite of another kind: the invite page shows it */}
          <Info>
            <Name>
              <span>
                <Trans>Invite link</Trans>
              </span>
            </Name>
            <Line>
              <Trans>Open this invite to see where it leads.</Trans>
            </Line>
          </Info>
          <div class={action}>
            <Button
              variant="tonal"
              onPress={() => navigate(`/invite/${props.code}`)}
            >
              <Trans>Open invite</Trans>
            </Button>
          </div>
        </Match>
      </Switch>
    </Base>
  );
}

/** For tests and styling: what the card shows */
function state(
  query: { isError: boolean; data?: unknown },
  server: () => ServerPublicInvite | undefined,
  member: () => boolean,
) {
  if (query.isError) return "invalid";
  if (server()) return member() ? "member" : "join";
  return query.data ? "other" : "loading";
}

const Base = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "12px",

    maxWidth: "420px",
    minHeight: "72px",
    marginBlock: "4px",
    padding: "12px 16px",
    borderRadius: "12px",

    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
  },
});

const action = css({ flexShrink: 0, marginInlineStart: "auto" });

const Info = styled("div", {
  base: {
    // narrow chats: the button moves below instead of squeezing the text
    flex: "1 1 160px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const Name = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    fontWeight: 600,
    color: "var(--z-fg-primary)",

    "& > span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const Line = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    lineClamp: 2,
  },
});
