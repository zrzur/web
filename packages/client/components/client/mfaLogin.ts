import { t } from "@lingui/core/macro";
import type { API } from "@zrzur/sdk/solid";

import { translatedError } from "../i18n/errors";

/** What the two-factor step of signing in ends with */
export type MfaLoginOutcome =
  /** The server took the code: this is the new session (or `Disabled`) */
  | { type: "signedIn"; session: Exclude<API.ResponseLogin, { result: "MFA" }> }
  /** The step can't go on: back to the password form with this message */
  | { type: "restart"; error: Error };

type Send = (body: {
  mfa_response: API.MFAResponse;
  mfa_ticket: string;
}) => Promise<API.ResponseLogin>;

/**
 * Authenticator apps show a code as `123 456` and a paste can bring a space
 * or a line break: only the digits are sent. A recovery code is sent as
 * written, without the space around it.
 */
export function normaliseMfaResponse(
  response: API.MFAResponse,
): API.MFAResponse {
  if ("totp_code" in response) {
    return { totp_code: response.totp_code.replace(/\s+/g, "") };
  }
  if ("recovery_code" in response) {
    return { recovery_code: response.recovery_code.trim() };
  }
  return response;
}

/** The server's error type, from an `ApiError` or a JSON string */
function errorType(error: unknown): string | undefined {
  let value = error;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  const type = (value as { type?: unknown } | null | undefined)?.type;
  return typeof type === "string" ? type : undefined;
}

/**
 * The two-factor step of signing in, answered from the dialog.
 *
 * The server answers `InvalidToken` both for a wrong code and for a ticket
 * that is gone (five minutes old, or three tries used), so after any
 * `InvalidToken` the next try runs on a new ticket, asked for with the
 * password the person already gave. Wrong codes still count towards the
 * account's pause (five in fifteen minutes), which the server keeps.
 */
export class MfaLoginStep {
  #ticket: string;
  readonly #send: Send;
  readonly #newTicket: () => Promise<API.ResponseLogin>;

  /**
   * @param ticket Ticket of the password step
   * @param send Sends one answer on a ticket
   * @param newTicket Signs in with the password again, for a new ticket
   */
  constructor(
    ticket: string,
    send: Send,
    newTicket: () => Promise<API.ResponseLogin>,
  ) {
    this.#ticket = ticket;
    this.#send = send;
    this.#newTicket = newTicket;
  }

  /**
   * Send one answer.
   * @returns How the step ends; throws an error to show in the dialog when
   * the person can try again there
   */
  async answer(response: API.MFAResponse): Promise<MfaLoginOutcome> {
    const mfa_response = normaliseMfaResponse(response);

    let session: API.ResponseLogin;
    try {
      session = await this.#send({ mfa_response, mfa_ticket: this.#ticket });
    } catch (error) {
      switch (errorType(error)) {
        case "LockedOut":
          return {
            type: "restart",
            error: translatedError(
              t`Too many wrong codes. Wait 15 minutes and try again.`,
              error,
            ),
          };
        case "InvalidToken":
          return this.#retry(mfa_response, error);
        default:
          // network trouble and the like: the ticket may still be good
          throw error;
      }
    }

    if (session.result === "MFA") {
      // not expected after an answer; carry on with what the server sent
      this.#ticket = session.ticket;
      throw translatedError(wrongAnswer(mfa_response));
    }
    return { type: "signedIn", session };
  }

  /** After a refused answer: a new ticket, and the words for the dialog */
  async #retry(
    response: API.MFAResponse,
    refusal: unknown,
  ): Promise<MfaLoginOutcome> {
    let fresh: API.ResponseLogin;
    try {
      fresh = await this.#newTicket();
    } catch (error) {
      return {
        type: "restart",
        error: translatedError(
          t`The sign-in step ran out. Please sign in again.`,
          error,
        ),
      };
    }

    // two-factor was turned off meanwhile: the password was enough
    if (fresh.result !== "MFA") return { type: "signedIn", session: fresh };

    this.#ticket = fresh.ticket;
    throw translatedError(wrongAnswer(response), refusal);
  }
}

/** What to tell the person whose answer was refused */
function wrongAnswer(response: API.MFAResponse): string {
  if ("recovery_code" in response) {
    return t`This recovery code didn't work. Check it and try again.`;
  }
  if ("password" in response) {
    return t`This password didn't work. Check it and try again.`;
  }
  return t`This code didn't work. Wait for the next code and enter it once.`;
}
