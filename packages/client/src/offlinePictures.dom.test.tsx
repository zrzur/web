import { afterEach, describe, expect, it } from "vitest";

import {
  FAILED_SRC,
  PLACEHOLDER,
  restorePictures,
  showPlaceholder,
  watchOfflinePictures,
} from "./offlinePictures";

afterEach(() => {
  document.body.innerHTML = "";
});

function picture(src = "https://cdn.example/avatars/abc.png") {
  const image = document.createElement("img");
  image.setAttribute("src", src);
  image.width = 40;
  image.height = 40;
  document.body.append(image);
  return image;
}

describe("a picture that cannot load without a connection", () => {
  it("shows a quiet placeholder of its own size instead of a broken mark", () => {
    const image = picture();
    showPlaceholder(image);
    expect(image.getAttribute("src")).toBe(PLACEHOLDER);
    expect(image.getAttribute(FAILED_SRC)).toBe(
      "https://cdn.example/avatars/abc.png",
    );
    // the size comes from the page, not from the picture: nothing moves
    expect(image.width).toBe(40);
  });

  it("is asked for again when the connection is back", () => {
    const image = picture();
    image.setAttribute("srcset", "a.png 1x, b.png 2x");
    showPlaceholder(image);
    expect(image.hasAttribute("srcset")).toBe(false);
    restorePictures();
    expect(image.getAttribute("src")).toBe(
      "https://cdn.example/avatars/abc.png",
    );
    expect(image.getAttribute("srcset")).toBe("a.png 1x, b.png 2x");
    expect(image.hasAttribute(FAILED_SRC)).toBe(false);
  });

  it("is handled once: a placeholder that fails is left alone", () => {
    const image = picture();
    showPlaceholder(image);
    showPlaceholder(image);
    expect(image.getAttribute(FAILED_SRC)).toBe(
      "https://cdn.example/avatars/abc.png",
    );
  });

  it("is replaced only while offline; online a failed picture is a real fault", () => {
    let offline = false;
    watchOfflinePictures(window, { offline: () => offline });
    const image = picture();
    image.dispatchEvent(new Event("error"));
    expect(image.hasAttribute(FAILED_SRC)).toBe(false);

    offline = true;
    image.dispatchEvent(new Event("error"));
    expect(image.getAttribute("src")).toBe(PLACEHOLDER);

    window.dispatchEvent(new Event("online"));
    expect(image.getAttribute("src")).toBe(
      "https://cdn.example/avatars/abc.png",
    );
  });
});
