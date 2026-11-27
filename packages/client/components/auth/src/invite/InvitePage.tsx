import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createRoot,
  createSignal,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import {
  JoinRequestCreated,
  PublicChannelInvite,
  ServerPublicInvite,
  File as StoatFile,
} from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient, useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { toBirthMonth } from "@revolt/client/age";
import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { Markdown } from "@revolt/markdown";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import { A, useNavigate, useParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui";
import { BrandName } from "@revolt/ui/components/design/BrandName";
import { Icon } from "@revolt/ui/icons";

import { AuthButton } from "../flows/Flow";
import { Fields, Form, SubmitButton } from "../flows/Form";

import {
  type DeadReason,
  type JoinByLinkResponse,
  type ServerInviteInfo,
  arrivalPath,
  deadReason,
  forgetInvite,
  memberCount,
  rememberInvite,
} from "./inviteLogic";

/** Where the page is: the server, the form, or what came of joining */
type Step =
  | { at: "server" }
  | { at: "form" }
  | { at: "requested" }
  | { at: "check-email" }
  | { at: "refused"; error: unknown };

/**
 * The page behind an invite link (`/invite/{code}`): the server first, for
 * anyone, signed in or not. One button joins. Without an account the button
 * opens a three-field form in place (when the server offers the short join
 * path) and the person lands in the conversation.
 */
export default function InvitePage() {
  const { t, i18n } = useLingui();
  const params = useParams();
  const navigate = useNavigate();
  const client = useClient();
  const state = useState();
  const { config } = useInstance();
  const lifecycle = useClientLifecycle();

  const code = () => params.code ?? "";
  const [step, setStep] = createSignal<Step>({ at: "server" });
  const [busy, setBusy] = createSignal(false);
  const [joinError, setJoinError] = createSignal<unknown>();

  const [invite] = createResource(code, async (value) => {
    if (!isInviteCode(value)) throw { type: "NotFound" };
    const data = await client().api.get(`/invites/${value as ""}`);
    // a group invite has no page of its own: the app's dialog handles it
    // (signed out, the app asks to log in first and comes back to it)
    if (data.type !== "Server") {
      navigate(`/invite-dialog/${value}`, { replace: true });
      return undefined;
    }
    return data as ServerInviteInfo;
  });

  const dead = (): DeadReason | undefined =>
    invite.error
      ? deadReason(invite.error)
      : invite()?.invites_paused
        ? "paused"
        : undefined;

  onMount(() => {
    // search engines never list invite pages
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
  });

  const signedIn = () => lifecycle.isLoggedIn();
  const shortPath = () =>
    !!(config.features as { join_by_link?: boolean }).join_by_link;
  const member = () =>
    signedIn() && invite() && client().servers.get(invite()!.server_id);
  const asksFirst = () => invite()?.server_access === "Approval";
  const members = () => memberCount(invite()?.member_count ?? 0, i18n().locale);
  const file = (value?: unknown) =>
    value ? new StoatFile(client(), value as never).createFileURL() : undefined;

  /** Join as the person who is signed in */
  async function joinSignedIn() {
    const data = invite();
    if (!data || busy()) return;
    if (member()) return navigate(arrivalPath(data.server_id, data.channel_id));

    setBusy(true);
    setJoinError(undefined);
    try {
      await (
        PublicChannelInvite.from(client(), data) as ServerPublicInvite
      ).join();
      forgetInvite();
      navigate(arrivalPath(data.server_id, data.channel_id));
    } catch (error) {
      // a request was recorded: not a failure, and not a membership
      if (error instanceof JoinRequestCreated) setStep({ at: "requested" });
      else setJoinError(error);
    } finally {
      setBusy(false);
    }
  }

  /** Resolves once the client is connected (or after 15 s, whatever comes) */
  function connected() {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(done, 15_000);
      let dispose: (() => void) | undefined;
      function done() {
        clearTimeout(timer);
        dispose?.();
        resolve();
      }
      createRoot((stop) => {
        dispose = stop;
        createEffect(() => {
          if (lifecycle.lifecycle.state() === State.Connected) done();
        });
      });
    });
  }

  /** The main button of the page */
  function onJoin() {
    if (signedIn()) return joinSignedIn();
    if (shortPath()) return setStep({ at: "form" });
    // no short path on this server: the usual sign-up, and back here after
    rememberInvite(code());
    navigate("/login/create");
  }

  /** Name, e-mail, month and year of birth: make the account and enter */
  async function signUp(data: FormData) {
    const answer = (await client().api.post(
      "/auth/account/join" as never,
      {
        email: data.get("email"),
        display_name: data.get("display-name"),
        birth_month: toBirthMonth(
          Number(data.get("birth-year")),
          Number(data.get("birth-month")),
        ),
        invite: code(),
        captcha: data.get("captcha") ?? undefined,
      } as never,
    )) as JoinByLinkResponse;

    if (answer.result === "CheckEmail") {
      setStep({ at: "check-email" });
      return;
    }

    forgetInvite();
    lifecycle.enterWithSession(answer.session);
    // the app sends anyone who is not connected yet to the log-in page and
    // back, and the way back was lost on that trip: wait here instead
    await connected();

    const target = invite()!;
    if (answer.joined?.type === "Server") {
      navigate(arrivalPath(target.server_id, target.channel_id), {
        replace: true,
      });
    } else if (answer.joined?.type === "JoinRequest") {
      setStep({ at: "requested" });
    } else {
      setStep({ at: "refused", error: { type: answer.join_error } });
    }
  }

  return (
    <Page>
      <Top>
        <Brand href={signedIn() ? "/app" : "/login"} aria-label={t`Zrzur`}>
          <img
            src={brandMarkSrc(state.theme.activeTheme.darkMode)}
            alt=""
            width={32}
            height={32}
          />
          <BrandName />
        </Brand>
        <Show when={!signedIn()}>
          <TopLink href="/login/auth" onClick={() => rememberInvite(code())}>
            <Trans>Log in</Trans>
          </TopLink>
        </Show>
      </Top>

      <Stage>
        <Switch>
          {/* still loading: the frame keeps its place, nothing jumps */}
          <Match when={invite.loading}>
            <Card data-invite-page="loading" aria-busy="true">
              <Banner />
              <Columns>
                <Info>
                  <Skeleton style={{ width: "60%", height: "28px" }} />
                  <Skeleton style={{ width: "40%", height: "16px" }} />
                </Info>
              </Columns>
            </Card>
          </Match>

          <Match when={dead() === "offline"}>
            <Notice data-invite-page="offline">
              <Icon name="wifi-slash" size={48} aria-hidden="true" />
              <h1>
                <Trans>We couldn't open this invite</Trans>
              </h1>
              <p>
                <Trans>
                  Check your connection and try again. The link itself may be
                  fine.
                </Trans>
              </p>
              <Actions>
                <AuthButton onPress={() => window.location.reload()}>
                  <Trans>Try again</Trans>
                </AuthButton>
              </Actions>
            </Notice>
          </Match>

          <Match when={dead()}>
            <Notice data-invite-page={dead()}>
              <Icon name="link" size={48} aria-hidden="true" />
              <h1>
                <Show
                  when={dead() === "paused"}
                  fallback={<Trans>This invite link has ended</Trans>}
                >
                  <Trans>This server isn't taking new people right now</Trans>
                </Show>
              </h1>
              <p>
                <Show
                  when={dead() === "paused"}
                  fallback={
                    <Trans>
                      Links can run out or be switched off. Ask the person who
                      sent it for a new one.
                    </Trans>
                  }
                >
                  <Trans>
                    The people who run it have paused invites for a while. Try
                    the same link again later.
                  </Trans>
                </Show>
              </p>
              <Actions>
                <AuthButton
                  onPress={() => {
                    forgetInvite();
                    navigate(signedIn() ? "/discover" : "/login");
                  }}
                >
                  <Show when={signedIn()} fallback={<Trans>Open Zrzur</Trans>}>
                    <Trans>Find servers in Discover</Trans>
                  </Show>
                </AuthButton>
              </Actions>
            </Notice>
          </Match>

          <Match when={invite()}>
            {(data) => (
              <Card data-invite-page={step().at}>
                <Banner
                  style={
                    file(data().server_banner)
                      ? {
                          "background-image": `url("${file(data().server_banner)}")`,
                        }
                      : undefined
                  }
                />
                <Columns>
                  <Info>
                    <Head>
                      <IconFrame>
                        <Avatar
                          size={88}
                          shape="rounded-square"
                          src={file(data().server_icon)}
                          fallback={data().server_name}
                        />
                      </IconFrame>
                      <h1>{data().server_name}</h1>
                      <Meta>
                        <span>
                          <Icon name="users" size={16} aria-hidden="true" />
                          <Trans>Members: {members()}</Trans>
                        </span>
                        <Show when={!data().custom_link}>
                          <span data-invited-by>
                            <Avatar
                              size={20}
                              src={file(data().user_avatar)}
                              fallback={data().user_name}
                            />
                            <Trans>{data().user_name} invited you</Trans>
                          </span>
                        </Show>
                      </Meta>
                    </Head>
                    <Show when={data().server_description}>
                      {/* written in Markdown, as everywhere else it shows */}
                      <Description dir="auto">
                        <Markdown content={data().server_description!} />
                      </Description>
                    </Show>
                    <Show when={asksFirst() && step().at === "server"}>
                      <Inside>
                        <li>
                          <Icon
                            name="lock-simple"
                            size={20}
                            aria-hidden="true"
                          />
                          <div>
                            <b>
                              <Trans>
                                This server asks before letting people in
                              </Trans>
                            </b>
                            <small>
                              <Trans>
                                Someone who runs it will look at your request.
                              </Trans>
                            </small>
                          </div>
                        </li>
                      </Inside>
                    </Show>
                    <Show when={!asksFirst() && data().inside?.length}>
                      <Label>
                        <Trans>Inside</Trans>
                      </Label>
                      <Inside data-invite-inside>
                        <For each={data().inside}>
                          {(channel) => (
                            <li>
                              <Icon
                                name={channel.voice ? "speaker-high" : "hash"}
                                size={20}
                                aria-hidden="true"
                              />
                              <b>{channel.name}</b>
                              <Show when={channel.voice}>
                                <small data-end>
                                  <Trans>Voice</Trans>
                                </small>
                              </Show>
                            </li>
                          )}
                        </For>
                      </Inside>
                    </Show>
                  </Info>

                  <Side data-step={step().at}>
                    <Switch>
                      <Match when={step().at === "form"}>
                        <SheetHead>
                          <h2>
                            <Trans>Joining {data().server_name}</Trans>
                          </h2>
                          <p>
                            <Trans>Three things and you're in.</Trans>
                          </p>
                        </SheetHead>
                        <Form
                          onSubmit={signUp}
                          captcha={config.features.captcha.key}
                          actions={
                            <>
                              <SubmitButton>
                                <Trans>Create account and join</Trans>
                              </SubmitButton>
                              <Legal>
                                <Trans>
                                  By continuing you accept the{" "}
                                  <a
                                    href="https://zrzur.com/legal/terms"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Terms
                                  </a>{" "}
                                  and the{" "}
                                  <a
                                    href="https://zrzur.com/legal/community-guidelines"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Community Guidelines
                                  </a>
                                  , and have read the{" "}
                                  <a
                                    href="https://zrzur.com/legal/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Privacy Policy
                                  </a>
                                  . Zrzur is for people aged 16 and over.
                                </Trans>
                                <br />
                                <Trans>
                                  You'll choose a password from the email we
                                  send you. Confirm it within 3 days to keep the
                                  account.
                                </Trans>
                              </Legal>
                            </>
                          }
                        >
                          <Fields
                            fields={["display-name", "email", "birth-month"]}
                          />
                        </Form>
                        <Quiet
                          type="button"
                          onClick={() => setStep({ at: "server" })}
                        >
                          <Trans>Back</Trans>
                        </Quiet>
                      </Match>

                      <Match when={step().at === "requested"}>
                        <SheetHead role="status">
                          <h2>
                            <Trans>Request sent</Trans>
                          </h2>
                          <p>
                            <Trans>
                              You'll join this server as soon as someone who
                              runs it approves you.
                            </Trans>
                          </p>
                        </SheetHead>
                        <AuthButton onPress={() => navigate("/app")}>
                          <Trans>Open Zrzur</Trans>
                        </AuthButton>
                      </Match>

                      <Match when={step().at === "check-email"}>
                        <SheetHead role="status">
                          <h2>
                            <Trans>Check your email</Trans>
                          </h2>
                          <p>
                            <Trans>
                              We've sent a message to that address. Open it to
                              continue.
                            </Trans>
                          </p>
                        </SheetHead>
                        <Quiet
                          type="button"
                          onClick={() => setStep({ at: "form" })}
                        >
                          <Trans>Use another address</Trans>
                        </Quiet>
                      </Match>

                      <Match when={step().at === "refused"}>
                        <SheetHead role="alert">
                          <h2>
                            <Trans>
                              Your account is ready, but you couldn't join
                            </Trans>
                          </h2>
                          <p>
                            <TranslatedError
                              error={(step() as { error: unknown }).error}
                            />
                          </p>
                        </SheetHead>
                        <AuthButton onPress={() => navigate("/app")}>
                          <Trans>Open Zrzur</Trans>
                        </AuthButton>
                      </Match>

                      <Match when={step().at === "server"}>
                        <SheetHead data-desktop-only>
                          <h2>
                            <Show
                              when={!data().custom_link}
                              fallback={data().server_name}
                            >
                              <Trans>{data().user_name} invited you</Trans>
                            </Show>
                          </h2>
                          <p>
                            <Trans>Members: {members()}</Trans>
                          </p>
                        </SheetHead>
                        <Show when={joinError()}>
                          <ErrorLine role="alert">
                            <TranslatedError error={joinError()} />
                          </ErrorLine>
                        </Show>
                        <AuthButton
                          status={busy() ? "submitting" : "ready"}
                          onPress={onJoin}
                        >
                          <Switch
                            fallback={<Trans>Join {data().server_name}</Trans>}
                          >
                            <Match when={member()}>
                              <Trans>Open {data().server_name}</Trans>
                            </Match>
                            <Match when={asksFirst()}>
                              <Trans>Ask to join</Trans>
                            </Match>
                          </Switch>
                        </AuthButton>
                        <Show when={!signedIn()}>
                          <Note data-desktop-only>
                            <Trans>
                              Already on Zrzur?{" "}
                              <A
                                href="/login/auth"
                                onClick={() => rememberInvite(code())}
                              >
                                Log in
                              </A>
                            </Trans>
                          </Note>
                        </Show>
                      </Match>
                    </Switch>
                  </Side>
                </Columns>
                <Show when={step().at !== "server"}>
                  <Scrim aria-hidden="true" />
                </Show>
              </Card>
            )}
          </Match>
        </Switch>
      </Stage>
    </Page>
  );
}

const PHONE = "@media (max-width: 600px)";

const Page = styled("main", {
  base: {
    display: "flex",
    flexDirection: "column",
    // the window's height, scrolling inside: the app's root does not
    // scroll, so a page taller than the window could not be read to the end
    height: "100dvh",
    minHeight: 0,
    width: "100%",
    overflowY: "auto",
    overscrollBehavior: "contain",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-frame)",
    [PHONE]: { background: "var(--z-bg-nav)" },
  },
});

const Top = styled("header", {
  base: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "64px",
    paddingInline: "32px",
    [PHONE]: { height: "56px", paddingInline: "16px" },
  },
});

const Brand = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    textDecoration: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const TopLink = styled(A, {
  base: {
    display: "flex",
    alignItems: "center",
    minHeight: "44px",
    paddingInline: "8px",
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    textDecoration: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    _hover: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Stage = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 32px 48px",
    [PHONE]: { alignItems: "stretch", padding: 0 },
  },
});

const Card = styled("article", {
  base: {
    position: "relative",
    width: "100%",
    maxWidth: "960px",
    overflow: "hidden",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    borderRadius: "var(--z-box-radius)",
    [PHONE]: {
      display: "flex",
      flexDirection: "column",
      border: 0,
      borderRadius: 0,
      // room for the button fixed to the foot of the screen
      paddingBlockEnd: "96px",
    },
  },
});

const Banner = styled("div", {
  base: {
    height: "180px",
    background: "var(--z-bg-raised)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    [PHONE]: { height: "132px", flex: "none" },
  },
});

const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "32px",
    padding: "0 32px 32px",
    [PHONE]: { display: "block", padding: "0 16px" },
  },
});

const Info = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
    paddingBlockStart: "16px",
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBlockStart: "-60px",
    "& h1": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      color: "var(--z-header-primary)",
      overflowWrap: "anywhere",
    },
    [PHONE]: {
      marginBlockStart: "-52px",
      "& h1": { fontSize: "22px", lineHeight: "30px" },
    },
  },
});

const IconFrame = styled("div", {
  base: {
    alignSelf: "flex-start",
    padding: "4px",
    background: "var(--z-bg-nav)",
    borderRadius: "var(--z-radius-lg, 14px)",
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px 16px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    "& span": { display: "inline-flex", alignItems: "center", gap: "6px" },
  },
});

const Description = styled("div", {
  base: {
    margin: 0,
    fontSize: "15px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
    "& p": { margin: 0 },
    // a long description never pushes the button away
    lineClamp: 5,
  },
});

const Label = styled("div", {
  base: { fontSize: "13px", fontWeight: 500, color: "var(--z-fg-muted)" },
});

const Inside = styled("ul", {
  base: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    border: "1px solid var(--z-border-soft)",
    borderRadius: "var(--z-radius-md, 10px)",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minHeight: "48px",
      padding: "8px 16px",
      color: "var(--z-fg-muted)",
    },
    "& li + li": { borderBlockStart: "1px solid var(--z-border-soft)" },
    "& b": {
      fontWeight: 500,
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& div": { display: "flex", flexDirection: "column", minWidth: 0 },
    "& div b": { whiteSpace: "normal" },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    "& small[data-end]": { marginInlineStart: "auto", whiteSpace: "nowrap" },
  },
});

const Side = styled("div", {
  base: {
    alignSelf: "start",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBlockStart: "24px",
    padding: "24px",
    background: "var(--z-box-bg)",
    borderRadius: "var(--z-box-radius)",
    [PHONE]: {
      position: "fixed",
      zIndex: 3,
      insetInline: 0,
      insetBlockEnd: 0,
      margin: 0,
      padding: "12px 16px calc(20px + var(--z-safe-bottom, 0px))",
      borderRadius: 0,
      background: "var(--z-bg-nav)",
      borderBlockStart: "1px solid var(--z-border-soft)",
      "& [data-desktop-only]": { display: "none" },
      // every step but the first is a sheet over the page
      "&:not([data-step=server])": {
        maxHeight: "calc(100dvh - 56px)",
        overflowY: "auto",
        padding: "24px 16px calc(20px + var(--z-safe-bottom, 0px))",
        background: "var(--z-bg-chat)",
        border: "1px solid var(--z-border-soft)",
        borderBlockEnd: 0,
        borderRadius: "var(--z-radius-lg, 14px) var(--z-radius-lg, 14px) 0 0",
      },
    },
    border: "var(--z-box-border)",
  },
});

const Scrim = styled("div", {
  base: {
    display: "none",
    [PHONE]: {
      display: "block",
      position: "fixed",
      zIndex: 2,
      inset: 0,
      background: "rgb(0 0 0 / 0.55)",
    },
  },
});

const SheetHead = styled("div", {
  base: {
    "& h2": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
      color: "var(--z-header-primary)",
      overflowWrap: "anywhere",
    },
    "& p": { margin: 0, fontSize: "13px", color: "var(--z-fg-secondary)" },
  },
});

const Legal = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "18px",
    textAlign: "center",
    color: "var(--z-fg-muted)",
    "& a": { color: "var(--z-accent-text)", textDecoration: "none" },
    "& a:hover": { textDecoration: "underline" },
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    textAlign: "center",
    color: "var(--z-fg-muted)",
    "& a": {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "24px",
      color: "var(--z-accent-text)",
      textDecoration: "none",
    },
  },
});

const Quiet = styled("button", {
  base: {
    alignSelf: "center",
    minHeight: "44px",
    paddingInline: "16px",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--z-accent-text)",
    background: "transparent",
    border: 0,
    borderRadius: "var(--z-radius-md, 10px)",
    cursor: "pointer",
    _hover: { background: "var(--z-hover)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const ErrorLine = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger)" },
});

const Notice = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    maxWidth: "520px",
    padding: "48px 32px",
    textAlign: "center",
    color: "var(--z-fg-muted)",
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    borderRadius: "var(--z-box-radius)",
    "& h1": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
      color: "var(--z-header-primary)",
    },
    "& p": { margin: 0, maxWidth: "320px", color: "var(--z-fg-secondary)" },
    [PHONE]: {
      justifyContent: "center",
      maxWidth: "none",
      padding: "24px 16px",
      border: 0,
      borderRadius: 0,
    },
  },
});

const Actions = styled("div", {
  base: { width: "100%", maxWidth: "320px", marginBlockStart: "12px" },
});

const Skeleton = styled("div", {
  base: {
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-raised)",
  },
});
