/** The only schemes the link warning will ever open */
const OPENABLE = ["https:", "http:"];

/**
 * Whether a URL may be opened from the app. The last check before
 * `window.open`, whatever text or saved value the URL came from, so
 * `javascript:`, `data:`, `file:` and the like can never run.
 */
export function isOpenableUrl(url: URL | string): boolean {
  try {
    return OPENABLE.includes(new URL(url.toString()).protocol);
  } catch {
    return false;
  }
}
