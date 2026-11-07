interface Props {
  disabled?: boolean;
}

/**
 * Compatibility name for Zrzur's restrained hover and pressed feedback.
 *
 * You should ensure the parent element has relative positioning:
 *
 * ```tsx
 * <div class={css({ position: 'relative' })}>
 *   <Ripple />
 *   .. your content
 * </div>
 * ```
 *
 */
export function Ripple(props: Props) {
  return (
    <span
      class="z-control-feedback"
      aria-hidden="true"
      data-disabled={props.disabled ? "true" : "false"}
    />
  );
}
