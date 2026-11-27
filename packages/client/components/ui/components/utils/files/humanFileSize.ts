/**
 * Print human-readable file size
 */
export function humanFileSize(size: number) {
  // in the page's own language: "4 MB", "3,5 MB"; no trailing zeros
  const lang =
    (typeof document !== "undefined" && document.documentElement.lang) ||
    undefined;
  const number = (value: number) =>
    new Intl.NumberFormat(lang, {
      maximumFractionDigits: 2,
      numberingSystem: "latn",
    }).format(value);

  if (size > 1e6) {
    return `${number(size / 1e6)} MB`;
  } else if (size > 1e3) {
    return `${number(size / 1e3)} KB`;
  }

  return `${size} B`;
}
