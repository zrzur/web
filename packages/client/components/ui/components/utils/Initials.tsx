import { css } from "styled-system/css";

export type Props = {
  /**
   * Input string
   */
  input: string;

  /**
   * Maximum length
   */
  maxLength?: number;
};

/**
 * Generate initials from some string
 * @param input Input string
 * @param maxLength Max number of initials
 * @returns Initials from string
 */
export function toInitials(input: string, maxLength = 2) {
  return input
    .split(/\s+/)
    .map((x) => x[0])
    .filter((x) => x)
    .slice(0, maxLength);
}

/**
 * Initials component
 *
 * Takes some string and displays the first letter of each word.
 * The letters are drawn, not text: a control around them is named after the
 * whole name, and "St" is not a part of "Speed test" (WCAG 2.5.3).
 */
export function Initials(props: Props) {
  return (
    <span
      class={drawn}
      data-initials={toInitials(props.input, props.maxLength).join("")}
    />
  );
}

const drawn = css({
  "&::before": { content: "attr(data-initials)" },
});
