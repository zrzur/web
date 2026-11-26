import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Button, Checkbox, Dialog, FloatingSelect, MenuItem } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";

import { useDate } from "../profile/CommunityParts";

import { CodeBox, ErrorText, Field, Hint, RowActions } from "./parts";
import { ProgramChecklist } from "./ProgramChecklist";
import {
  BadgeApplication,
  CREATOR_CATEGORIES,
  CREATOR_PLATFORMS,
  CreatorCategory,
  CreatorChannel,
  CreatorPlatform,
  PROGRAM_BADGE,
  ProgramId,
  failureCode,
  programsApi,
} from "./programsApi";
import { useProgramText } from "./useProgramText";

/**
 * Apply for a badge program from its badge: pick your server or bot, read
 * the checklist the server measured (in your language), write what it is,
 * prove control of the domain (Verified Server) and send it. A draft can be
 * picked up again from "Your applications".
 *
 * Content Creator is about you: name one channel or profile on another
 * platform, its kind of content and recent works, put the code you get in
 * its description or a pinned post, and send. A person on the team opens
 * the channel, looks for the code and checks the numbers and the quality;
 * Zrzur never connects to the platform.
 */
export function ProgramDialog(props: {
  program: ProgramId;
  /** continue this application (a draft, or one the team asked more of) */
  application?: BadgeApplication;
  /** the server or bot it is about, when the dialog is opened from its own
   * settings (Verified Server: server settings); no picker is shown then */
  target?: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const words = useProgramText();
  const date = useDate();

  const [application, setApplication] = createSignal(props.application);
  const [target, setTarget] = createSignal(
    props.application?.target_id ?? props.target ?? "",
  );
  const [exception, setException] = createSignal(
    props.application?.exception ?? false,
  );
  const [statement, setStatement] = createSignal(
    props.application?.statement ?? "",
  );
  const [links, setLinks] = createSignal(
    (props.application?.links ?? []).join("\n"),
  );
  const [authorized, setAuthorized] = createSignal(
    props.application?.authorized ?? false,
  );
  const [method, setMethod] = createSignal<"dns" | "website">("dns");
  // Content Creator: the channel
  const creator = () => props.program === "content_creator";
  const channel = props.application?.creator;
  const [platform, setPlatform] = createSignal<CreatorPlatform | "">(
    channel?.platform ?? "",
  );
  const [platformName, setPlatformName] = createSignal(
    channel?.platform_name ?? "",
  );
  const [channelUrl, setChannelUrl] = createSignal(channel?.url ?? "");
  const [category, setCategory] = createSignal<CreatorCategory | "">(
    channel?.category ?? "",
  );
  const [works, setWorks] = createSignal((channel?.works ?? []).join("\n"));
  const [schedule, setSchedule] = createSignal(channel?.schedule ?? "");
  const [domain, setDomain] = createSignal(
    props.application?.ownership?.domain ?? "",
  );
  const [code, setCode] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [sent, setSent] = createSignal(false);

  const kind = () => (props.program === "verified_bot" ? "bot" : "server");
  // Content Creator is about you: no server or bot to choose
  if (creator() && !target()) setTarget("@me");
  const [targets] = createResource(
    () => !creator() && !props.target,
    () =>
      programsApi
        .targets(client())
        .then((list) => list.filter((entry) => entry.kind === kind())),
  );
  // one server or bot: chosen for you
  createEffect(
    on(targets, (list) => {
      if (!target() && list?.length === 1) setTarget(list[0].id);
    }),
  );

  const [checklist, { refetch }] = createResource(
    () => (target() ? { target: target(), exception: exception() } : false),
    ({ target, exception }) =>
      programsApi.eligibility(client(), props.program, target, exception),
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(words.failure(failureCode(failure)) ?? describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const lines = (text: string) =>
    text
      .split(/\s+/)
      .map((link) => link.trim())
      .filter(Boolean);

  const channelFields = (): CreatorChannel | undefined =>
    creator() && platform() && category()
      ? {
          platform: platform() as CreatorPlatform,
          platform_name:
            platform() === "other" ? platformName().trim() : undefined,
          url: channelUrl().trim(),
          category: category() as CreatorCategory,
          works: lines(works()),
          schedule: schedule().trim() || undefined,
        }
      : undefined;

  const fields = () => ({
    statement: statement(),
    links: lines(links()),
    authorized: authorized(),
    ...(channelFields() ? { creator: channelFields() } : {}),
  });

  /** Content Creator: enough to send (the server checks it again) */
  const channelReady = () =>
    !creator() ||
    (!!channelFields() &&
      channelUrl().trim().length > 0 &&
      (lines(works()).length >= 5 || schedule().trim().length > 0) &&
      !!application()?.ownership);

  /** The draft, made or brought up to date with the form */
  async function draft() {
    const current = application();
    const next = current
      ? await programsApi.edit(client(), current._id, fields())
      : await programsApi.create(client(), {
          program: props.program,
          target_id: target(),
          exception: exception(),
          ...fields(),
        });
    setApplication(next);
    return next;
  }

  const editable = () =>
    !application() ||
    application()!.status === "Draft" ||
    application()!.status === "MoreInfo";
  const ownershipNeeded = () => props.program === "verified_server";
  const [profileCode, setProfileCode] = createSignal<string>();
  const proven = () => !!application()?.ownership?.verified_at;

  return (
    <Dialog
      tone="settings"
      show
      onClose={props.onClose}
      title={<Trans>Apply for {words.program(props.program)}</Trans>}
      size="lg"
    >
      <div
        data-program-dialog={props.program}
        style={{ display: "flex", "flex-direction": "column", gap: "16px" }}
      >
        <Hint>
          <BadgeMark id={PROGRAM_BADGE[props.program]} size="md" />
          <span>
            <Trans>
              Meeting the numbers only lets you apply. A person on the Zrzur
              team reviews every application. Zrzur is run by volunteers, so we
              can't promise when.
            </Trans>
          </span>
        </Hint>

        <Show
          when={sent()}
          fallback={
            <>
              <Show when={!creator() && !props.target}>
                <Field>
                  <span>
                    {kind() === "bot" ? (
                      <Trans>Your bot</Trans>
                    ) : (
                      <Trans>Your server</Trans>
                    )}
                  </span>
                  <Switch>
                    <Match when={targets.loading}>
                      <Hint>
                        <Trans>Loading…</Trans>
                      </Hint>
                    </Match>
                    <Match when={!targets()?.length}>
                      <Hint role="status">
                        {kind() === "bot" ? (
                          <Trans>
                            Only the owner of a bot can apply. You don't own a
                            bot yet.
                          </Trans>
                        ) : (
                          <Trans>
                            Only the owner of a server can apply. You don't own
                            a server yet.
                          </Trans>
                        )}
                      </Hint>
                    </Match>
                    <Match when={targets()?.length}>
                      <FloatingSelect
                        value={target()}
                        disabled={!!application()}
                        onChange={(event) =>
                          setTarget(event.currentTarget.value)
                        }
                      >
                        <MenuItem value="">{t`Choose…`}</MenuItem>
                        <For each={targets()}>
                          {(entry) => (
                            <MenuItem value={entry.id}>{entry.name}</MenuItem>
                          )}
                        </For>
                      </FloatingSelect>
                    </Match>
                  </Switch>
                </Field>
              </Show>

              <Show
                when={props.program === "verified_server" && !application()}
              >
                <Checkbox
                  checked={exception()}
                  onChange={(event) =>
                    setException(event.currentTarget.checked)
                  }
                >
                  <Trans>
                    We are an official organisation below the member numbers. A
                    senior team member and a second person decide, with
                    documented proof; being well known is not proof.
                  </Trans>
                </Checkbox>
              </Show>

              <Show when={target() && checklist()}>
                <section aria-labelledby="program-checklist">
                  <h4 id="program-checklist" style={{ margin: "0 0 8px" }}>
                    <Trans>What the server measured</Trans>
                  </h4>
                  <ProgramChecklist
                    program={props.program}
                    eligibility={checklist()!}
                  />
                </section>
              </Show>

              <Show
                when={application() || (checklist()?.can_apply && target())}
              >
                <Show when={creator()}>
                  <section
                    aria-labelledby="program-channel"
                    data-creator-channel
                    style={{
                      display: "flex",
                      "flex-direction": "column",
                      gap: "12px",
                    }}
                  >
                    <h4 id="program-channel" style={{ margin: 0 }}>
                      <Trans>Your channel</Trans>
                    </h4>
                    <Hint>
                      <Trans>
                        One channel or profile on one platform: followers on
                        different platforms are not added together. Any kind of
                        legitimate content counts; a genre is never a reason to
                        refuse.
                      </Trans>
                    </Hint>
                    <div
                      style={{
                        display: "grid",
                        "grid-template-columns":
                          "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                        gap: "12px",
                      }}
                    >
                      <Field>
                        <span>
                          <Trans>Platform</Trans>
                        </span>
                        <FloatingSelect
                          value={platform()}
                          disabled={!editable()}
                          onChange={(event) =>
                            setPlatform(
                              event.currentTarget.value as CreatorPlatform,
                            )
                          }
                        >
                          <MenuItem value="">{t`Choose…`}</MenuItem>
                          <For each={[...CREATOR_PLATFORMS]}>
                            {(id) => (
                              <MenuItem value={id}>
                                {words.platform(id)}
                              </MenuItem>
                            )}
                          </For>
                        </FloatingSelect>
                      </Field>
                      <Show when={platform() === "other"}>
                        <Field>
                          <span>
                            <Trans>Name of the platform</Trans>
                          </span>
                          <input
                            maxLength={40}
                            disabled={!editable()}
                            value={platformName()}
                            onInput={(event) =>
                              setPlatformName(event.currentTarget.value)
                            }
                          />
                        </Field>
                      </Show>
                      <Field>
                        <span>
                          <Trans>Kind of content</Trans>
                        </span>
                        <FloatingSelect
                          value={category()}
                          disabled={!editable()}
                          onChange={(event) =>
                            setCategory(
                              event.currentTarget.value as CreatorCategory,
                            )
                          }
                        >
                          <MenuItem value="">{t`Choose…`}</MenuItem>
                          <For each={[...CREATOR_CATEGORIES]}>
                            {(id) => (
                              <MenuItem value={id}>
                                {words.category(id)}
                              </MenuItem>
                            )}
                          </For>
                        </FloatingSelect>
                      </Field>
                    </div>
                    <Field>
                      <span>
                        <Trans>Address of the channel or profile</Trans>
                      </span>
                      <input
                        dir="ltr"
                        maxLength={300}
                        placeholder="https://"
                        disabled={!editable()}
                        value={channelUrl()}
                        onInput={(event) =>
                          setChannelUrl(event.currentTarget.value)
                        }
                      />
                    </Field>
                    <Field>
                      <span>
                        <Trans>
                          Links to at least 5 original works from the last 90
                          days, one per line
                        </Trans>
                      </span>
                      <textarea
                        dir="ltr"
                        maxLength={3100}
                        disabled={!editable()}
                        value={works()}
                        onInput={(event) => setWorks(event.currentTarget.value)}
                      />
                    </Field>
                    <Field>
                      <span>
                        <Trans>
                          Or, if you stream: your regular livestream schedule
                        </Trans>
                      </span>
                      <textarea
                        maxLength={500}
                        disabled={!editable()}
                        value={schedule()}
                        onInput={(event) =>
                          setSchedule(event.currentTarget.value)
                        }
                      />
                    </Field>
                  </section>
                </Show>

                <Field>
                  <span>
                    {creator() ? (
                      <Trans>What do you make, and for whom?</Trans>
                    ) : (
                      <Trans>
                        What is it, and why does it fit this program?
                      </Trans>
                    )}
                  </span>
                  <textarea
                    maxLength={2000}
                    disabled={!editable()}
                    value={statement()}
                    onInput={(event) => setStatement(event.currentTarget.value)}
                  />
                </Field>
                <Show when={!creator()}>
                  <Field>
                    <span>
                      <Trans>
                        Public links, one per line (website, rules page)
                      </Trans>
                    </span>
                    <textarea
                      dir="ltr"
                      maxLength={1600}
                      disabled={!editable()}
                      value={links()}
                      onInput={(event) => setLinks(event.currentTarget.value)}
                    />
                  </Field>
                </Show>
                <Checkbox
                  checked={authorized()}
                  disabled={!editable()}
                  onChange={(event) =>
                    setAuthorized(event.currentTarget.checked)
                  }
                >
                  {creator() ? (
                    <Trans>
                      This channel is mine and everything I write is true.
                    </Trans>
                  ) : (
                    <Trans>
                      I may represent this and everything I write is true.
                    </Trans>
                  )}
                </Checkbox>
                <Hint>
                  <Trans>
                    Never send identity documents. Only you and the reviewers
                    see what you write here; it is never published, and it is
                    deleted 90 days after the final decision.
                  </Trans>
                </Hint>

                <Show when={creator() && editable()}>
                  <section aria-labelledby="program-code" data-creator-code>
                    <h4 id="program-code" style={{ margin: "0 0 8px" }}>
                      <Trans>Show that the channel is yours</Trans>
                    </h4>
                    <Hint>
                      <Trans>
                        Put the code in your channel's description or a pinned
                        post and leave it there until the team has decided. A
                        person on the team looks for it; Zrzur never connects to
                        the platform or reads your followers itself.
                      </Trans>
                    </Hint>
                    <Show when={profileCode() && application()?.ownership}>
                      <CodeBox>
                        <span>
                          <Trans>Your code:</Trans>
                        </span>
                        <code dir="ltr" data-profile-code>
                          {profileCode()}
                        </code>
                        <small>
                          <Trans>
                            It is shown only now and works until{" "}
                            {date(application()!.ownership!.expires_at)}.
                          </Trans>
                        </small>
                      </CodeBox>
                    </Show>
                    <Show when={!profileCode() && application()?.ownership}>
                      <Hint role="status">
                        <Trans>
                          You have a code. If you lost it, ask for a new one and
                          replace it on the channel.
                        </Trans>
                      </Hint>
                    </Show>
                    <RowActions>
                      <Button
                        size="sm"
                        variant="tonal"
                        isDisabled={
                          busy() || !channelFields() || !channelUrl().trim()
                        }
                        onPress={() =>
                          void run(async () => {
                            const current = await draft();
                            const issued = await programsApi.challenge(
                              client(),
                              current._id,
                              "profile",
                              "",
                            );
                            setApplication(issued.application);
                            setProfileCode(issued.value);
                          })
                        }
                      >
                        {application()?.ownership ? (
                          <Trans>Get a new code</Trans>
                        ) : (
                          <Trans>Get a code</Trans>
                        )}
                      </Button>
                    </RowActions>
                  </section>
                </Show>

                <Show when={ownershipNeeded() && editable()}>
                  <section aria-labelledby="program-ownership">
                    <h4 id="program-ownership" style={{ margin: "0 0 8px" }}>
                      <Trans>Prove you control the official domain</Trans>
                    </h4>
                    <Show
                      when={!proven()}
                      fallback={
                        <Hint role="status">
                          <Trans>
                            Control of {application()!.ownership!.domain} is
                            proven.
                          </Trans>
                        </Hint>
                      }
                    >
                      <div
                        style={{
                          display: "grid",
                          "grid-template-columns":
                            "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                          gap: "12px",
                        }}
                      >
                        <Field>
                          <span>
                            <Trans>How</Trans>
                          </span>
                          <FloatingSelect
                            value={method()}
                            onChange={(event) =>
                              setMethod(
                                event.currentTarget.value as "dns" | "website",
                              )
                            }
                          >
                            <MenuItem value="dns">{t`A DNS TXT record`}</MenuItem>
                            <MenuItem value="website">{t`A file on the website`}</MenuItem>
                          </FloatingSelect>
                        </Field>
                        <Field>
                          <span>
                            <Trans>Domain</Trans>
                          </span>
                          <input
                            dir="ltr"
                            maxLength={253}
                            placeholder="example.com"
                            value={domain()}
                            onInput={(event) =>
                              setDomain(event.currentTarget.value)
                            }
                          />
                        </Field>
                      </div>
                      <Show when={code() && application()?.ownership}>
                        <CodeBox>
                          <span>
                            {application()!.ownership!.method === "dns" ? (
                              <Trans>
                                Add a TXT record named{" "}
                                {application()!.ownership!.record_name} with
                                this value:
                              </Trans>
                            ) : (
                              <Trans>
                                Put this value in a file at{" "}
                                {application()!.ownership!.file_url}:
                              </Trans>
                            )}
                          </span>
                          <code dir="ltr">{code()}</code>
                          <small>
                            <Trans>
                              It is shown only now and works until{" "}
                              {date(application()!.ownership!.expires_at)}.
                            </Trans>
                          </small>
                        </CodeBox>
                      </Show>
                      <RowActions>
                        <Button
                          size="sm"
                          variant="tonal"
                          isDisabled={busy() || !domain().trim() || !target()}
                          onPress={() =>
                            void run(async () => {
                              const current = await draft();
                              const issued = await programsApi.challenge(
                                client(),
                                current._id,
                                method(),
                                domain(),
                              );
                              setApplication(issued.application);
                              setCode(issued.value);
                            })
                          }
                        >
                          <Trans>Get a code</Trans>
                        </Button>
                        <Show when={application()?.ownership}>
                          <Button
                            size="sm"
                            variant="tonal"
                            isDisabled={busy()}
                            onPress={() =>
                              void run(async () => {
                                setApplication(
                                  await programsApi.verifyOwnership(
                                    client(),
                                    application()!._id,
                                  ),
                                );
                              })
                            }
                          >
                            <Trans>Check now</Trans>
                          </Button>
                        </Show>
                      </RowActions>
                    </Show>
                  </section>
                </Show>
              </Show>

              <Show when={error()}>
                <ErrorText role="alert">{error()}</ErrorText>
              </Show>

              <Show
                when={editable() && (application() || checklist()?.can_apply)}
              >
                <RowActions>
                  <Button
                    size="sm"
                    variant="tonal"
                    isDisabled={busy() || !target()}
                    onPress={() => void run(async () => void (await draft()))}
                  >
                    <Trans>Save draft</Trans>
                  </Button>
                  <Button
                    size="sm"
                    isDisabled={
                      busy() ||
                      !target() ||
                      !authorized() ||
                      statement().trim().length < 20 ||
                      (ownershipNeeded() && !proven()) ||
                      !channelReady()
                    }
                    onPress={() =>
                      void run(async () => {
                        const current = await draft();
                        setApplication(
                          await programsApi.submit(client(), current._id),
                        );
                        setSent(true);
                        void refetch();
                      })
                    }
                  >
                    <Trans>Send application</Trans>
                  </Button>
                </RowActions>
              </Show>
            </>
          }
        >
          <Hint role="status" data-program-sent>
            <Trans>
              Sent. A volunteer on the team reviews it when they can; you will
              get a message with the decision and its reasons.
            </Trans>
          </Hint>
          <RowActions>
            <Button size="sm" onPress={props.onClose}>
              <Trans>Done</Trans>
            </Button>
          </RowActions>
        </Show>
      </div>
    </Dialog>
  );
}
