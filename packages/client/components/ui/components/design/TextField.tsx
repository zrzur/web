import { useLingui } from "@lingui/solid/macro";
import {
  type JSX,
  Show,
  createSignal,
  createUniqueId,
  mergeProps,
  splitProps,
} from "solid-js";

import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

type Props = JSX.HTMLAttributes<HTMLInputElement> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  autoFocus?: boolean;
  required?: boolean;
  name?: string;
  label?: string;
  autosize?: boolean;
  disabled?: boolean;
  rows?: number;
  "min-rows"?: number;
  "max-rows"?: number;
  maxlength?: number;
  minlength?: number;
  counter?: boolean;
  placeholder?: string;
  type?:
    | "text"
    | "number"
    | "password"
    | "url"
    | "email"
    | "search"
    | "tel"
    | "hidden"
    | "date"
    | "datetime-local"
    | "month"
    | "time"
    | "week";
  variant?: "filled" | "outlined";
  enterkeyhint?:
    | "enter"
    | "done"
    | "go"
    | "next"
    | "previous"
    | "search"
    | "find";
  helper?: string;
  /** Inline validation message; marks the field invalid */
  error?: string | false;
  "helper-on-focus"?: boolean;
  clearable?: boolean;
  "clear-icon"?: string;
  "end-aligned"?: boolean;
  prefix?: string;
  suffix?: string;
  icon?: string;
  "end-icon"?: string;
  "error-icon"?: string;
  form?: string;
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  "toggle-password"?: boolean;
  showPasswordIcon?: string;
  hidePasswordIcon?: string;
  autocapitalize?: "none" | "sentences" | "words" | "characters";
  autocorrect?: string;
  autocomplete?: string;
  spellcheck?: boolean;
  inputmode?:
    | "none"
    | "text"
    | "decimal"
    | "numeric"
    | "tel"
    | "search"
    | "email"
    | "url";
  autofocus?: boolean;
  tabindex?: number;
};

/**
 * Zrzur text field — native control, desktop-first, no Material visuals.
 */
export function TextField(rawProps: Props) {
  const { t } = useLingui();
  const generatedId = createUniqueId();
  const fieldId = () => rawProps.id ?? generatedId;
  const props = mergeProps({ variant: "outlined" as const }, rawProps);
  const [local, rest] = splitProps(props, [
    "label",
    "helper",
    "error",
    "helper-on-focus",
    "toggle-password",
    "autosize",
    "rows",
    "min-rows",
    "max-rows",
    "variant",
    "class",
    "type",
    "clearable",
    "clear-icon",
    "end-aligned",
    "prefix",
    "suffix",
    "icon",
    "end-icon",
    "error-icon",
    "showPasswordIcon",
    "hidePasswordIcon",
    "counter",
    "children",
  ]);

  const [showPassword, setShowPassword] = createSignal(false);
  const inputType = () =>
    local["toggle-password"]
      ? showPassword()
        ? "text"
        : "password"
      : (local.type ?? "text");

  const isMultiline = () => !!local.autosize || (local.rows ?? 0) > 1;

  const describedBy = () =>
    local.error
      ? `${generatedId}-error`
      : local.helper
        ? `${generatedId}-helper`
        : rest["aria-describedby"];

  const length = () => String(rest.value ?? "").length;

  return (
    <Field class={`z-text-field ${local.class ?? ""}`}>
      <Show when={local.label || (local.counter && rest.maxlength)}>
        <LabelRow>
          <Label for={fieldId()}>{local.label}</Label>
          <Show when={local.counter && rest.maxlength}>
            <Counter
              aria-hidden="true"
              data-near={length() >= (rest.maxlength ?? Infinity) * 0.9}
            >
              {length()}/{rest.maxlength}
            </Counter>
          </Show>
        </LabelRow>
      </Show>
      <ControlWrap data-invalid={!!local.error} data-disabled={!!rest.disabled}>
        <Show when={local.prefix}>
          <Affix>{local.prefix}</Affix>
        </Show>
        <Show
          when={isMultiline()}
          fallback={
            <Input
              {...(rest as JSX.InputHTMLAttributes<HTMLInputElement>)}
              id={fieldId()}
              aria-invalid={local.error ? true : undefined}
              aria-describedby={describedBy()}
              type={inputType()}
              // @codegen directives props=props include=autoComplete
            />
          }
        >
          <TextArea
            {...(rest as unknown as JSX.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            id={fieldId()}
            aria-invalid={local.error ? true : undefined}
            aria-describedby={describedBy()}
            rows={local.rows ?? local["min-rows"] ?? 3}
          />
        </Show>
        <Show when={local["toggle-password"]}>
          <IconBtn
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword() ? t`Hide password` : t`Show password`}
            aria-pressed={showPassword()}
            title={showPassword() ? t`Hide password` : t`Show password`}
          >
            <Icon name={showPassword() ? "eye-slash" : "eye"} size={18} />
          </IconBtn>
        </Show>
        <Show when={local.suffix}>
          <Affix>{local.suffix}</Affix>
        </Show>
      </ControlWrap>
      <Show
        when={local.error}
        fallback={
          <Show when={local.helper}>
            <Helper id={`${generatedId}-helper`}>{local.helper}</Helper>
          </Show>
        }
      >
        <ErrorText id={`${generatedId}-error`} role="alert">
          <Icon name="warning-circle" size={14} />
          {local.error}
        </ErrorText>
      </Show>
    </Field>
  );
}

const Field = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    // the label lights up with the field it belongs to
    "&:focus-within label": { color: "var(--z-fg-primary)" },
  },
});

const LabelRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const Label = styled("label", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    transition: "color var(--z-motion-fast, 120ms) ease",
  },
});

const Counter = styled("span", {
  base: {
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    // "10/32" keeps its order in right-to-left text
    direction: "ltr",
    unicodeBidi: "isolate",
    color: "var(--z-fg-muted)",
    transition: "color var(--z-motion-fast, 120ms) ease",
    // nearly full: amber, so the limit never comes as a surprise
    "&[data-near='true']": { color: "var(--z-status-warning)" },
  },
});

/**
 * Field surface, made like the buttons: a recessed well (slightly darker
 * at the top, a soft inner shadow, a hairline border and a faint light
 * edge below). On focus the border takes the accent, a soft ring and glow
 * open around it and the leading mark (# or icon) lights up.
 */
const ControlWrap = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    padding: "0 14px",
    borderRadius: "calc(var(--z-radius, 10px))",
    background: "var(--z-field-bg)",
    // the theme can strengthen the edge (library themes reach 3:1)
    border:
      "1px solid var(--z-field-border, color-mix(in srgb, var(--z-fg-primary) 10%, transparent))",
    boxShadow: "var(--z-field-shadow)",
    transition:
      "border-color var(--z-motion-fast, 120ms) ease, box-shadow var(--z-motion-base, 220ms) var(--z-ease-standard, ease), background-color var(--z-motion-fast, 120ms) ease",
    _motionReduce: { transition: "none" },

    "& > span:first-child": {
      transition: "color var(--z-motion-fast, 120ms) ease",
    },

    _hover: {
      borderColor:
        "var(--z-field-border-hover, color-mix(in srgb, var(--z-fg-primary) 18%, transparent))",
    },

    "&:focus-within": {
      borderColor: "var(--z-accent)",
      // the shared field focus: a crisp ring, no coloured glow
      boxShadow: "var(--z-field-focus-shadow)",
    },
    "&:focus-within > span:first-child": { color: "var(--z-accent)" },

    "&[data-invalid='true']": {
      borderColor: "var(--z-danger)",
    },
    "&[data-invalid='true']:focus-within": {
      borderColor: "var(--z-danger)",
      boxShadow:
        "inset 0 1px 2px rgb(0 0 0 / 0.22), 0 0 0 3px color-mix(in srgb, var(--z-danger) 22%, transparent)",
    },
    "&[data-disabled='true']": {
      opacity: 0.55,
      boxShadow: "none",
    },
  },
});
const inputBase = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
  fontFamily: "inherit",
  fontSize: "15px",
  lineHeight: "20px",
  paddingBlock: "11px",
  // phones: 16 px, so iOS doesn't zoom into the field (phone rules)
  _phone: { fontSize: "16px" },
  caretColor: "var(--z-accent)",
  "&::placeholder": {
    color: "var(--z-fg-muted, #968DA6)",
  },
  "&:disabled": {
    opacity: 0.5,
    cursor: "not-allowed",
  },
} as const;

const Input = styled("input", { base: inputBase });
const TextArea = styled("textarea", {
  base: {
    ...inputBase,
    resize: "vertical",
    minHeight: "72px",
  },
});

const Affix = styled("span", {
  base: {
    color: "var(--z-fg-muted)",
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },
});

const IconBtn = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    marginInlineEnd: "-6px",
    // phones: a 44 px target without making the field taller
    _phone: {
      width: "44px",
      height: "44px",
      marginBlock: "-8px",
      marginInlineEnd: "-12px",
    },
    background: "transparent",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    flexShrink: 0,
    _hover: {
      color: "var(--z-fg-primary)",
    },
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
});

const Helper = styled("div", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const ErrorText = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    "--z-icon-color": "currentColor",
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    color: "var(--z-danger)",
  },
});
