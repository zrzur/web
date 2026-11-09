// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootFailed, bootLoaded } from "./boot";

function page(languages: string[]) {
  document.body.innerHTML = '<div id="root"></div>';
  return {
    storage: window.sessionStorage,
    reload: vi.fn(),
    root: document.getElementById("root"),
    languages,
  };
}

beforeEach(() => window.sessionStorage.clear());

describe("when the app's files fail to load", () => {
  it("reloads the page once", () => {
    const first = page(["en"]);
    bootFailed(first);
    expect(first.reload).toHaveBeenCalledTimes(1);
    expect(first.root!.textContent).toBe("");
  });

  it("then says so in plain words, with a button that tries again", () => {
    bootFailed(page(["en"]));
    const second = page(["en"]);
    bootFailed(second);
    expect(second.reload).not.toHaveBeenCalled();
    expect(second.root!.textContent).toContain("Zrzur could not load");
    second.root!.querySelector("button")!.click();
    expect(second.reload).toHaveBeenCalledTimes(1);
  });

  it("speaks Arabic right to left, and German", () => {
    bootFailed(page(["ar-SY"]));
    const arabic = page(["ar-SY"]);
    bootFailed(arabic);
    const box = arabic.root!.firstElementChild as HTMLElement;
    expect(box.dir).toBe("rtl");
    expect(box.lang).toBe("ar");
    expect(box.textContent).toContain("تعذّر تحميل زرزور");

    window.sessionStorage.clear();
    bootFailed(page(["de-AT"]));
    const german = page(["de-AT"]);
    bootFailed(german);
    expect(german.root!.textContent).toContain(
      "Zrzur konnte nicht geladen werden",
    );
  });

  it("reloads once again after a load that worked", () => {
    bootFailed(page(["en"]));
    bootLoaded(window.sessionStorage);
    const later = page(["en"]);
    bootFailed(later);
    expect(later.reload).toHaveBeenCalledTimes(1);
  });

  it("still shows the words when the browser keeps no session storage", () => {
    const blocked = { ...page(["en"]), storage: undefined };
    bootFailed(blocked);
    expect(blocked.reload).not.toHaveBeenCalled();
    expect(blocked.root!.textContent).toContain("Zrzur could not load");
  });
});
