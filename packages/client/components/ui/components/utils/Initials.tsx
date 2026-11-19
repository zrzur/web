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

const ARABIC_LETTER = /[\u0620-\u064A\u066E-\u06D3\u06FA-\u06FF]/u;
const MARKS =
  /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\u202A-\u202E\u2060-\u2069]/gu;

/**
 * The letter a word is known by: its first letter, as one whole character
 * (an emoji or a letter outside the basic plane is not cut in half). An
 * Arabic word is known by the letter after its definite article: «الأصدقاء»
 * gives «أ», not the article's alef. Vowel marks and tatweel are dropped.
 */
function firstLetter(word: string) {
  const letters = Array.from(word.replace(MARKS, ""));
  if (
    letters.length > 3 &&
    letters[0] === "ا" &&
    letters[1] === "ل" &&
    ARABIC_LETTER.test(letters[2])
  )
    return letters[2];
  return letters[0];
}

/**
 * Generate initials from some string
 * @param input Input string
 * @param maxLength Max number of initials
 * @returns Initials from string
 */
export function toInitials(input: string, maxLength = 2) {
  return input
    .split(/\s+/)
    .map(firstLetter)
    .filter((x) => x)
    .slice(0, maxLength);
}

/**
 * The initials as drawn. Arabic letters would join into a word («مكتبة
 * الأصدقاء» read «ما», "what"), so a zero-width non-joiner keeps each one
 * standing alone: «م أ», unjoined.
 */
export function initialsText(input: string, maxLength = 2) {
  const letters = toInitials(input, maxLength);
  return letters.join(
    letters.some((x) => ARABIC_LETTER.test(x)) ? "\u200C" : "",
  );
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
      data-initials={initialsText(props.input, props.maxLength)}
    />
  );
}

const drawn = css({
  "&::before": { content: "attr(data-initials)" },
});
