// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { mediaPickerTrigger } from "./mediaPickerTrigger";

describe("media picker anchor", () => {
  it("anchors an SVG-path click to its button, including wrapper callbacks", () => {
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    button.append(path);
    wrapper.append(button);
    expect(mediaPickerTrigger({ target: path, currentTarget: wrapper })).toBe(
      button,
    );
  });
  it("uses the current button when the click target is not an element", () => {
    const button = document.createElement("button");
    expect(
      mediaPickerTrigger({
        target: document.createTextNode("GIF"),
        currentTarget: button,
      }),
    ).toBe(button);
    expect(mediaPickerTrigger(undefined)).toBeUndefined();
  });
});
