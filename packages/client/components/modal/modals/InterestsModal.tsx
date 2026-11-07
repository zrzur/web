import { For, Show, createSignal, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { isolate } from "@revolt/common/lib/isolate";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { Column, Dialog, DialogProps, Text } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { interestsKey } from "./interestsAsk";

/**
 * Roles by interest: asked when someone first opens a server, and from the
 * server menu any time after. Picking an answer gives its role at once;
 * picking it again takes it back. Skip or Done: not asked again on this device.
 */
export function InterestsModal(
  props: DialogProps & Modals & { type: "interests" },
) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const [answering, setAnswering] = createSignal<string>();
  const [error, setError] = createSignal<string>();

  const questions = () => props.server.lobby?.onboarding ?? [];
  const me = () => props.server.member;

  // whatever closes the window (Skip, Done, Esc, outside), it was answered
  onCleanup(() => {
    try {
      localStorage.setItem(
        interestsKey(props.server.id, client().user!.id),
        "1",
      );
    } catch {
      /* storage blocked: the window may simply ask again next time */
    }
  });

  async function answer(question: string, option: string, chosen: boolean) {
    if (answering()) return;
    setAnswering(option);
    setError(undefined);
    try {
      await (chosen
        ? props.server.removeLobbyAnswer(question, option)
        : props.server.answerLobbyQuestion(question, option));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setAnswering(undefined);
    }
  }

  return (
    <Dialog
      tone="info"
      iconName="shield-check"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Welcome to {isolate(props.server.name)}</Trans>}
      size="md"
      actions={[
        { text: <Trans>Skip</Trans>, variant: "text" },
        { text: <Trans>Done</Trans>, variant: "primary" },
      ]}
    >
      <Column gap="lg">
        <Text>
          <Trans>
            Pick what interests you. You get each role right away and can change
            it any time from the server menu.
          </Trans>
        </Text>
        <For each={questions()}>
          {(question) => (
            <RoleQuestion>
              <h3>{question.question}</h3>
              <Show when={question.description}>
                <small>{question.description}</small>
              </Show>
              <RoleChoices>
                <For each={question.options}>
                  {(option) => {
                    const role = () => props.server.roles.get(option.role);
                    const assigned = () => !!me()?.roles.includes(option.role);
                    return (
                      // an answer whose role was deleted is not offered
                      <Show when={role()}>
                        <RoleChoice
                          type="button"
                          disabled={!!answering()}
                          aria-pressed={assigned()}
                          aria-busy={answering() === option.id}
                          title={
                            assigned()
                              ? t`You have this role. Choose again to remove it.`
                              : t`Get the ${role()!.name} role`
                          }
                          onClick={() =>
                            answer(question.id, option.id, assigned())
                          }
                        >
                          <RoleSwatch
                            style={{
                              background: role()!.colour ?? "var(--z-fg-muted)",
                            }}
                          />
                          <span>
                            <span>{option.label}</span>
                            {/* which role this gives, when the answer says otherwise */}
                            <Show when={role()!.name !== option.label}>
                              <small>{t`Role: ${role()!.name}`}</small>
                            </Show>
                          </span>
                          <RoleState aria-hidden="true">
                            <Show
                              when={answering() !== option.id}
                              fallback={<Icon name="hourglass" size={14} />}
                            >
                              <Icon
                                name={assigned() ? "check" : "plus"}
                                size={14}
                              />
                            </Show>
                          </RoleState>
                        </RoleChoice>
                      </Show>
                    );
                  }}
                </For>
              </RoleChoices>
            </RoleQuestion>
          )}
        </For>
        <Show when={error()}>
          <ErrorLine role="alert">{error()}</ErrorLine>
        </Show>
      </Column>
    </Dialog>
  );
}

/** One question: its title, an optional line, then the answers */
const RoleQuestion = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& h3": {
      margin: 0,
      fontSize: "15px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& > small": { fontSize: "13px", color: "var(--z-fg-secondary)" },
  },
});

/** Answers in an even grid, so labels of any length line up */
const RoleChoices = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
    gap: "8px",
  },
});

/**
 * One answer: [role colour] label .......... (+ / ✓)
 * Chosen = the accent outlines it and fills the circle.
 */
const RoleChoice = styled("button", {
  base: {
    "--role-pick": "var(--z-accent)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    minHeight: "48px",
    paddingInline: "12px",
    textAlign: "start",
    borderRadius: "12px",
    // the same card as the rest of the dialog family
    border: "1px solid var(--z-card-border, var(--z-border-subtle))",
    background: "var(--z-card-bg, var(--z-bg-raised))",
    color: "var(--z-fg-primary)",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition:
      "background 0.12s ease, border-color 0.12s ease, transform 0.12s ease",
    "& > span:nth-child(2)": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      paddingBlock: "8px",
      "& > *": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      "& small": {
        fontSize: "12px",
        fontWeight: 500,
        color: "var(--z-fg-muted)",
      },
    },
    _hover: {
      background: "var(--z-float-hover, var(--z-nav-hover))",
      borderColor: "color-mix(in srgb, var(--role-pick) 40%, transparent)",
    },
    _active: { transform: "scale(0.98)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-pressed=true]": {
      // chosen: the role's colour on the edge, only a hint of it inside
      borderColor: "color-mix(in srgb, var(--role-pick) 75%, transparent)",
      background:
        "color-mix(in srgb, var(--role-pick) 7%, var(--z-card-solid, var(--z-bg-raised)))",
    },
    _disabled: { cursor: "default", transform: "none" },
    "&:disabled:not([aria-pressed=true])": { opacity: 0.6 },
    _motionReduce: { transition: "none", _active: { transform: "none" } },
  },
});

const RoleSwatch = styled("span", {
  base: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    flexShrink: 0,
    boxShadow:
      "0 0 0 3px color-mix(in srgb, var(--z-fg-primary) 6%, transparent)",
  },
});

const RoleState = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    flexShrink: 0,
    border:
      "1.5px solid color-mix(in srgb, var(--z-fg-primary) 28%, transparent)",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    transition: "background 0.12s ease, border-color 0.12s ease",
    "[aria-pressed=true] > &": {
      borderColor: "var(--role-pick)",
      background: "var(--role-pick)",
      color: "var(--z-on-accent, #fff)",
    },
    _motionReduce: { transition: "none" },
  },
});

const ErrorLine = styled("span", {
  base: { fontSize: "13px", color: "var(--z-danger)" },
});
