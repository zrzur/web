import { For, JSX, Match, Show, Switch, createMemo } from "solid-js";

import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";
import { Row } from "../layout";

interface Props {
  elements: string[];
  navigate: (keys: string[]) => void;
  renderElement: (key: string) => JSX.Element;
}

/**
 * Breadcrumbs
 *
 * Inspired by Windows Fluent settings menus
 */
export function Breadcrumbs(props: Props) {
  // one step per part of the address that has a name of its own: a part
  // that only groups others (`apps/bot/{id}`: "bot") is left out, or it
  // showed as an empty step between two arrows
  const steps = createMemo(() =>
    props.elements
      .map((_, index) => {
        const key = props.elements.slice(0, index + 1).join("/");
        return { key, label: props.renderElement(key) };
      })
      .filter(
        (step, index) =>
          index === props.elements.length - 1 ||
          (step.label !== "" &&
            step.label !== undefined &&
            step.label !== null),
      ),
  );

  return (
    <Base wrap align>
      <For each={steps()}>
        {(step, index) => (
          <>
            <Show when={index() !== 0}>
              <Icon name="caret-right" size={12} />
            </Show>
            <Switch
              fallback={
                <Unselected onClick={() => props.navigate(step.key.split("/"))}>
                  {step.label}
                </Unselected>
              }
            >
              <Match when={index() === steps().length - 1}>
                <Selected>{step.label}</Selected>
              </Match>
            </Switch>
          </>
        )}
      </For>
    </Base>
  );
}

/**
 * Base styles
 */
const Base = styled(Row, {
  base: {
    userSelect: "none",
    color: "var(--md-sys-color-outline)",
  },
});

/**
 * Unselected styles
 */
const Unselected = styled("div", {
  base: {
    cursor: "pointer",
    transition: "var(--transitions-fast) filter",
  },
});

/**
 * Selected styles
 */
const Selected = styled("div", {
  base: {
    color: "var(--md-sys-color-on-surface)",
  },
});
