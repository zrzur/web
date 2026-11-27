/** A public https link, as the server accepts it: a host, no password */
export function isHttpsLink(value: string) {
  const text = value.trim();
  if (!text.startsWith("https://") || /\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Characters as the server counts them (code points, not UTF-16 units) */
export const charCount = (text: string) => [...text.trim()].length;
