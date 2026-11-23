/**
 * One polite live region for what a keyboard shortcut did out of sight
 * ("Copied", "Replying to …"), so screen readers hear it. Made on first use.
 */
let region: HTMLElement | undefined;

export function announce(text: string) {
  if (typeof document === "undefined") return;
  if (!region?.isConnected) {
    region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.dataset.testid = "shortcut-announcer";
    Object.assign(region.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    });
    document.body.append(region);
  }
  // a change of text is what is read: clear first, so the same words repeat
  region.textContent = "";
  const target = region;
  setTimeout(() => (target.textContent = text), 50);
}
