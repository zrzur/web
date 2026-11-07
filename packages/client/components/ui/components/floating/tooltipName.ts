/** What a keyboard or screen reader user lands on */
const INTERACTIVE =
  "a[href], button, input, select, textarea, summary, [tabindex], " +
  "[role=button], [role=link], [role=menuitem], [role=tab], [role=switch], [role=checkbox]";

/** Labels this module wrote, so a changed tooltip can replace its own label */
const written = new WeakMap<Element, string>();

/**
 * The name an element already has without any help from a tooltip
 */
function ownName(element: Element) {
  if (element.hasAttribute("aria-labelledby")) return "labelledby";
  const label = element.getAttribute("aria-label");
  if (label && written.get(element) !== label) return label;
  const text = element.textContent?.trim();
  if (text) return text;
  return (
    element.getAttribute("alt") ||
    [...element.querySelectorAll("img[alt]")]
      .map((image) => image.getAttribute("alt"))
      .find(Boolean)
  );
}

/**
 * Give a tooltip's words to assistive technology.
 *
 * A tooltip often sits on a plain wrapper (`<Tooltip>` is a div), where
 * aria-label is not allowed and names nothing, so the words go to the control
 * inside. A control that has its own name keeps it: visible text must stay the
 * name (WCAG 2.5.3), and the tooltip becomes its description. A lone icon has
 * no other way to be read, so it becomes an image.
 * @param element Element carrying the tooltip
 * @param label Tooltip text
 */
export function applyTooltipName(element: HTMLElement, label?: string) {
  if (!label) return;

  const target = element.matches(`${INTERACTIVE}, img, [role]`)
    ? element
    : element.querySelector<HTMLElement>(INTERACTIVE);
  const node = target ?? element;
  // content not rendered yet: nothing can be said about it
  if (!target && !node.firstElementChild && !node.textContent?.trim()) return;

  const own = ownName(node);
  if (own) {
    if (own !== label) node.setAttribute("aria-description", label);
    return;
  }

  if (!target) node.setAttribute("role", "img");
  node.setAttribute("aria-label", label);
  written.set(node, label);
}
