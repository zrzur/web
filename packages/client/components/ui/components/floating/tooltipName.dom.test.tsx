import { afterEach, describe, expect, it } from "vitest";

import { applyTooltipName } from "./tooltipName";

function html(markup: string) {
  const host = document.createElement("div");
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("applyTooltipName", () => {
  it("names the link inside a plain wrapper, never the wrapper", () => {
    const wrapper = html(`<div><div><a href="/x"><svg></svg></a></div></div>`);
    applyTooltipName(wrapper, "Speed test");
    expect(wrapper.hasAttribute("aria-label")).toBe(false);
    expect(wrapper.querySelector("a")!.getAttribute("aria-label")).toBe(
      "Speed test",
    );
  });

  it("keeps the name a button already has and adds the tooltip as a description", () => {
    const wrapper = html(`<div><button>Save</button></div>`);
    applyTooltipName(wrapper, "Save your changes");
    const button = wrapper.querySelector("button")!;
    expect(button.hasAttribute("aria-label")).toBe(false);
    expect(button.getAttribute("aria-description")).toBe("Save your changes");
  });

  it("does not repeat a tooltip equal to the name", () => {
    const wrapper = html(`<div><a href="/x" aria-label="Home"></a></div>`);
    applyTooltipName(wrapper, "Home");
    expect(wrapper.querySelector("a")!.hasAttribute("aria-description")).toBe(
      false,
    );
  });

  it("names an element that is itself interactive", () => {
    const button = html(`<button><svg></svg></button>`);
    applyTooltipName(button, "Close");
    expect(button.getAttribute("aria-label")).toBe("Close");
  });

  it("lets the alt text of an image inside a link stay the name", () => {
    const link = html(`<a href="/app"><img alt="Zrzur home" /></a>`);
    applyTooltipName(link, "Home");
    expect(link.hasAttribute("aria-label")).toBe(false);
    expect(link.getAttribute("aria-description")).toBe("Home");
  });

  it("gives a lone icon the image role so the name is allowed", () => {
    const wrapper = html(`<div><svg></svg></div>`);
    applyTooltipName(wrapper, "Webhook");
    expect(wrapper.getAttribute("role")).toBe("img");
    expect(wrapper.getAttribute("aria-label")).toBe("Webhook");
  });

  it("leaves text in a plain wrapper as it reads, tooltip as a description", () => {
    const wrapper = html(`<div><span>via Sara</span></div>`);
    applyTooltipName(wrapper, "Sent by Sara");
    expect(wrapper.hasAttribute("role")).toBe(false);
    expect(wrapper.hasAttribute("aria-label")).toBe(false);
    expect(wrapper.getAttribute("aria-description")).toBe("Sent by Sara");
  });

  it("updates a name it set itself when the tooltip changes", () => {
    const button = html(`<button><svg></svg></button>`);
    applyTooltipName(button, "Mute");
    applyTooltipName(button, "Unmute");
    expect(button.getAttribute("aria-label")).toBe("Unmute");
    expect(button.hasAttribute("aria-description")).toBe(false);
  });

  it("does nothing without a label", () => {
    const wrapper = html(`<div><svg></svg></div>`);
    applyTooltipName(wrapper, undefined);
    expect(wrapper.attributes.length).toBe(0);
  });
});
