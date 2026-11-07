/** Runs in the page: sideways scroll, small targets, small input text. */
export function measure() {
  const vw = window.innerWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== "hidden" &&
      cs.display !== "none" &&
      r.bottom > 0 &&
      r.top < innerHeight
    );
  };
  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 24)}]` : ""}.${String(
      el.className?.baseVal ?? el.className,
    )
      .split(" ")
      .pop()
      .slice(
        0,
        24,
      )} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`;
  const targets = [
    ...document.querySelectorAll(
      'button, a[href], [role="button"], [role="menuitem"], [role="tab"], input:not([type=hidden]), textarea, summary',
    ),
  ].filter(visible);
  const small = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  });
  const smallInput = [
    ...document.querySelectorAll(
      "input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea",
    ),
  ]
    .filter(visible)
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16);
  return {
    wide: document.documentElement.scrollWidth > vw + 1,
    small: small.slice(0, 40).map(label),
    smallInput: smallInput.map(label),
  };
}
