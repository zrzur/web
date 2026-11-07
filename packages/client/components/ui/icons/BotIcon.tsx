/** Zrzur logo for bots, tinted by the surrounding icon's interaction state. */
export function BotIcon(props: { size?: number }) {
  const mask = `url("${import.meta.env.BASE_URL}assets/web/zrzur-mark.svg") center / contain no-repeat`;

  return (
    <span
      aria-hidden="true"
      data-icon-mark
      style={{
        display: "inline-block",
        width: `${props.size ?? 20}px`,
        height: `${props.size ?? 20}px`,
        "flex-shrink": 0,
        "background-color": "var(--z-icon-color, currentColor)",
        mask: mask,
        "-webkit-mask": mask,
      }}
    />
  );
}
