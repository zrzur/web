import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/solid";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SIGN_UP_GUIDELINES_URL,
  SIGN_UP_PRIVACY_URL,
  SIGN_UP_TERMS_URL,
  SignUpConsent,
} from "./SignUpConsent";

let dispose: (() => void) | undefined;

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  document.body.replaceChildren(document.createElement("div"));
});
afterEach(() => dispose?.());

describe("the sign-up consent line (T-6)", () => {
  it("names and links the terms, the guidelines and the privacy policy", () => {
    dispose = render(
      () => (
        <I18nProvider i18n={i18n}>
          <SignUpConsent />
        </I18nProvider>
      ),
      document.body.firstElementChild as HTMLElement,
    );
    const line = document.querySelector('[data-testid="sign-up-consent"]')!;
    expect(line.textContent).toContain("By creating an account you accept");
    const links = [...line.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      SIGN_UP_TERMS_URL,
      SIGN_UP_GUIDELINES_URL,
      SIGN_UP_PRIVACY_URL,
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      "Terms of Service",
      "Community Guidelines",
      "Privacy Policy",
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
