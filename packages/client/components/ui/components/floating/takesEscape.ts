/**
 * Whether an open floating element is something Esc closes.
 *
 * Esc has several jobs (close what floats, close a dialog, jump to the
 * newest message, …) and the first one that applies takes the key. A tooltip
 * that only follows the pointer is not one of them: it closes when the
 * pointer leaves, Esc cannot close it while the pointer rests on its anchor,
 * and so it would swallow every Esc press for as long as the pointer sits on
 * a timestamp or an avatar.
 * @param shown What the element shows now (the keys are the kinds: tooltip, userCard, contextMenu, autoComplete)
 */
export function takesEscape(
  shown: Record<string, unknown> | undefined,
): boolean {
  if (!shown) return false;
  return Object.entries(shown).some(([kind, value]) =>
    kind === "tooltip"
      ? !!(value as { press?: boolean } | undefined)?.press
      : value !== undefined && value !== false && value !== null,
  );
}
