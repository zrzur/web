import {
  JSX,
  Show,
  createContext,
  createUniqueId,
  splitProps,
  useContext,
} from "solid-js";

import { styled } from "styled-system/jsx";

interface GroupProps {
  value?: string;
  onChange?: (event: { currentTarget: { value: string } }) => void;
  required?: boolean;
  disabled?: boolean;
  children?: JSX.Element;
  name?: string;
}

interface Props {
  value?: string;
  children?: JSX.Element;
  checked?: boolean;
}

const RadioNameContext = createContext<{
  name: string;
  groupValue?: string;
  disabled?: boolean;
}>({ name: "radio" });

/**
 * Zrzur radio group — native radios, compact gaming-calm visuals.
 */
export function Radio2(props: GroupProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "onChange",
    "children",
    "disabled",
    "name",
  ]);
  const generatedName = createUniqueId();

  return (
    <Group
      role="radiogroup"
      {...rest}
      data-disabled={!!local.disabled}
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t?.type === "radio" && t.value != null) {
          local.onChange?.({ currentTarget: { value: t.value } });
        }
      }}
    >
      <RadioNameContext.Provider
        value={{
          get name() {
            return local.name ?? generatedName;
          },
          get groupValue() {
            return local.value;
          },
          get disabled() {
            return local.disabled;
          },
        }}
      >
        {local.children}
      </RadioNameContext.Provider>
    </Group>
  );
}

Radio2.Option = function Option(props: Props) {
  const ctx = useContext(RadioNameContext);
  const checked = () =>
    props.checked ?? (props.value != null && ctx.groupValue === props.value);

  return (
    <OptionRoot data-checked={checked()}>
      <Hidden
        type="radio"
        name={ctx.name}
        value={props.value}
        checked={checked()}
        disabled={ctx.disabled}
      />
      <Dot aria-hidden="true" data-checked={checked()} />
      <Show when={props.children}>
        <span>{props.children}</span>
      </Show>
    </OptionRoot>
  );
};

const Group = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const OptionRoot = styled("label", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    position: "relative",
    "&:has(input:focus-visible)": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "4px",
      borderRadius: "4px",
    },
  },
});

const Hidden = styled("input", {
  base: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
});

const Dot = styled("span", {
  base: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border:
      "1.5px solid color-mix(in srgb, var(--z-fg-muted) 70%, transparent)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,

    "&[data-checked='true']": {
      borderColor: "var(--z-accent, #E0195F)",
      background:
        "radial-gradient(circle at center, var(--z-accent, #E0195F) 0 40%, transparent 42%)",
    },
  },
});
