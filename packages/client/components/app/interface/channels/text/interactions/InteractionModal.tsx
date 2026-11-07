import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { Markdown } from "@revolt/markdown";
import { Checkbox, Dialog, TextField } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { SelectMenu, isSelect } from "./MessageComponents";
import { InteractionError } from "./api";
import { closeModal, interactionState, submitModal } from "./store";
import type {
  Component,
  ComponentBlock,
  Modal,
  ModalFieldValue,
} from "./types";

/** Anything that can be a form field (every kind but a button) */
type FieldComponent = Exclude<Component, { type: "Button" }>;

/** What a form shows: a paragraph, or a field with its label */
type Item =
  | { kind: "text"; content: string }
  | {
      kind: "field";
      label: string;
      description?: string;
      component: FieldComponent;
    };

type Value = string | string[] | boolean;

/** Fields this client can show in a form */
const FIELDS = new Set([
  "TextInput",
  "StringSelect",
  "UserSelect",
  "RoleSelect",
  "MentionableSelect",
  "ChannelSelect",
  "RadioGroup",
  "CheckboxGroup",
  "Checkbox",
  "FileUpload",
]);

/** Text and labelled fields, from both the current and the older row layout */
function formItems(blocks: ComponentBlock[]): Item[] {
  const items: Item[] = [];
  for (const block of blocks ?? []) {
    if (block?.type === "Text") {
      items.push({ kind: "text", content: block.content });
    } else if (block?.type === "Field" && FIELDS.has(block.component?.type)) {
      items.push({
        kind: "field",
        label: block.label,
        description: block.description,
        component: block.component as FieldComponent,
      });
    } else if (block?.type === "ActionRow") {
      const component = block.components?.[0];
      if (!component || !FIELDS.has(component.type)) continue;
      const label =
        (component.type === "TextInput" && component.label) ||
        ("placeholder" in component && component.placeholder) ||
        component.custom_id;
      items.push({
        kind: "field",
        label: label as string,
        component: component as FieldComponent,
      });
    }
  }
  return items;
}

function initialValue(component: FieldComponent): Value {
  switch (component.type) {
    case "TextInput":
      return component.value ?? "";
    case "RadioGroup":
      return component.options.find((o) => o.default)?.value ?? "";
    case "Checkbox":
      return !!component.default;
    case "StringSelect":
    case "CheckboxGroup":
      return component.options.filter((o) => o.default).map((o) => o.value);
    case "UserSelect":
    case "RoleSelect":
    case "MentionableSelect":
    case "ChannelSelect":
      return component.default_values ?? [];
    default:
      return [];
  }
}

/** `image` → `image/*`; extensions stay as they are */
function acceptOf(types?: string[]) {
  if (!types?.length) return undefined;
  return types.map((t) => (t.startsWith(".") ? t : `${t}/*`)).join(",");
}

/**
 * Form a bot opened for this user. Answers go to that bot only and are
 * never logged here.
 */
export function InteractionModal() {
  const current = () => interactionState.modal;
  return (
    <Show when={current()} keyed>
      {(modal) => <ModalForm {...modal} />}
    </Show>
  );
}

function ModalForm(props: {
  id: string;
  channelId: string;
  modal: Modal;
  applicationId?: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const [error, setError] = createSignal<string>();
  const [sending, setSending] = createSignal(false);
  const [uploading, setUploading] = createSignal(0);

  const items = createMemo(() => formItems(props.modal.components));
  const fields = createMemo(() =>
    items().flatMap((item) => (item.kind === "field" ? [item] : [])),
  );

  const serverId = () => client().channels.get(props.channelId)?.serverId;

  const [values, setValues] = createSignal<Record<string, Value>>(
    Object.fromEntries(
      fields().map((field) => [
        field.component.custom_id,
        initialValue(field.component),
      ]),
    ),
  );
  /** Uploaded files per field, by name for display */
  const [files, setFiles] = createSignal<
    Record<string, { id: string; name: string }[]>
  >({});

  const set = (id: string, value: Value) => {
    setValues({ ...values(), [id]: value });
    setError(undefined);
  };

  async function upload(
    field: Extract<Component, { type: "FileUpload" }>,
    list: FileList | null,
  ) {
    if (!list?.length) return;
    const max = field.max_values ?? 1;
    const current = files()[field.custom_id] ?? [];
    const chosen = [...list].slice(0, Math.max(0, max - current.length));
    if (!chosen.length) {
      setError(t`This field takes at most ${max} files.`);
      return;
    }
    setUploading((n) => n + 1);
    try {
      const added = [];
      for (const file of chosen) {
        const id = await client().uploadFile(
          "attachments",
          file,
          instance.mediaUrl,
        );
        added.push({ id, name: file.name });
      }
      setFiles({ ...files(), [field.custom_id]: [...current, ...added] });
      setError(undefined);
    } catch {
      setError(t`The file could not be uploaded. It may be too large.`);
    } finally {
      setUploading((n) => n - 1);
    }
  }

  function removeFile(customId: string, id: string) {
    setFiles({
      ...files(),
      [customId]: (files()[customId] ?? []).filter((f) => f.id !== id),
    });
  }

  function invalidField(): string | undefined {
    for (const { label, component } of fields()) {
      const value = values()[component.custom_id];
      switch (component.type) {
        case "TextInput": {
          const text = (value as string) ?? "";
          if (!text.trim()) {
            if (component.required ?? true) return t`Fill in "${label}".`;
            continue;
          }
          if (component.min_length && text.length < component.min_length) {
            return t`"${label}" needs at least ${component.min_length} characters.`;
          }
          break;
        }
        case "RadioGroup":
          if ((component.required ?? true) && !value)
            return t`Choose an option for "${label}".`;
          break;
        case "CheckboxGroup": {
          const min =
            component.min_values ?? ((component.required ?? true) ? 1 : 0);
          if ((value as string[]).length < min)
            return t`Choose at least ${min} for "${label}".`;
          break;
        }
        case "FileUpload": {
          const min =
            component.min_values ?? ((component.required ?? true) ? 1 : 0);
          if ((files()[component.custom_id] ?? []).length < min)
            return t`Add a file to "${label}".`;
          break;
        }
        case "Checkbox":
          break;
        default:
          if (
            isSelect(component) &&
            (value as string[]).length < (component.min_values ?? 1)
          )
            return t`Choose an option for "${label}".`;
      }
    }
    return undefined;
  }

  // Rejects to keep the dialog open (the Dialog closes when the promise resolves)
  async function submit() {
    if (sending() || uploading()) throw new Error("busy");
    const problem = invalidField();
    if (problem) {
      setError(problem);
      throw new Error(problem);
    }
    setSending(true);
    const payload: ModalFieldValue[] = fields().map(({ component }) => {
      const custom_id = component.custom_id;
      const value = values()[custom_id];
      switch (component.type) {
        case "TextInput":
          return { custom_id, value: value as string };
        case "RadioGroup":
          return { custom_id, value: (value as string) || undefined };
        case "Checkbox":
          return { custom_id, checked: value as boolean };
        case "FileUpload":
          return {
            custom_id,
            values: (files()[custom_id] ?? []).map((f) => f.id),
          };
        default:
          return { custom_id, values: value as string[] };
      }
    });
    try {
      await submitModal(
        client(),
        props.id,
        props.channelId,
        props.modal.custom_id,
        payload,
      );
      closeModal();
    } catch (err) {
      setSending(false);
      setError(
        err instanceof InteractionError && err.type === "InteractionExpired"
          ? t`This form has expired.`
          : t`The form could not be sent.`,
      );
      throw err;
    }
  }

  return (
    <Dialog
      show
      size="md"
      persistent
      onClose={closeModal}
      title={props.modal.title}
      error={error()}
      isDisabled={sending()}
      actions={[
        { text: t`Cancel`, variant: "text" },
        {
          text: uploading() ? t`Uploading…` : t`Submit`,
          onClick: submit,
          isLoading: sending(),
          isDisabled: uploading() > 0,
        },
      ]}
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          submit().catch(() => {});
        }}
      >
        <For each={items()}>
          {(item) => (
            <Switch>
              <Match when={item.kind === "text" && item}>
                {(text) => (
                  <FormText>
                    <Markdown content={text().content} />
                  </FormText>
                )}
              </Match>
              <Match when={item.kind === "field" && item}>
                {(field) => (
                  <FieldView
                    label={field().label}
                    description={field().description}
                    component={field().component}
                    value={values()[field().component.custom_id]}
                    onChange={(value) =>
                      set(field().component.custom_id, value)
                    }
                    serverId={serverId()}
                    files={files()[field().component.custom_id] ?? []}
                    onUpload={(list) =>
                      upload(
                        field().component as Extract<
                          Component,
                          { type: "FileUpload" }
                        >,
                        list,
                      )
                    }
                    onRemoveFile={(id) =>
                      removeFile(field().component.custom_id, id)
                    }
                    uploading={uploading() > 0}
                  />
                )}
              </Match>
            </Switch>
          )}
        </For>
        <button type="submit" hidden />
      </Form>
    </Dialog>
  );
}

function FieldView(props: {
  label: string;
  description?: string;
  component: FieldComponent;
  value: Value;
  onChange: (value: Value) => void;
  serverId?: string;
  files: { id: string; name: string }[];
  onUpload: (list: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  uploading: boolean;
}) {
  const { t } = useLingui();
  const required = () => {
    const c = props.component;
    if (c.type === "Checkbox") return false;
    if ("required" in c && c.required === false) return false;
    if (isSelect(c)) return (c.min_values ?? 1) > 0;
    return true;
  };
  const id = `form-${props.component.custom_id}`;
  const describedBy = () => (props.description ? `${id}-help` : undefined);

  // a yes / no field is the app's own switch, with its label beside it
  const single = () => (
    <Choice data-single>
      <ChoiceText>
        <strong>{props.label}</strong>
        <Show when={props.description}>
          <small id={`${id}-help`}>{props.description}</small>
        </Show>
      </ChoiceText>
      <Checkbox
        checked={props.value as boolean}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
    </Choice>
  );

  return (
    <Show when={props.component.type !== "Checkbox"} fallback={single()}>
      <FieldRoot
        role={
          props.component.type === "RadioGroup"
            ? "radiogroup"
            : props.component.type === "CheckboxGroup"
              ? "group"
              : undefined
        }
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy()}
      >
        <FieldLabel id={`${id}-label`} for={id}>
          {props.label}
          <Show when={required()}>
            <Required aria-hidden="true"> *</Required>
          </Show>
        </FieldLabel>
        <Show when={props.description}>
          <Help id={`${id}-help`}>{props.description}</Help>
        </Show>
        <Switch>
          <Match when={props.component.type === "TextInput" && props.component}>
            {(input) => (
              <TextField
                id={id}
                required={input().required ?? true}
                placeholder={input().placeholder}
                minlength={input().min_length}
                maxlength={input().max_length ?? 4000}
                rows={input().style === "Paragraph" ? 3 : undefined}
                autosize={input().style === "Paragraph"}
                value={props.value as string}
                onInput={(e) => props.onChange(e.currentTarget.value)}
              />
            )}
          </Match>
          <Match when={isSelect(props.component) && props.component}>
            {(select) => (
              <SelectMenu
                component={
                  select() as Parameters<typeof SelectMenu>[0]["component"]
                }
                serverId={props.serverId}
                onChange={(values) => props.onChange(values)}
              />
            )}
          </Match>
          <Match
            when={props.component.type === "RadioGroup" && props.component}
          >
            {(group) => (
              <Choices>
                <For each={group().options}>
                  {(option) => (
                    <Choice>
                      <input
                        type="radio"
                        name={id}
                        value={option.value}
                        checked={props.value === option.value}
                        onChange={() => props.onChange(option.value)}
                      />
                      <Mark data-shape="radio" aria-hidden="true" />
                      <ChoiceText>
                        <span>{option.label}</span>
                        <Show when={option.description}>
                          <small>{option.description}</small>
                        </Show>
                      </ChoiceText>
                    </Choice>
                  )}
                </For>
              </Choices>
            )}
          </Match>
          <Match
            when={props.component.type === "CheckboxGroup" && props.component}
          >
            {(group) => {
              const chosen = () => props.value as string[];
              const max = () => group().max_values ?? group().options.length;
              return (
                <Choices>
                  <For each={group().options}>
                    {(option) => (
                      <Choice>
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={chosen().includes(option.value)}
                          disabled={
                            !chosen().includes(option.value) &&
                            chosen().length >= max()
                          }
                          onChange={(e) =>
                            props.onChange(
                              e.currentTarget.checked
                                ? [...chosen(), option.value]
                                : chosen().filter((v) => v !== option.value),
                            )
                          }
                        />
                        <Mark aria-hidden="true">
                          <Icon name="check" size={12} />
                        </Mark>
                        <ChoiceText>
                          <span>{option.label}</span>
                          <Show when={option.description}>
                            <small>{option.description}</small>
                          </Show>
                        </ChoiceText>
                      </Choice>
                    )}
                  </For>
                </Choices>
              );
            }}
          </Match>
          <Match
            when={props.component.type === "FileUpload" && props.component}
          >
            {(field) => (
              <Uploads>
                <For each={props.files}>
                  {(file) => (
                    <UploadedFile>
                      <Icon name="file" size={16} />
                      <span>{file.name}</span>
                      <button
                        type="button"
                        aria-label={t`Remove ${file.name}`}
                        onClick={() => props.onRemoveFile(file.id)}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </UploadedFile>
                  )}
                </For>
                <Show when={props.files.length < (field().max_values ?? 1)}>
                  <DropZone data-busy={props.uploading ? "" : undefined}>
                    <input
                      id={id}
                      type="file"
                      multiple={(field().max_values ?? 1) > 1}
                      accept={acceptOf(field().file_types)}
                      disabled={props.uploading}
                      onChange={(e) => {
                        props.onUpload(e.currentTarget.files);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Icon name="upload-simple" size={18} />
                    <span>
                      {props.uploading ? t`Uploading…` : t`Choose a file`}
                    </span>
                  </DropZone>
                </Show>
              </Uploads>
            )}
          </Match>
        </Switch>
      </FieldRoot>
    </Show>
  );
}

const Form = styled("form", {
  base: { display: "flex", flexDirection: "column", gap: "16px" },
});

const FormText = styled("div", {
  base: { fontSize: "14px", color: "var(--z-fg-secondary)" },
});

const FieldRoot = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const FieldLabel = styled("label", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
  },
});

const Help = styled("p", {
  base: {
    margin: 0,
    marginBlockStart: "-2px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const Required = styled("span", { base: { color: "var(--z-danger)" } });

const Choices = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingBlock: "2px",
  },
});

/** One option, laid out like the app's own radio rows */
const Choice = styled("label", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
    // the native control stays for keyboards and screen readers only
    "& > input": {
      position: "absolute",
      opacity: 0,
      width: "1px",
      height: "1px",
      margin: 0,
      pointerEvents: "none",
    },
    "&:has(> input:focus-visible) > span:first-of-type": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    "&:has(> input:disabled)": { opacity: 0.45, cursor: "not-allowed" },
    // yes / no: label first, the app's switch at the far end
    "&[data-single]": {
      alignItems: "center",
      justifyContent: "space-between",
    },
  },
});

/** The settings radio ring, or a box of the same size for checkboxes */
const Mark = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "16px",
    height: "16px",
    marginBlockStart: "1px",
    borderRadius: "4px",
    border:
      "1.5px solid color-mix(in srgb, var(--z-fg-muted) 70%, transparent)",
    color: "transparent",
    "--z-icon-color": "currentColor",
    transition: "background-color 0.12s ease, border-color 0.12s ease",
    "input:checked + &": {
      borderColor: "var(--z-accent)",
      background: "var(--z-accent)",
      color: "var(--z-on-accent, #fff)",
    },
    "&[data-shape=radio]": {
      borderRadius: "50%",
      "input:checked + &": {
        background:
          "radial-gradient(circle at center, var(--z-accent) 0 40%, transparent 42%)",
      },
    },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

const ChoiceText = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    "& strong": { fontWeight: 600 },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const Uploads = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const UploadedFile = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "var(--z-bg-input)",
    fontSize: "14px",
    "& > span": {
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& > button": {
      display: "grid",
      placeItems: "center",
      width: "28px",
      height: "28px",
      borderRadius: "6px",
      border: "none",
      background: "none",
      color: "var(--z-fg-muted)",
      cursor: "pointer",
      _hover: {
        background: "var(--z-nav-hover)",
        color: "var(--z-fg-primary)",
      },
    },
  },
});

/** The whole box is the file picker's button */
const DropZone = styled("label", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "44px",
    borderRadius: "8px",
    border: "1px dashed var(--z-border-strong, var(--z-border-subtle))",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    _hover: { background: "var(--z-nav-hover)" },
    "&:focus-within": { outline: "2px solid var(--z-focus)" },
    "&[data-busy]": { opacity: 0.6, cursor: "progress" },
    "& > input": {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "inherit",
    },
  },
});
