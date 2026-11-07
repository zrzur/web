/** Pointer events can originate on an SVG path rather than an HTML element. */
export function mediaPickerTrigger(event: unknown): HTMLElement | undefined {
  const e = event as { currentTarget?: unknown; target?: unknown } | null;
  const current =
    e?.currentTarget instanceof Element ? e.currentTarget : undefined;
  const target = e?.target instanceof Element ? e.target : undefined;
  const button = current?.closest("button") ?? target?.closest("button");
  if (button instanceof HTMLElement) return button;
  return current instanceof HTMLElement
    ? current
    : target instanceof HTMLElement
      ? target
      : undefined;
}
