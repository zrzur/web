import { JSX, Show, createSignal, splitProps } from "solid-js";
import { CheckboxTrack } from "../../design/Checkbox";

import { styled } from "styled-system/jsx";

const Base = styled("label", {
  base: {
    gap: "10px",
    padding: "4px",
    display: "flex",
    cursor: "pointer",
    userSelect: "none",
    alignItems: "center",
    borderRadius: "var(--borderRadius-md)",
    transition: "0.1s ease background-color",

    "& input": {
      position: "absolute",
      opacity: 0,
      width: "1px",
      height: "1px",
    },

    "&:has(input:focus-visible)": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    "&:has(input:disabled)": { opacity: 0.45, cursor: "not-allowed" },

    "& [disabled]": {
      opacity: 0.8,
      cursor: "not-allowed",
    },
  },
});

const Content = styled("div", {
  base: {
    flexDirection: "column",
    display: "flex",
    flexGrow: 1,
    gap: "3px",
  },
});

const TitleContent = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--colours-foreground)",
  },
});

const Title = styled("div", {
  base: {
    fontSize: "0.9375rem",
    fontWeight: 600,
    display: "-webkit-box",
    // WebkitBoxOrient: "vertical",
    // WebkitLineClamp: 2,
    overflow: "hidden",
  },
});

const Description = styled("div", {
  base: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--foreground)",
    display: "-webkit-box",
    // WebkitBoxOrient: "vertical",
    // WebkitLineClamp: 3,
    overflow: "hidden",
  },
});

type Props = {
  readonly disabled?: boolean;

  readonly title?: JSX.Element;
  readonly description?: JSX.Element;

  readonly name?: string;
  readonly value?: boolean;
  readonly onChange?: (state: boolean) => void;
} & Omit<
  JSX.LabelHTMLAttributes<HTMLLabelElement>,
  "value" | "children" | "onChange" | "title"
>;

/**
 * @deprecated Use Checkbox instead
 */
export function LegacyCheckbox(props: Props) {
  const [local, others] = splitProps(props, [
    "disabled",
    "title",
    "description",
    "name",
    "value",
    "onChange",
  ]);

  const [controlledValue, setControlledValue] = createSignal(false);
  const checked = () => local.value ?? controlledValue();

  return (
    <Base {...others}>
      <Content>
        <Show when={local.title}>
          <TitleContent>
            <Title>{local.title}</Title>
          </TitleContent>
        </Show>
        <Show when={local.description}>
          <Description>{local.description}</Description>
        </Show>
      </Content>
      <input
        name={local.name}
        type="checkbox"
        checked={checked()}
        disabled={local.disabled}
        onChange={() =>
          typeof local.value !== "undefined"
            ? !local.disabled && local.onChange?.(!local.value)
            : setControlledValue((v) => !v)
        }
      />
      <CheckboxTrack aria-hidden="true" data-checked={checked()}>
        <span />
      </CheckboxTrack>
    </Base>
  );
}
