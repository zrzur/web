import { describe, expect, it, vi } from "vitest";

import { MfaLoginStep, normaliseMfaResponse } from "./mfaLogin";

// the unit tests run without the Lingui compiler: `t` gives the English
vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({ raw: strings }, ...values),
}));

const SIGNED_IN = {
  result: "Success",
  _id: "s",
  token: "t",
  user_id: "u",
} as const;

const apiError = (type: string, status = 401) =>
  Object.assign(new Error(`${status} ${type}`), { type, status });

function step(options: {
  send?: ReturnType<typeof vi.fn>;
  newTicket?: ReturnType<typeof vi.fn>;
}) {
  const send = options.send ?? vi.fn(async () => SIGNED_IN);
  const newTicket =
    options.newTicket ??
    vi.fn(async () => ({
      result: "MFA",
      ticket: "fresh",
      allowed_methods: ["Totp"],
    }));
  return {
    send,
    newTicket,
    step: new MfaLoginStep("first", send as never, newTicket as never),
  };
}

describe("the code the person typed", () => {
  it("loses every space and line break", () => {
    expect(normaliseMfaResponse({ totp_code: " 123 456\n" })).toEqual({
      totp_code: "123456",
    });
    expect(normaliseMfaResponse({ totp_code: "12\t34 56" })).toEqual({
      totp_code: "123456",
    });
  });

  it("keeps a recovery code as written, without the space around it", () => {
    expect(normaliseMfaResponse({ recovery_code: "  abcd-efgh " })).toEqual({
      recovery_code: "abcd-efgh",
    });
  });
});

describe("signing in with a code", () => {
  it("sends the code without spaces on the ticket and signs in", async () => {
    const { step: s, send } = step({});
    const outcome = await s.answer({ totp_code: "123 456" });
    expect(send).toHaveBeenCalledWith({
      mfa_response: { totp_code: "123456" },
      mfa_ticket: "first",
    });
    expect(outcome).toEqual({ type: "signedIn", session: SIGNED_IN });
  });

  it("a wrong code is said in the dialog and the next try uses a new ticket", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(apiError("InvalidToken"))
      .mockResolvedValueOnce(SIGNED_IN);
    const { step: s, newTicket } = step({ send });

    await expect(s.answer({ totp_code: "000000" })).rejects.toThrow(
      "This code didn't work. Wait for the next code and enter it once.",
    );
    expect(newTicket).toHaveBeenCalledOnce();

    const outcome = await s.answer({ totp_code: "123456" });
    expect(send).toHaveBeenLastCalledWith({
      mfa_response: { totp_code: "123456" },
      mfa_ticket: "fresh",
    });
    expect(outcome.type).toBe("signedIn");
  });

  it("three wrong codes, then the right one, signs in: never the same dead ticket", async () => {
    let tickets = 0;
    const newTicket = vi.fn(async () => ({
      result: "MFA",
      ticket: `t${++tickets}`,
      allowed_methods: ["Totp"],
    }));
    const send = vi.fn(async (body: { mfa_ticket: string }) => {
      if (send.mock.calls.length <= 3) throw apiError("InvalidToken");
      return { ...SIGNED_IN, ticket_used: body.mfa_ticket };
    });
    const { step: s } = step({ send, newTicket });

    for (let i = 0; i < 3; i++) {
      await expect(s.answer({ totp_code: "000000" })).rejects.toThrow();
    }
    const outcome = await s.answer({ totp_code: "123456" });
    expect(outcome.type).toBe("signedIn");
    const used = send.mock.calls.map(([body]) => body.mfa_ticket);
    expect(used).toEqual(["first", "t1", "t2", "t3"]);
  });

  it("the details of a wrong code name the server's answer", async () => {
    const send = vi.fn().mockRejectedValueOnce(apiError("InvalidToken"));
    const { step: s } = step({ send });
    const error = await s.answer({ totp_code: "000000" }).catch((e) => e);
    expect((error as Error).cause).toMatchObject({ type: "InvalidToken" });
  });

  it("a wrong recovery code says so in its own words", async () => {
    const send = vi.fn().mockRejectedValueOnce(apiError("InvalidToken"));
    const { step: s } = step({ send });
    await expect(s.answer({ recovery_code: "nope" })).rejects.toThrow(
      "This recovery code didn't work. Check it and try again.",
    );
  });

  it("when no new ticket can be had, it goes back to the password form", async () => {
    const send = vi.fn().mockRejectedValueOnce(apiError("InvalidToken"));
    const newTicket = vi
      .fn()
      .mockRejectedValueOnce(apiError("InvalidCredentials"));
    const { step: s } = step({ send, newTicket });
    const outcome = await s.answer({ totp_code: "123456" });
    expect(outcome.type).toBe("restart");
    expect(outcome.type === "restart" && outcome.error.message).toBe(
      "The sign-in step ran out. Please sign in again.",
    );
  });

  it("a pause after too many wrong codes goes back with the wait", async () => {
    const send = vi.fn().mockRejectedValueOnce(apiError("LockedOut", 403));
    const { step: s, newTicket } = step({ send });
    const outcome = await s.answer({ totp_code: "123456" });
    expect(outcome.type).toBe("restart");
    expect(outcome.type === "restart" && outcome.error.message).toBe(
      "Too many wrong codes. Wait 15 minutes and try again.",
    );
    expect(newTicket).not.toHaveBeenCalled();
  });

  it("a server answer as a JSON string is read the same way", async () => {
    const send = vi.fn().mockRejectedValueOnce('{"type":"LockedOut"}');
    const { step: s } = step({ send });
    const outcome = await s.answer({ totp_code: "123456" });
    expect(outcome.type).toBe("restart");
  });

  it("a network failure keeps the ticket and is shown as it is", async () => {
    const offline = new TypeError("Failed to fetch");
    const send = vi
      .fn()
      .mockRejectedValueOnce(offline)
      .mockResolvedValueOnce(SIGNED_IN);
    const { step: s, newTicket } = step({ send });
    await expect(s.answer({ totp_code: "123456" })).rejects.toBe(offline);
    expect(newTicket).not.toHaveBeenCalled();
    await s.answer({ totp_code: "123456" });
    expect(send).toHaveBeenLastCalledWith({
      mfa_response: { totp_code: "123456" },
      mfa_ticket: "first",
    });
  });

  it("if two-factor was turned off meanwhile, the new sign-in is the answer", async () => {
    const send = vi.fn().mockRejectedValueOnce(apiError("InvalidToken"));
    const newTicket = vi.fn(async () => SIGNED_IN);
    const { step: s } = step({ send, newTicket });
    const outcome = await s.answer({ totp_code: "123456" });
    expect(outcome).toEqual({ type: "signedIn", session: SIGNED_IN });
  });
});
