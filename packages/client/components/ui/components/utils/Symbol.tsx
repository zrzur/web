import { createMemo, JSX, Match, splitProps, Switch } from "solid-js";

import { css } from "styled-system/css";
import { splitCssProps, styled } from "styled-system/jsx";
import { HTMLStyledProps } from "styled-system/types";

import { Icon } from "@revolt/ui/icons/Icon";
import { IconName, iconRegistry, symbolNames } from "@revolt/ui/icons/registry";

interface Props {
  /**
   * Whether to use the filled version of this symbol.
   * Filled symbols should only be used when there is an active state.
   */
  fill?: boolean;
  /**
   * Font size for the symbol. This can be a number (in pixels) or any valid CSS size string.
   * @deprecated passing to css() does nothing
   */
  fontSize?: string | number;
  /**
   * @deprecated Material Symbols grade — ignored under Phosphor
   */
  grade?: number;
  /**
   * @deprecated Material Symbols optical size — ignored under Phosphor
   */
  opticalSize?: number | "auto";
  /**
   * Legacy Material Symbols type. Mapped to Phosphor styleVariant when set.
   */
  type?: "outlined" | "rounded" | "sharp";
  /**
   * @deprecated Material Symbols weight — ignored under Phosphor
   */
  weight?: number;
  /**
   * Material symbol name (legacy) or Phosphor IconName.
   */
  children: string | JSX.Element;
  /**
   * Symbol size in pixels
   */
  size?: number;
}

function resolveName(raw: string): IconName | undefined {
  const key = raw.trim();
  if (!key) return undefined;
  if (symbolNames[key]) return symbolNames[key];
  if (key in iconRegistry) return key as IconName;
  return undefined;
}

/**
 * Semantic icon bridge.
 *
 * Historically rendered Google Material Symbols font glyphs.
 * Now resolves names through the Phosphor registry (outline / filled / expressive).
 * Unmapped names fall back to a Material Symbols font span so UI never goes blank mid-migration.
 */
export function Symbol(rawProps: Props & HTMLStyledProps<"span">) {
  const [local, props] = splitProps(rawProps, [
    "fill",
    "fontSize",
    "grade",
    "opticalSize",
    "weight",
    "type",
    "size",
    "children",
  ]);

  const [cssProps, restProps] = splitCssProps(props);

  const phosphorName = createMemo(() => {
    const child = local.children;
    if (typeof child !== "string") return undefined;
    return resolveName(child);
  });

  const memoClassName = createMemo(() => {
    return css(
      {
        fontSize: local.fontSize ?? "inherit",
        fontWeight: `${local.weight} !important`,
        fontOpticalSizing: local.opticalSize === "auto" ? "auto" : undefined,
        userSelect: "none",
      },
      cssProps,
    );
  });

  return (
    <Switch>
      <Match when={phosphorName()}>
        {(name) => (
          <styled.span
            class={memoClassName()}
            style={{
              display: "inline-flex",
              "align-items": "center",
              "justify-content": "center",
              "font-size": local.size ? `${local.size}px` : undefined,
            }}
            aria-hidden="true"
            {...restProps}
            // @codegen directives props=props include=floating
          >
            <Icon
              name={name()}
              size={local.size}
              // Material's "outlined" was only the font family; the
              // Appearance icon style decides the look
              filled={local.fill}
            />
          </styled.span>
        )}
      </Match>
      {/* an unknown name: a neutral icon (the Material font is no longer loaded) */}
      <Match when={true}>
        <styled.span
          class={memoClassName()}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            "font-size": local.size ? `${local.size}px` : undefined,
          }}
          aria-hidden="true"
          {...restProps}
          // @codegen directives props=props include=floating
        >
          <Icon name="circle" size={local.size} />
        </styled.span>
      </Match>
    </Switch>
  );
}
