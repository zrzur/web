/** The part of the Clipboard API a copy needs */
type Writable = Pick<Clipboard, "writeText">;

/**
 * Put text on the clipboard. The browser may refuse (no permission, the page
 * not focused, an insecure address): that is an answer, not an error, so a
 * caller shows "Copied!" only on `true` and nothing throws.
 */
export async function copyText(
  text: string,
  clipboard: Writable | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
