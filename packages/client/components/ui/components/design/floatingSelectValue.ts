/**
 * The value of a select menu item. An empty `value=""` is a real choice
 * (e.g. "First channel everyone can read"), so the attribute counts
 * whenever it is present, even when empty.
 */
export function readItemValue(el: HTMLElement): string | undefined {
  if (el.hasAttribute("value")) return el.getAttribute("value") ?? "";
  if (el.hasAttribute("data-value")) return el.getAttribute("data-value") ?? "";
  return (el as HTMLElement & { value?: string }).value || undefined;
}
