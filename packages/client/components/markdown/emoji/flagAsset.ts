import flags from "./bundledFlags.json";
import { toCodepoint } from "./codepoint";
const bundled: Record<string, boolean> = flags;

/** Local fallback for flags unsupported by some OS fonts, including system emoji mode. */
export function flagAssetKey(text: string): string | undefined {
  const key = toCodepoint(
    text.replace(/^[\uE0E0-\uE0E6]/, "").replace(/^\u200c/, ""),
  )
    .split("-")
    .filter((part) => part !== "fe0f")
    .join("-");
  return bundled[key] ? key : undefined;
}
