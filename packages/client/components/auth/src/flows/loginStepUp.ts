import type { API } from "@zrzur/sdk/solid";

/**
 * After many wrong passwords for one address the server asks for a captcha
 * with every sign-in for it (answer `CaptchaFailed`, only when the server
 * has a captcha set up). The login form then runs the captcha on the next
 * try; the error already tells the person to try again.
 */
export function asksForCaptcha(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: unknown }).type === "CaptchaFailed"
  );
}

/** The sign-in body: the captcha token only when there is one */
export function loginCredentials(
  email: string,
  password: string,
  captcha?: string | null,
): API.DataLogin {
  // `captcha` is a newer, optional field of the Email form of the body
  return (
    captcha ? { email, password, captcha } : { email, password }
  ) as API.DataLogin;
}
