import type { HCaptchaFunctions } from "solid-hcaptcha";
import {
  createContext,
  createSignal,
  For,
  JSX,
  lazy,
  onCleanup,
  Show,
  useContext,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { BirthMonthField, Checkbox, TextField } from "@revolt/ui";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
import { Icon } from "@revolt/ui/icons/Icon";

import { AuthButton } from "./Flow";

const FormStack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
  },
});

/** The captcha loads only on forms that use it (sign-up, reset, resend) */
const HCaptcha = lazy(() => import("solid-hcaptcha"));

/** Error from the server, shown above the actions and read out at once */
const ErrorContainer = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px",
    color: "var(--z-fg-primary)",
    background: "var(--z-danger-muted)",
    border: "1px solid color-mix(in srgb, var(--z-danger) 40%, transparent)",
    borderRadius: "var(--z-radius, 10px)",
    fontSize: "14px",
    lineHeight: "20px",
    "--z-icon-color": "var(--z-danger)",

    "& > .z-icon": { flexShrink: 0, marginTop: "2px" },
    "& a": { color: "var(--z-link, var(--md-sys-color-primary))" },
  },
});

/**
 * Available field types
 */
type Field =
  | "email"
  | "password"
  | "new-password"
  | "log-out"
  | "username"
  | "invite"
  | "birth-month";

/**
 * Properties to apply to fields
 */
const useFieldConfiguration = () => {
  const { t } = useLingui();

  return {
    email: {
      type: "email" as const,
      name: () => t`Email`,
      placeholder: () => t`Please enter your email.`,
      autocomplete: "email",
      autocapitalize: "none" as const,
      spellcheck: false,
      inputmode: "email" as const,
    },
    // no length rule when logging in: older accounts may have shorter
    // passwords, and the server answers for a wrong one anyway
    password: {
      type: "password" as const,
      "toggle-password": true,
      autocomplete: "current-password",
      name: () => t`Password`,
      placeholder: () => t`Enter your current password.`,
    },
    // same minimum as the server (MIN_PASSWORD_LENGTH)
    "new-password": {
      minLength: 10,
      type: "password" as const,
      autocomplete: "new-password",
      "toggle-password": true,
      name: () => t`New password`,
      placeholder: () => t`Enter a new password.`,
    },
    "log-out": {
      name: () => t`Log out of all other sessions`,
    },
    username: {
      minLength: 2,
      type: "text" as const,
      autocomplete: "off",
      autocapitalize: "none" as const,
      spellcheck: false,
      name: () => t`Username`,
      placeholder: () => t`Enter your preferred username.`,
    },
    invite: {
      minLength: 1,
      type: "text" as const,
      autocomplete: "off",
      name: () => t`Invite code`,
      placeholder: () => t`Enter your invite code.`,
    },
    "birth-month": {
      name: () => t`Month and year of birth`,
      placeholder: () =>
        t`We keep only the month and year. They decide which content you can see.`,
    },
  };
};

interface FieldProps {
  /**
   * Fields to gather
   */
  fields: (Field | FieldPreset)[];
}

interface FieldPreset {
  field: Field;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  disabled?: boolean;
  /**
   * Shown in a small pop-up above the field while it has focus (above, so it
   * doesn't clash with password manager suggestions below the field)
   */
  hint?: JSX.Element;
}

const HintAnchor = styled("div", {
  base: {
    position: "relative",
    width: "100%",
  },
});

const HintCard = styled("div", {
  base: {
    position: "absolute",
    zIndex: 5,
    bottom: "calc(100% + 10px)",
    insetInline: 0,
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px 14px",
    color: "var(--z-fg-primary)",
    background: "var(--z-popover-bg, var(--z-bg-raised))",
    border: "1px solid var(--z-popover-border, var(--z-border-subtle))",
    borderRadius: "var(--z-radius, 10px)",
    boxShadow: "var(--z-popover-lift)",
    fontSize: "0.85rem",
    lineHeight: 1.45,
    animation: "authHintIn 160ms cubic-bezier(0.2, 0, 0, 1)",

    // little arrow pointing down at the field
    "&::before": {
      content: '""',
      position: "absolute",
      bottom: "-5px",
      insetInlineStart: "24px",
      width: "10px",
      height: "10px",
      background: "inherit",
      transform: "rotate(45deg)",
      borderRadius: "2px",
    },

    "& strong": {
      display: "block",
      marginBottom: "2px",
      fontWeight: 650,
    },

    "& p": {
      margin: 0,
      color: "var(--z-fg-secondary)",
    },

    "& a": {
      display: "inline-block",
      marginTop: "6px",
      fontWeight: 650,
      color: "var(--z-link)",
    },

    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

/**
 * Wraps a field so its hint pops up above it while the field (or the hint
 * itself, e.g. a link in it) has focus
 */
function FieldWithHint(props: { hint: JSX.Element; children: JSX.Element }) {
  let anchor: HTMLDivElement | undefined;
  const [open, setOpen] = createSignal(false);

  return (
    <HintAnchor
      ref={anchor}
      onFocusIn={() => setOpen(true)}
      onFocusOut={(event) => {
        if (!anchor?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      {props.children}
      {/* announce to screen readers */}
      <div aria-live="polite">
        <Show when={open()}>
          <HintCard role="note">{props.hint}</HintCard>
        </Show>
      </div>
    </HintAnchor>
  );
}

/**
 * Field errors of the surrounding <Form>, shown under each field in the
 * app's own style and language (instead of the browser's pop-up)
 */
const FieldErrors = createContext<{
  get: (name: string) => string | undefined;
  clear: (name: string) => void;
}>();

/**
 * Where the surrounding <Form> is: ready, waiting on the server, or done
 */
type FormStatus = "ready" | "submitting" | "success";

const FormStatusContext = createContext<() => FormStatus>(
  (): FormStatus => "ready",
);

/**
 * Render a bunch of fields with preset values
 */
export function Fields(props: FieldProps) {
  const fieldConfiguration = useFieldConfiguration();
  const errors = useContext(FieldErrors);

  return (
    <For each={props.fields}>
      {(field) => {
        // If field is just a Field value, convert it to a FieldPreset
        const preset: FieldPreset =
          typeof field === "string" ? { field } : field;

        if (preset.field === "birth-month") {
          const config = fieldConfiguration[preset.field];
          return (
            <BirthMonthField
              label={config.name()}
              helper={config.placeholder()}
              disabled={preset.disabled}
              error={errors?.get("birth-month") ?? errors?.get("birth-year")}
              onChange={() => {
                errors?.clear("birth-month");
                errors?.clear("birth-year");
              }}
            />
          );
        }

        if (preset.field === "log-out") {
          return (
            <Checkbox name={preset.field}>
              {fieldConfiguration[preset.field].name()}
            </Checkbox>
          );
        }

        const { name, placeholder, ...config } =
          fieldConfiguration[preset.field];

        const input = (
          <TextField
            required
            {...config}
            name={preset.field}
            label={name()}
            placeholder={placeholder()}
            disabled={preset.disabled}
            value={preset.value}
            error={errors?.get(preset.field)}
            onInput={() => errors?.clear(preset.field)}
          />
        );

        return preset.hint ? (
          <FieldWithHint hint={preset.hint}>{input}</FieldWithHint>
        ) : (
          input
        );
      }}
    </For>
  );
}

/**
 * The form's one primary action: shows waiting and done, and can't be sent
 * twice while the server is answering
 */
export function SubmitButton(props: { children: JSX.Element }) {
  const status = useContext(FormStatusContext);
  return (
    <AuthButton type="submit" status={status()}>
      {props.children}
    </AuthButton>
  );
}

interface Props {
  /**
   * Form children
   */
  children: JSX.Element;

  /**
   * Actions under the fields, below any error from the server
   */
  actions?: JSX.Element;

  /**
   * Whether to include captcha token
   */
  captcha?: string;

  /**
   * Submission handler
   *
   * Resolve to false when nothing was actually submitted, so no success is shown
   */
  onSubmit: (data: FormData) => Promise<void | boolean> | void | boolean;
}

/**
 * How long the submit button shows "done" if the page stays (most flows
 * move on before that)
 */
const SUCCESS_HOLD_MS = 1600;

/**
 * Small wrapper for HTML form
 */
export function Form(props: Props) {
  const { t } = useLingui();
  const [error, setError] = createSignal();
  const [status, setStatus] = createSignal<FormStatus>("ready");
  const [fieldErrors, setFieldErrors] = createSignal<Record<string, string>>(
    {},
  );
  let hcaptcha: HCaptchaFunctions | undefined;
  let successTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(successTimer));

  /**
   * Browsers only flag a short value after the user typed it, not when a
   * password manager or script filled it in, so check the length directly
   */
  function tooShort(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ) {
    const minimum = (field as HTMLInputElement).minLength;
    return minimum > 0 && !!field.value && field.value.length < minimum;
  }

  /** One short line for each broken constraint, in the app's language */
  function messageFor(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ) {
    const validity = field.validity;
    if (validity.customError) return field.validationMessage;
    if (validity.valueMissing)
      return field.name === "birth-year"
        ? t`Enter the year with 4 digits, for example 1994.`
        : t`Please fill in this field.`;
    if (validity.typeMismatch && field.type === "email")
      return t`Enter a valid email address.`;
    if (validity.patternMismatch && field.name === "birth-year")
      return t`Enter the year with 4 digits, for example 1994.`;
    if (validity.tooShort || tooShort(field)) {
      const minimum = (field as HTMLInputElement).minLength;
      return t`Use at least ${minimum} characters.`;
    }
    return field.validationMessage;
  }

  /**
   * Handle submission
   * @param event Form Event
   */
  async function onSubmit(event: Event) {
    event.preventDefault();

    // one request at a time: Enter pressed twice or a double click
    if (status() !== "ready") return;

    const form = event.currentTarget as HTMLFormElement;

    // check every field, show each problem under its field, focus the first
    const invalid = [
      ...form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input[name]:not([type=hidden]), textarea[name], select[name]"),
    ].filter(
      (field) => !field.disabled && (!field.checkValidity() || tooShort(field)),
    );

    // custom controls keep their value in a hidden input (never validated
    // by the browser) and name the element to focus
    const missing = [
      ...form.querySelectorAll<HTMLInputElement>(
        "input[type=hidden][data-required]",
      ),
    ].filter((field) => !field.value);

    const errors: [string, string, HTMLElement | null][] = [
      ...missing.map(
        (field) =>
          [
            field.name,
            t`Please fill in this field.`,
            document.getElementById(field.dataset.focus ?? ""),
          ] as [string, string, HTMLElement | null],
      ),
      ...invalid.map(
        (field) =>
          [field.name, messageFor(field), field] as [
            string,
            string,
            HTMLElement | null,
          ],
      ),
    ];

    setFieldErrors(
      Object.fromEntries(errors.map(([name, message]) => [name, message])),
    );

    if (errors.length) {
      // first problem in reading order
      const first = errors
        .map(([, , element]) => element)
        .filter((element): element is HTMLElement => !!element)
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
        )[0];
      first?.focus();
      return;
    }

    const formData = new FormData(form);
    setError(undefined);
    setStatus("submitting");
    let succeeded = false;

    try {
      if (props.captcha) {
        // the captcha script didn't load: same message as a failed check
        if (!hcaptcha) throw { type: "CaptchaFailed" };
        const response = await hcaptcha.execute();
        formData.set("captcha", response!.response);
      }

      if ((await props.onSubmit(formData)) !== false) {
        succeeded = true;
      }
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      if (succeeded) {
        setStatus("success");
        successTimer = setTimeout(() => setStatus("ready"), SUCCESS_HOLD_MS);
      } else {
        setStatus("ready");
      }
    }
  }

  return (
    // noValidate: the checks above replace the browser's pop-up
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={status() === "submitting" ? true : undefined}
      style={{ width: "100%" }}
    >
      <FormStatusContext.Provider value={status}>
        <FieldErrors.Provider
          value={{
            get: (name) => fieldErrors()[name],
            clear: (name) =>
              fieldErrors()[name] &&
              setFieldErrors(({ [name]: _, ...rest }) => rest),
          }}
        >
          <FormStack>
            {props.children}
            {/* role="alert" reads it out as soon as it appears */}
            <Show when={error()}>
              <ErrorContainer role="alert">
                <Icon name="warning-circle" size={16} />
                <span>
                  <TranslatedError error={error()} />
                </span>
              </ErrorContainer>
            </Show>
            {props.actions}
          </FormStack>
        </FieldErrors.Provider>
      </FormStatusContext.Provider>
      <Show when={props.captcha}>
        <HCaptcha
          sitekey={props.captcha!}
          onLoad={(instance) => (hcaptcha = instance)}
          size="invisible"
        />
      </Show>
    </form>
  );
}
