import { JSX, Show, createMemo, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import { useState } from "@revolt/state";

import { BotIcon } from "./BotIcon";
import { IconName, iconRegistry } from "./registry";

export { iconRegistry };
export type { IconName };

type Props = Omit<JSX.SvgSVGAttributes<SVGSVGElement>, "fill"> & {
  name: IconName;
  size?: number;
  /** Force a style; otherwise uses Appearance / theme iconStyle */
  styleVariant?: "outline" | "filled" | "expressive";
  /** Prefer filled silhouette (maps to filled weight) */
  filled?: boolean;
};

/**
 * Hugeicons "Stroke Rounded" icon. The Appearance style (Outline / Filled /
 * Expressive, the default) sets the line weight in icon.css.
 * Colour follows the surrounding text (tinted by --z-icon-accent) unless
 * --z-icon-color sets a role.
 */
export function Icon(props: Props) {
  const state = useState();
  const [local, rest] = splitProps(props, [
    "name",
    "size",
    "styleVariant",
    "filled",
    "children",
    "class",
    "style",
    "viewBox",
    "width",
    "height",
  ]);

  const variant = createMemo(() => {
    // Product chrome is Outline (Kontur). styleVariant / filled still allow
    // a one-off override (e.g. a solid check on a badge).
    if (local.styleVariant) return local.styleVariant;
    if (local.filled) return "filled" as const;
    return "outline" as const;
  });

  const Component = createMemo(() => {
    const e = iconRegistry[local.name];
    if (!e) return undefined;
    const v = variant();
    return v === "filled"
      ? e.filled
      : v === "outline"
        ? e.outline
        : e.expressive;
  });

  // legacy call sites size icons with width/height (iconSize()/symbolSize())
  const size = createMemo(() => {
    if (local.size) return local.size;
    const legacy = Number.parseFloat(String(local.width ?? ""));
    if (Number.isFinite(legacy) && legacy > 0) return legacy;
    return state?.theme.activeTheme.iconSize ?? 20;
  });

  return (
    <span
      class={`z-icon z-icon--${variant()} ${local.class ?? ""}`}
      data-icon={local.name}
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: `${size()}px`,
        height: `${size()}px`,
        // One rule everywhere: an icon takes the colour of the text around
        // it, lightly tinted with the Appearance icon colour. Places that
        // mean something (selected, danger…) set --z-icon-color.
        color:
          "var(--z-icon-color, color-mix(in srgb, currentColor 82%, var(--z-icon-accent, currentColor)))",
        "--z-icon-local-size": `${size()}px`,
        ...(typeof local.style === "object" && local.style
          ? (local.style as Record<string, string>)
          : {}),
      }}
    >
      {/* bots are drawn with the Zrzur logo, never a generic robot */}
      <Show when={local.name !== "robot"} fallback={<BotIcon size={size()} />}>
        <Dynamic
          component={Component()}
          {...rest}
          width={size()}
          height={size()}
          viewBox="0 0 24 24"
          style={{ width: "100%", height: "100%" }}
        />
      </Show>
    </span>
  );
}
