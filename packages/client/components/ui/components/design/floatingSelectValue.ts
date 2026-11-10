/**
 * The value of a select menu item. An empty `value=""` is a real choice
 * (e.g. "First channel everyone can read"), so the attribute counts
 * whenever it is present, even when empty.
 */
export function readItemValue(item: unknown): string | undefined {
  // a child that is no element (an empty <Show>, plain text) is no item
  const el = item as HTMLElement | null | undefined;
  if (!el || typeof el.hasAttribute !== "function") return undefined;
  if (el.hasAttribute("value")) return el.getAttribute("value") ?? "";
  if (el.hasAttribute("data-value")) return el.getAttribute("data-value") ?? "";
  return (el as HTMLElement & { value?: string }).value || undefined;
}
