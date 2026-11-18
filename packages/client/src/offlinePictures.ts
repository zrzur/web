/**
 * Pictures that cannot be loaded while there is no connection (people's
 * avatars, attachments, banners: they live on the media server and are not
 * kept on the device) leave the browser's broken-picture mark in their
 * place, which breaks the look of every list and message (owner,
 * 2026-11-18). Offline, such a picture is replaced by a quiet placeholder of
 * the same size and shape; when the connection is back the real one is asked
 * for again.
 */

/** Marks a picture that shows the placeholder, with its real address */
export const FAILED_SRC = "data-offline-src";
const FAILED_SRCSET = "data-offline-srcset";

/** A soft tile with a small picture mark: reads on dark and light surfaces */
export const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="48" height="48" fill="#8a8fa8" fill-opacity=".22"/>' +
      '<g fill="none" stroke="#8a8fa8" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="15" y="16" width="18" height="16" rx="3"/>' +
      '<circle cx="21" cy="22" r="1.6"/>' +
      '<path d="m17 30 5-5 4 4 2-2 4 3"/>' +
      "</g></svg>",
  );

interface Options {
  /** Whether the device is offline right now */
  offline?: () => boolean;
}

/** Put the placeholder in a picture that failed, remembering what it was */
export function showPlaceholder(image: HTMLImageElement) {
  if (image.hasAttribute(FAILED_SRC)) return;
  const real = image.getAttribute("src");
  if (!real || real.startsWith("data:")) return;
  image.setAttribute(FAILED_SRC, real);
  const set = image.getAttribute("srcset");
  if (set) {
    image.setAttribute(FAILED_SRCSET, set);
    image.removeAttribute("srcset");
  }
  image.src = PLACEHOLDER;
}

/** Ask again for every picture that shows the placeholder */
export function restorePictures(root: ParentNode = document) {
  for (const image of root.querySelectorAll<HTMLImageElement>(
    `img[${FAILED_SRC}]`,
  )) {
    const real = image.getAttribute(FAILED_SRC)!;
    const set = image.getAttribute(FAILED_SRCSET);
    image.removeAttribute(FAILED_SRC);
    image.removeAttribute(FAILED_SRCSET);
    if (set) image.setAttribute("srcset", set);
    image.src = real;
  }
}

/** Watch for pictures that fail offline, and for the connection coming back */
export function watchOfflinePictures(
  target: Window = window,
  options: Options = {},
) {
  const offline = options.offline ?? (() => target.navigator.onLine === false);

  // "error" does not bubble: listen on the way down
  target.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!image || (image as Element).tagName !== "IMG") return;
      if (!offline()) return;
      showPlaceholder(image as HTMLImageElement);
    },
    true,
  );
  target.addEventListener("online", () => restorePictures(target.document));
}
