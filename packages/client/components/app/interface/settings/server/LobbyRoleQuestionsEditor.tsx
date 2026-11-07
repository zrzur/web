import { useLingui } from "@lingui/solid/macro";
import { useUser } from "@revolt/client";
import { FloatingSelect, MenuItem, TextField } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { For, Index, Show } from "solid-js";
import type { LobbyRoleQuestion, Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";
import { ulid } from "ulid";

/** Only ordinary member permissions may be offered through public role choices. */
const PUBLIC_ROLE_BITS = [
  10, 12, 20, 21, 22, 25, 26, 27, 29, 30, 31, 32, 36, 41,
].reduce((mask, bit) => mask | (1n << BigInt(bit)), 0n);

/** Question builder stores stable IDs so reordering cannot change an answer's meaning. */
export function LobbyRoleQuestionsEditor(props: {
  server: Server;
  questions: LobbyRoleQuestion[];
  onChange: (value: LobbyRoleQuestion[]) => void;
  /** While saving is blocked: mark the fields that block it */
  showErrors?: boolean;
}) {
  const { t } = useLingui();
  const user = useUser();
  const missing = (value: string) => props.showErrors && !value.trim();
  const editable = () => props.server.havePermission("AssignRoles");
  const eligible = () =>
    props.server.orderedRoles.filter((role) => {
      const rank = Math.min(
        ...(props.server.member?.roles ?? []).map(
          (id) => props.server.roles.get(id)?.rank ?? Infinity,
        ),
      );
      return (
        !role.isManaged &&
        (role.permissions.a & ~PUBLIC_ROLE_BITS) === 0n &&
        (props.server.ownerId === user()?.id || role.rank > rank)
      );
    });
  /** Choices for one answer's role picker, a missing role kept visible */
  const roleItems = (current: string) => [
    { id: "", name: t`Choose a role`, colour: undefined, disabled: false },
    ...(current && !eligible().some((r) => r.id === current)
      ? [
          {
            id: current,
            name: t`Role unavailable`,
            colour: undefined,
            disabled: true,
          },
        ]
      : []),
    ...eligible().map((role) => ({
      id: role.id,
      name: role.name,
      colour: role.colour ?? "var(--z-fg-muted)",
      disabled: false,
    })),
  ];
  const update = (index: number, patch: Partial<LobbyRoleQuestion>) =>
    props.onChange(
      props.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  const option = (
    q: number,
    o: number,
    patch: Partial<LobbyRoleQuestion["options"][number]>,
  ) =>
    update(q, {
      options: props.questions[q].options.map((item, i) =>
        i === o ? { ...item, ...patch } : item,
      ),
    });
  const reorder = <T,>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };
  const move = (from: number, to: number) =>
    props.onChange(reorder(props.questions, from, to));
  const moveOption = (q: number, from: number, to: number) =>
    update(q, { options: reorder(props.questions[q].options, from, to) });
  return (
    <Builder>
      <Note>
        <Icon name="info" size={16} />
        <span>{t`Only ordinary member roles can be offered: no managed roles and none with moderation or admin permissions.`}</span>
      </Note>
      <Show when={!editable()}>
        <Note role="status" data-warn>
          <Icon name="warning" size={16} />
          <span>{t`You need Assign Roles permission to change these questions.`}</span>
        </Note>
      </Show>
      <fieldset disabled={!editable()}>
        {/* <Index>: rows stay while their text changes (with <For> a new
            question object on every key press rebuilt the row, and the
            field lost its focus after one character) */}
        <Index each={props.questions}>
          {(question, qi) => (
            <Question>
              <QuestionHead>
                <strong>{t`Question ${qi + 1}`}</strong>
                <Tools>
                  <button
                    type="button"
                    aria-label={t`Move up`}
                    title={t`Move up`}
                    disabled={qi === 0}
                    onClick={() => move(qi, qi - 1)}
                  >
                    <Icon name="caret-up" size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label={t`Move down`}
                    title={t`Move down`}
                    disabled={qi === props.questions.length - 1}
                    onClick={() => move(qi, qi + 1)}
                  >
                    <Icon name="caret-down" size={18} />
                  </button>
                  <button
                    type="button"
                    data-danger
                    aria-label={t`Remove question`}
                    title={t`Remove question`}
                    onClick={() =>
                      props.onChange(props.questions.filter((_, i) => i !== qi))
                    }
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </Tools>
              </QuestionHead>
              <TextField
                label={t`Question`}
                maxlength={150}
                value={question().question}
                error={missing(question().question) && t`Write the question.`}
                placeholder={t`What brings you here?`}
                onInput={(e) => update(qi, { question: e.currentTarget.value })}
              />
              <TextField
                label={t`Description`}
                maxlength={500}
                value={question().description ?? ""}
                placeholder={t`Optional: one line under the question.`}
                onInput={(e) =>
                  update(qi, {
                    description: e.currentTarget.value || undefined,
                  })
                }
              />
              <Answers>
                <AnswersHead>
                  <Label>{t`Answers`}</Label>
                  <Label>{t`Role it gives`}</Label>
                </AnswersHead>
                <Index each={question().options}>
                  {(choice, oi) => (
                    <Choice>
                      <TextField
                        aria-label={t`Answer ${oi + 1}`}
                        maxlength={80}
                        value={choice().label}
                        error={
                          (missing(choice().label) && t`Write the answer.`) ||
                          (props.showErrors &&
                            !props.server.roles.has(choice().role) &&
                            t`Choose the role this answer gives.`)
                        }
                        placeholder={t`Gaming`}
                        onInput={(e) =>
                          option(qi, oi, { label: e.currentTarget.value })
                        }
                      />
                      <FloatingSelect
                        aria-label={t`Role for answer ${oi + 1}`}
                        value={choice().role}
                        onChange={(e) =>
                          option(qi, oi, { role: e.currentTarget.value })
                        }
                      >
                        {/* FloatingSelect reads its children as elements:
                            one flat list, no <Show> placeholders inside */}
                        <For each={roleItems(choice().role)}>
                          {(item) => (
                            <MenuItem value={item.id} disabled={item.disabled}>
                              <RoleDot
                                style={{
                                  background: item.colour,
                                  visibility: item.colour
                                    ? "visible"
                                    : "hidden",
                                }}
                              />
                              {item.name}
                            </MenuItem>
                          )}
                        </For>
                      </FloatingSelect>
                      <Tools>
                        <button
                          type="button"
                          aria-label={t`Move answer ${oi + 1} up`}
                          title={t`Move up`}
                          disabled={oi === 0}
                          onClick={() => moveOption(qi, oi, oi - 1)}
                        >
                          <Icon name="caret-up" size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label={t`Move answer ${oi + 1} down`}
                          title={t`Move down`}
                          disabled={oi === question().options.length - 1}
                          onClick={() => moveOption(qi, oi, oi + 1)}
                        >
                          <Icon name="caret-down" size={18} />
                        </button>
                        <button
                          type="button"
                          data-danger
                          aria-label={t`Remove answer`}
                          title={t`Remove answer`}
                          disabled={question().options.length === 1}
                          onClick={() =>
                            update(qi, {
                              options: question().options.filter(
                                (_, i) => i !== oi,
                              ),
                            })
                          }
                        >
                          <Icon name="x" size={18} />
                        </button>
                      </Tools>
                    </Choice>
                  )}
                </Index>
                <Show when={question().options.length < 8}>
                  <AddAnswer
                    type="button"
                    onClick={() =>
                      update(qi, {
                        options: [
                          ...question().options,
                          { id: ulid(), label: "", role: "" },
                        ],
                      })
                    }
                  >
                    <Icon name="plus" size={16} />
                    {t`Add an answer`}
                  </AddAnswer>
                </Show>
              </Answers>
            </Question>
          )}
        </Index>
        <Show when={props.questions.length < 5}>
          <AddQuestion
            type="button"
            onClick={() =>
              props.onChange([
                ...props.questions,
                {
                  id: ulid(),
                  question: "",
                  options: [{ id: ulid(), label: "", role: "" }],
                },
              ])
            }
          >
            <Icon name="plus-circle" size={20} />
            <span>
              <strong>{t`Add a role question`}</strong>
              <small>{t`Up to five questions with up to eight answers each.`}</small>
            </span>
          </AddQuestion>
        </Show>
      </fieldset>
    </Builder>
  );
}

const Builder = styled("div", {
  base: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& fieldset": {
      border: 0,
      padding: 0,
      margin: 0,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    },
    "& fieldset:disabled": { opacity: 0.65 },
  },
});

const Note = styled("p", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-fg-muted)",
    "& > :first-child": { flexShrink: 0, marginBlockStart: "2px" },
    "&[data-warn]": {
      color: "var(--z-warning, #F3B96B)",
      "--z-icon-color": "var(--z-warning, #F3B96B)",
    },
  },
});

/** One step above the card it sits on, never darker */
const Question = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    background: "color-mix(in srgb, var(--z-fg-primary) 3%, transparent)",
  },
});

const QuestionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    "& strong": {
      fontSize: "14px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
  },
});

const Answers = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const AnswersHead = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 116px",
    gap: "12px",
    _phone: { display: "none" },
  },
});

/** Same label style as TextField's */
const Label = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
  },
});

const Choice = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 116px",
    gap: "12px",
    alignItems: "center",
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      "& > :nth-child(2)": { gridRow: 2, gridColumn: "1 / -1" },
      paddingBlockEnd: "8px",
      borderBlockEnd: "1px solid var(--z-border-subtle)",
    },
  },
});

const RoleDot = styled("span", {
  base: {
    display: "inline-block",
    width: "10px",
    height: "10px",
    marginInlineEnd: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    verticalAlign: "middle",
  },
});

const Tools = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    "& button": {
      width: "36px",
      height: "36px",
      display: "grid",
      placeItems: "center",
      padding: 0,
      background: "none",
      border: "none",
      borderRadius: "8px",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "currentColor",
      cursor: "pointer",
      _hover: {
        background: "var(--z-nav-hover)",
        color: "var(--z-fg-primary)",
      },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _disabled: {
        opacity: 0.35,
        cursor: "default",
        _hover: { background: "none", color: "var(--z-fg-muted)" },
      },
      "&[data-danger]:hover:not(:disabled)": { color: "var(--z-danger)" },
      _phone: { width: "44px", height: "44px" },
    },
  },
});

const AddAnswer = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    paddingInline: "8px 12px",
    border: "none",
    borderRadius: "8px",
    background: "none",
    color: "var(--z-accent-text, var(--z-accent))",
    "--z-icon-color": "currentColor",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    _hover: {
      background: "color-mix(in srgb, var(--z-accent) 10%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

/** Empty slot for a new question (dashed, like other "add" slots) */
const AddQuestion = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    minHeight: "64px",
    border:
      "1px dashed color-mix(in srgb, var(--z-fg-primary) 22%, transparent)",
    borderRadius: "12px",
    background: "none",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-accent)",
    fontFamily: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition: "background 0.12s ease, border-color 0.12s ease",
    "& span": { display: "flex", flexDirection: "column", gap: "2px" },
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    _hover: {
      background: "color-mix(in srgb, var(--z-accent) 6%, transparent)",
      borderColor: "color-mix(in srgb, var(--z-accent) 45%, transparent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _motionReduce: { transition: "none" },
  },
});
