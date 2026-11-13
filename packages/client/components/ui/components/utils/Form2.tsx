import { type IFormControl, IFormGroup } from "solid-forms";
import {
  type JSX,
  ComponentProps,
  For,
  Match,
  ParentProps,
  Show,
  Switch,
  splitProps,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { VirtualContainer } from "@minht11/solid-virtual-container";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import {
  Button,
  Checkbox,
  FloatingSelect,
  Radio2,
  Text,
  TextField,
  typography,
} from "../design";
import { TextEditor2 } from "../features/texteditor/LazyTextEditor2";
import { Column, Row } from "../layout";

import { translatedError, useError } from "@revolt/i18n";
import { FileInput, humanFileSize } from "./files";

/**
 * Form wrapper for TextField
 */
const FormTextField = (
  props: {
    control: IFormControl<string>;
  } & ComponentProps<typeof TextField>,
) => {
  const [local, remote] = splitProps(props, ["control"]);

  return (
    <>
      <TextField
        {...remote}
        value={local.control.value}
        oninput={(e) => {
          if (!e.currentTarget.checkValidity()) {
            // Rely on native constraint validation
            local.control.setErrors({ invalid: true });
          } else {
            local.control.setErrors(null);
          }
          local.control.setValue(e.currentTarget.value);
          local.control.markDirty(true);
        }}
        required={local.control.isRequired}
        disabled={local.control.isDisabled}
      />
    </>
  );
};

/**
 * Form wrapper for TextEditor
 *
 * You must manage the lifecycle of the `initialValue`
 */
const FormTextEditor = (
  props: {
    control: IFormControl<string>;
  } & Omit<ComponentProps<typeof TextEditor2>, "onChange">,
) => {
  const [local, remote] = splitProps(props, ["control"]);

  return (
    <EditorBox>
      <TextEditor2
        {...remote}
        onChange={(value) => {
          local.control.setValue(value);
          local.control.markDirty(value !== remote.initialValue?.[0]);
        }}
        // todo: required={local.control.isRequired}
        // todo: disabled={local.control.isDisabled}
      />

      <Show when={local.control.isTouched && !local.control.isValid}>
        <For each={Object.keys(local.control.errors!)}>
          {(errorMsg: string) => <small>{errorMsg}</small>}
        </For>
      </Show>
    </EditorBox>
  );
};

/**
 * Same surface as TextField: recessed input, hairline border, accent focus
 */
const EditorBox = styled("div", {
  base: {
    minHeight: "96px",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-border-strong)",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "14px",
    lineHeight: "20px",
    cursor: "text",
    transition: "border-color 0.12s ease, box-shadow 0.12s ease",

    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-muted) 45%, transparent)",
    },
    "&:focus-within": {
      borderColor: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
  },
});

/**
 * Form wrapper for FloatingSelect
 *
 * Note: If control is 'required', an '*' will only appear if the control has a label.
 * Required will still be enforced, this is just visual.
 */
export function FormSelect(
  props: { control: IFormControl<string>; label?: string } & Omit<
    ComponentProps<typeof FloatingSelect>,
    "value" | "label" | "required" | "disabled" | "onChange"
  >,
) {
  const [local, others] = splitProps(props, ["control", "children"]);

  return (
    <>
      <FloatingSelect
        {...others}
        value={local.control.value}
        // FloatingSelect types `required` as `false` only
        required={local.control.isRequired as false}
        disabled={local.control.isDisabled}
        onChange={(e) => {
          local.control.setValue(e.currentTarget.value || "");
          local.control.markDirty(true);
        }}
      >
        {local.children}
      </FloatingSelect>

      <Show when={local.control.isTouched && !local.control.isValid}>
        <For each={Object.keys(local.control.errors!)}>
          {(errorMsg: string) => <small>{errorMsg}</small>}
        </For>
      </Show>
    </>
  );
}

/**
 * Form wrapper for, single file, FileInput
 */
const FormFileInput = (
  props: {
    label?: string;
    control: IFormControl<File[] | string | null>;
    maxSize?: number;
    hideErrors?: boolean;
    /** The caller explains the size limit itself */
    hideMaxSize?: boolean;
    /** Accessible name for the picker (defaults to `label`) */
    pickerLabel?: string;
  } & Pick<
    ComponentProps<typeof FileInput>,
    | "accept"
    | "imageAspect"
    | "imageRounded"
    | "imageJustify"
    | "imageHeight"
    | "allowRemoval"
    | "removeLabel"
    | "process"
  >,
) => {
  const [local, remote] = splitProps(props, [
    "label",
    "control",
    "maxSize",
    "hideErrors",
    "hideMaxSize",
    "pickerLabel",
  ]);

  const err = useError();
  const { t } = useLingui();

  return (
    <>
      <Show when={local.label && !local.pickerLabel && !local.hideMaxSize}>
        <Text class="label">{local.label}</Text>
      </Show>
      <FileInput
        {...remote}
        label={local.pickerLabel ?? local.label}
        file={local.control.value}
        maxSize={local.maxSize}
        onFiles={(files) => {
          if (
            files &&
            files.length > 0 &&
            local.maxSize &&
            files[0].size > local.maxSize
          ) {
            local.control.setErrors({
              error: translatedError(
                t`File must be smaller than ${humanFileSize(local.maxSize)}`,
              ),
            });
            local.control.markTouched(true);
            return;
          }

          local.control.setErrors(null);
          local.control.setValue(files);
          local.control.markDirty(true);
        }}
        required={local.control.isRequired}
        disabled={local.control.isDisabled}
      />
      <Show when={local.maxSize && !local.hideMaxSize}>
        <span class={typography({ class: "label", size: "small" })}>
          (max. {humanFileSize(local.maxSize!)})
        </span>
      </Show>
      <Show
        when={
          !local.hideErrors && local.control.isTouched && !local.control.isValid
        }
      >
        <Column gap="sm">
          <For each={Object.keys(local.control.errors!)}>
            {(errorMsg: string) => (
              <span
                class={css(typography.raw({ class: "label", size: "small" }), {
                  color: "var(--md-sys-color-error)",
                })}
              >
                {err(local.control.errors![errorMsg])}
              </span>
            )}
          </For>
        </Column>
      </Show>
    </>
  );
};

/**
 * Form wrapper for Checkbox
 */
const FormCheckbox = (
  props: {
    control: IFormControl<boolean>;
  } & ComponentProps<typeof Checkbox>,
) => {
  const [local, remote] = splitProps(props, ["control"]);

  return (
    <>
      <Checkbox
        {...remote}
        checked={local.control.value}
        onChange={(event) => {
          local.control.setValue(event.currentTarget.checked);
          local.control.markDirty(true);
        }}
        required={local.control.isRequired}
        disabled={local.control.isDisabled}
      />

      <Show when={local.control.isTouched && !local.control.isValid}>
        <For each={Object.keys(local.control.errors!)}>
          {(errorMsg: string) => <small>{errorMsg}</small>}
        </For>
      </Show>
    </>
  );
};

/**
 * Form wrapper for Radio2
 */
const FormRadio = (
  props: {
    control: IFormControl<string>;
  } & ComponentProps<typeof Radio2>,
) => {
  const [local, remote] = splitProps(props, ["control"]);

  return (
    <>
      <Radio2
        {...remote}
        value={local.control.value}
        onChange={(event) => {
          local.control.setValue(event.currentTarget.value);
          local.control.markDirty(true);
        }}
        required={local.control.isRequired}
        disabled={local.control.isDisabled}
      />

      <Show when={local.control.isTouched && !local.control.isValid}>
        <For each={Object.keys(local.control.errors!)}>
          {(errorMsg: string) => <small>{errorMsg}</small>}
        </For>
      </Show>
    </>
  );
};

/**
 * Form element wrapper for button groups
 */
const FormButtonGroup = (props: {
  control: IFormControl<string>;
  buttonDefinitions: (Omit<
    ParentProps<ComponentProps<typeof Button>>,
    "group" | "groupActive" | "onPress"
  > & { value: string })[];
}) => {
  return (
    <>
      <Row gap="xs" justify="stretch">
        <For each={props.buttonDefinitions}>
          {(buttonDef, index) => (
            <Button
              group={
                index() === 0
                  ? "connected-start"
                  : index() === props.buttonDefinitions.length - 1
                    ? "connected-end"
                    : "connected"
              }
              groupActive={props.control.value === buttonDef.value}
              onPress={() => {
                props.control.setValue(buttonDef.value);
                props.control.markDirty(true);
              }}
              {...buttonDef}
            />
          )}
        </For>
      </Row>
      <Show when={props.control.isTouched && !props.control.isValid}>
        <For each={Object.keys(props.control.errors!)}>
          {(errorMsg: string) => <small>{errorMsg}</small>}
        </For>
      </Show>
    </>
  );
};

/**
 * Form element for virtual selection
 */
function FormVirtualSelect<K, T>(props: {
  control: IFormControl<K[]>;
  items: { item: T; value: K }[];
  children: (item: T, selected?: boolean) => JSX.Element;
  itemHeight?: number;
  selectHeight?: string;
  isMaxHeight?: boolean;
  multiple?: boolean;
}) {
  let ref;

  return (
    <div
      ref={ref}
      use:scrollable
      style={
        props.isMaxHeight
          ? {
              "max-height": props.selectHeight ?? "320px",
            }
          : {
              height: props.selectHeight ?? "320px",
            }
      }
    >
      <VirtualContainer
        items={props.items}
        scrollTarget={ref}
        itemSize={{ height: props.itemHeight ?? 40 }}
      >
        {(item) => (
          <div
            role="listitem"
            style={{
              ...item.style,
              width: "100%",
            }}
            onClick={() => {
              if (!props.multiple) {
                props.control.setValue(
                  props.control.value[0] === item.item.value &&
                    !props.control.isRequired
                    ? []
                    : [item.item.value],
                );
              }
            }}
          >
            <Switch
              fallback={props.children(
                item.item.item,
                props.control.value.includes(item.item.value),
              )}
            >
              <Match when={props.multiple}>
                <Checkbox
                  class={css({ width: "100%" })}
                  onChange={(checked) =>
                    props.control.setValue([
                      ...props.control.value.filter(
                        (entry) => entry !== item.item.value,
                      ),
                      ...(checked ? [item.item.value] : []),
                    ])
                  }
                  checked={props.control.value.includes(item.item.value)}
                >
                  {props.children(item.item.item)}
                </Checkbox>
              </Match>
            </Switch>
          </div>
        )}
      </VirtualContainer>
    </div>
  );
}

/**
 * Form reset button
 */
const FormResetButton = (props: {
  group: IFormGroup;
  onReset: () => void;
  children?: JSX.Element;
}) => {
  return (
    <Button
      variant="text"
      onPress={() => {
        resetGeneric(props.group, true);
        props.onReset();
      }}
      isDisabled={!props.group.isDirty}
    >
      {props.children ?? <Trans>Reset</Trans>}
    </Button>
  );
};

/**
 * Form submission button
 */
const FormSubmitButton = (props: {
  group: IFormGroup;
  children: JSX.Element;
  requireDirty?: boolean;
}) => {
  return (
    <Button
      type="submit"
      isDisabled={
        !canSubmit(props.group) || (!props.group.isDirty && props.requireDirty)
      }
    >
      {props.children}
    </Button>
  );
};

/**
 * Compute whether we can submit this group
 * @param group Group
 * @returns Whether we can submit
 */
function canSubmit(group: IFormGroup) {
  if (group.isDisabled || group.isPending || !group.isValid) return false;

  for (const control in group.controls) {
    const element = group.controls[control];
    if (element.isRequired) {
      const value = element.value;

      if (Array.isArray(value) && value.length === 0) {
        return false;
      } else if (!value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generic 'reset' of form group
 * @param group Form Group
 * @param includingFields Whether to also reset fields
 */
function resetGeneric(group: IFormGroup, includingFields: boolean) {
  if (includingFields) {
    for (const control of Object.values(group.controls)) {
      control.markDirty(false);
      control.markTouched(false);
    }
  }

  group.markPending(false);
  group.markSubmitted(true);
}

/**
 * Create a new submission handler
 * @param group Form Group
 * @param handler Handler for submission
 * @param onReset Handler to reset form state
 * @returns Function for onSubmit handler of form
 */
function useSubmitHandler(
  group: IFormGroup,
  handler: () => Promise<void> | void,
  onReset?: () => void,
) {
  return async (e: Event) => {
    e.preventDefault();

    for (const control of Object.values(group.controls)) {
      control.markTouched(true);
    }

    if (!canSubmit(group)) return false;

    group.markPending(true);

    try {
      await handler();
      resetGeneric(group, true);
      onReset?.();
      return true;
    } catch (err) {
      group.setErrors({
        error: err,
      });

      resetGeneric(group, false);
      return false;
    } finally {
      group.markPending(false);
    }
  };
}

/**
 * Form props for dialogs that submit through their footer button:
 * Enter in any single-line field runs `handler` (dialog footers sit outside
 * the <form>, so there is no submit button for implicit submission) and the
 * native submit is suppressed. Values are left untouched on failure.
 * @param handler Submit handler
 * @returns Props to spread on <form>
 */
function enterSubmits(handler: () => unknown) {
  return {
    onSubmit: (e: Event) => {
      e.preventDefault();
      handler();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        !e.isComposing &&
        e.target instanceof HTMLInputElement
      ) {
        e.preventDefault();
        handler();
      }
    },
  };
}

export const Form2 = {
  TextField: FormTextField,
  TextEditor: FormTextEditor,
  Select: FormSelect,
  FileInput: FormFileInput,
  Checkbox: FormCheckbox,
  Radio: FormRadio,
  ButtonGroup: FormButtonGroup,
  VirtualSelect: FormVirtualSelect,
  Reset: FormResetButton,
  Submit: FormSubmitButton,
  canSubmit,
  reset: (group: IFormGroup, onReset?: () => void) => {
    resetGeneric(group, true);
    onReset?.();
  },
  useSubmitHandler,
  enterSubmits,
};
