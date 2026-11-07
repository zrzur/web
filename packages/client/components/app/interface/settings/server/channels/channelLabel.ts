/**
 * "#name" for menus, isolated from the text around it, so right-to-left
 * text (Arabic) keeps the # in front instead of moving it to the end.
 */
export function channelLabel(name: string) {
  return `⁨#${name}⁩`;
}
