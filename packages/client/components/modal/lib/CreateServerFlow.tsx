import { Trans, useLingui } from "@lingui/solid/macro";
import { useDevice } from "@revolt/common";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { useNavigate } from "@revolt/routing";
import {
  type DialogProps,
  Button,
  Column,
  Dialog,
  Form2,
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
  createEffect,
  createSignal,
  createUniqueId,
  on,
  onCleanup,
} from "solid-js";
import { styled } from "styled-system/jsx";
import { useModals } from "..";
import {
  Failure,
  IconPicker,
  PlusBadge,
  Progress,
  Row,
  Rows,
  Rules,
  SectionTitle,
} from "./ServerFlowParts";
import { createServerImport } from "./ServerImportFlow";
import { importAvailability } from "./serverImport";
import { useLocalisedTemplate, useTemplateTitles } from "./serverTemplateText";
import {
  type ServerAnswer,
  type ServerTemplateId,
  TemplateTimeout,
  createServerFromTemplate,
  landedServer,
  openingChannel,
  pickableServerTemplates,
  tailorServerTemplate,
} from "./serverTemplates";

const NAME_LIMIT = 32;
const SERVER_RULES = "https://zrzur.com/legal/server-owner-rules";

/** Cut to at most `limit` units without splitting a character */
function clip(text: string, limit: number) {
  let out = "";
  for (const character of text) {
    if (out.length + character.length > limit) break;
    out += character;
  }
  return out;
}

type Step = "start" | "audience" | "yours" | "copy";
type DialogAction = NonNullable<
  ComponentProps<typeof Dialog>["actions"]
>[number];

/**
 * Create a server in three steps, all in one dialog: pick a start, say who it
 * is for, make it yours. One dialog means Back keeps what was typed, and the
 * dialog takes care of Escape and the focus trap.
 */
export function CreateServerFlow(props: DialogProps & { client: Client }) {
  const { t } = useLingui();
  const device = useDevice();
  const navigate = useNavigate();
  const instance = useInstance();
  const modals = useModals();
  const { openModal } = modals;
  const titles = useTemplateTitles();
  const localise = useLocalisedTemplate();
  const rulesLabel = createUniqueId();

  const [step, setStep] = createSignal<Step>("start");
  const [picked, setPicked] = createSignal<ServerTemplateId>();
  const [answer, setAnswer] = createSignal<ServerAnswer>();
  const [agreed, setAgreed] = createSignal(false);

  const ownName = (name: string) => t`${name}'s server`;
  const defaultName = () =>
    ownName(
      clip(
        props.client.user?.displayName ?? "",
        NAME_LIMIT - ownName("").length,
      ).trim(),
    ).trim();
  const group = createFormGroup({
    name: createFormControl(defaultName(), { required: true }),
    icon: createFormControl<File[] | string | null>(null),
  });
  const typedName = () => group.controls.name.value.trim();

  const template = () =>
    localise(tailorServerTemplate(picked() ?? "custom", answer() ?? "skip"));

  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const cancellation = new AbortController();
  onCleanup(() => cancellation.abort());

  // Every way out (Escape, the X, a swipe, the backdrop) comes through here.
  // The create can't be left while it runs; it has a timeout, so it always ends.
  // eslint-disable-next-line solid/reactivity
  const modalId = props.modalId;
  if (modalId) onCleanup(modals.guardClose(modalId, () => working()));

  // "Copy a server setup": its own steps inside this dialog
  const copying = createServerImport({
    // eslint-disable-next-line solid/reactivity
    client: props.client,
    onLeave: () => setStep("start"),
    onOpen: (serverId, channelId) => {
      navigate(
        channelId
          ? `/server/${serverId}/channel/${channelId}`
          : `/server/${serverId}`,
      );
      props.onClose();
    },
  });
  const working = () => busy() || copying.busy();

  let body: HTMLDivElement | undefined;
  // the choice a person came from when going back, else the first thing to use
  const focusTarget = (current: Step) => {
    if (current === "yours")
      return body?.querySelector<HTMLElement>("input[name=name]");
    if (current === "copy")
      return body?.querySelector<HTMLElement>("input[name=template-link]");
    const choice = current === "start" ? picked() : answer();
    return (
      body?.querySelector<HTMLElement>(`[data-flow-choice="${choice}"]`) ??
      body?.querySelector<HTMLElement>("[data-flow-row]")
    );
  };
  createEffect(
    on(
      step,
      (current) => {
        const target = focusTarget(current);
        target?.focus();
        if (target instanceof HTMLInputElement) target.select();
      },
      { defer: true },
    ),
  );

  function finish(server: Server) {
    const room = openingChannel(template(), server);
    navigate(
      room ? `/server/${server.id}/channel/${room}` : `/server/${server.id}`,
    );
    props.onClose();
  }

  const canCreate = () => !busy() && !!typedName() && agreed();

  /** The servers known before a create that timed out; it may land later */
  let timedOut: ReadonlySet<string> | undefined;

  async function create() {
    const name = typedName();
    if (!canCreate() || name.length > NAME_LIMIT) return;
    const late = timedOut && landedServer(props.client, timedOut);
    if (late) return finish(late);
    const known = timedOut ?? new Set(props.client.servers.keys());
    const plan = template();
    const icon = group.controls.icon.value;
    setBusy(true);
    setError(undefined);
    group.controls.icon.markDisabled(true);
    try {
      const server = await createServerFromTemplate(props.client, name, plan, {
        signal: cancellation.signal,
        access: plan.access ?? "Open",
        icon: Array.isArray(icon)
          ? {
              upload: () =>
                props.client.uploadFile("icons", icon[0], instance.mediaUrl),
            }
          : undefined,
      });
      setBusy(false);
      finish(server);
    } catch (failure) {
      if (failure instanceof TemplateTimeout) timedOut = known;
      if (!cancellation.signal.aborted) setError(failure);
    } finally {
      if (!cancellation.signal.aborted) {
        setBusy(false);
        group.controls.icon.markDisabled(false);
      }
    }
  }

  const backTo = (target: Step): DialogAction => ({
    variant: "text",
    text: <Trans>Back</Trans>,
    isDisabled: busy(),
    onClick: () => {
      setStep(target);
      return false;
    },
  });
  const actions = (): DialogAction[] | undefined => {
    if (step() === "start") return undefined;
    if (step() === "copy") return copying.actions();
    if (step() === "audience") return [backTo("start")];
    const main: DialogAction = {
      text: busy() ? t`Setting up…` : t`Create`,
      isDisabled: !canCreate(),
      onClick: () => {
        void create();
        return false;
      },
    };
    return [backTo("audience"), main];
  };

  const title = (): JSX.Element =>
    step() === "start" ? (
      <Trans>Make your server</Trans>
    ) : step() === "copy" ? (
      copying.title()
    ) : step() === "audience" ? (
      <Trans>Who will gather here?</Trans>
    ) : (
      <Trans>Make it yours</Trans>
    );

  function pick(id: ServerTemplateId) {
    setPicked(id);
    setStep("audience");
  }
  function reply(value: ServerAnswer) {
    setAnswer(value);
    setStep("yours");
  }

  return (
    <Dialog
      tone="create"
      iconName="plus-circle"
      appearance="creation"
      show={props.show}
      onClose={props.onClose}
      showClose={!working()}
      persistent={step() === "yours" || step() === "copy"}
      size={step() === "copy" ? "md" : "sm"}
      phonePage
      isDisabled={working()}
      title={title()}
      description={
        step() === "start" ? (
          <Trans>
            Your server is where you and your friends hang out. Start from
            scratch or pick a ready-made one.
          </Trans>
        ) : step() === "copy" ? (
          copying.description()
        ) : undefined
      }
      actions={actions()}
    >
      <FlowBody ref={body}>
        <Switch>
          <Match when={step() === "start"}>
            <Row
              art="scratch"
              choice="custom"
              label={titles().custom}
              onPick={() => pick("custom")}
            />
            <SectionTitle>
              <Trans>Or start ready-made</Trans>
            </SectionTitle>
            <Rows>
              <For each={pickableServerTemplates()}>
                {(entry) => (
                  <Row
                    art={entry.id === "gaming" ? "gaming" : "friends"}
                    choice={entry.id}
                    label={titles()[entry.id]}
                    onPick={() => pick(entry.id)}
                  />
                )}
              </For>
            </Rows>
            <Show when={importAvailability(props.client).open}>
              <SectionTitle>
                <Trans>Already have a community somewhere else?</Trans>
              </SectionTitle>
              <Row
                art="community"
                choice="copy"
                label={t`Copy a server setup`}
                onPick={() => {
                  setPicked(undefined);
                  setStep("copy");
                }}
              />
            </Show>
            <Join>
              <span>
                <Trans>Got an invite?</Trans>
              </span>
              <Button
                // phones: the page ends with it, so it is the full-strength button
                variant={device.layout() === "phone" ? "filled" : "tonal"}
                size="md"
                shape="square"
                onPress={() => {
                  openModal({ type: "join_server", client: props.client });
                  props.onClose();
                }}
              >
                <Trans>Join with an invite</Trans>
              </Button>
            </Join>
          </Match>

          <Match when={step() === "copy"}>
            <copying.Body />
          </Match>

          <Match when={step() === "audience"}>
            <Rows>
              <Row
                art="community"
                choice="community"
                label={t`A wider community`}
                onPick={() => reply("community")}
              />
              <Row
                art="people"
                choice="friends"
                label={t`Just friends`}
                onPick={() => reply("friends")}
              />
            </Rows>
            <Skip
              type="button"
              data-flow-choice="skip"
              onClick={() => reply("skip")}
            >
              <Trans>Decide later</Trans>
            </Skip>
          </Match>

          <Match when={step() === "yours"}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create();
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
                {/* the whole row is the target; the link stays its own */}
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
                <Show when={busy()}>
                  <Progress role="status" aria-live="polite">
                    {t`Setting up your server…`}
                  </Progress>
                </Show>
                <Show when={error()}>
                  <Failure role="alert">
                    <Show
                      when={error() instanceof TemplateTimeout}
                      fallback={<TranslatedError error={error()} />}
                    >
                      <Trans>Zrzur did not answer in time.</Trans>
                    </Show>
                  </Failure>
                </Show>
              </Column>
            </form>
          </Match>
        </Switch>
      </FlowBody>
    </Dialog>
  );
}

/** Phones: a column as tall as the page, so the invite block ends it */
const FlowBody = styled("div", {
  base: {
    _phone: { display: "flex", flexDirection: "column", minHeight: "100%" },
  },
});
const Join = styled("div", {
  base: {
    // phones: on the bottom edge of the page
    _phone: { marginBlockStart: "auto", fontSize: "15px", fontWeight: 600 },
    marginBlockStart: "16px",
    paddingBlockStart: "16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    textAlign: "center",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& > button": { width: "100%" },
  },
});
const Skip = styled("button", {
  base: {
    display: "block",
    marginBlockStart: "12px",
    marginInline: "auto",
    minHeight: "24px",
    padding: "4px 8px",
    border: 0,
    borderRadius: "6px",
    background: "transparent",
    color: "var(--z-link)",
    fontFamily: "inherit",
    fontSize: "13px",
    lineHeight: "20px",
    cursor: "pointer",
    _hover: { textDecoration: "underline" },
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    _phone: { minHeight: "44px" },
  },
});
