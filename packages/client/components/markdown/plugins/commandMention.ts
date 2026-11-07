/**
 * Regex for matching command mentions: `</name:id>`, `</name sub:id>`
 * or `</name group sub:id>`
 */
export const RE_COMMAND_MENTION =
  /<\/([\p{Ll}\p{Lo}\p{N}_-]{1,32}(?: [\p{Ll}\p{Lo}\p{N}_-]{1,32}){0,2}):([0-9A-HJKMNP-TV-Z]{26})>/gu;
