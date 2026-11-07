import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type DataExportInfo,
  canDownload,
  canRequest,
  fetchDataExport,
  fetchDataExportFile,
  requestDataExport,
  waitParts,
} from "./api";

const base: DataExportInfo = {
  status: "none",
  next_request_in_seconds: 0,
  deletion_grace_days: 14,
  contact_email: "privacy@zrzur.com",
};

describe("data export helpers", () => {
  it("allows a request only when nothing is pending and the wait is over", () => {
    expect(canRequest(base)).toBe(true);
    expect(canRequest({ ...base, status: "pending" })).toBe(false);
    expect(canRequest({ ...base, status: "ready", next_request_in_seconds: 60 })).toBe(false);
    expect(canRequest({ ...base, status: "failed" })).toBe(true);
    expect(canRequest(undefined)).toBe(false);
  });

  it("shows the link only while the file is ready", () => {
    expect(canDownload({ ...base, status: "ready" })).toBe(true);
    expect(canDownload({ ...base, status: "pending" })).toBe(false);
    expect(canDownload(undefined)).toBe(false);
  });

  it("splits the wait into hours and minutes", () => {
    expect(waitParts(3600 * 5 + 61)).toEqual({ hours: 5, minutes: 2 });
    expect(waitParts(0)).toEqual({ hours: 0, minutes: 0 });
  });

  it("sends the confirmation ticket with the request", async () => {
    const post = vi.fn().mockResolvedValue(base);
    const get = vi.fn().mockResolvedValue(base);
    await requestDataExport({ get, post }, "ticket-1");
    expect(post).toHaveBeenCalledWith("/auth/account/data-export", undefined, {
      headers: { "X-MFA-Ticket": "ticket-1" },
    });
    await fetchDataExport({ get, post });
    expect(get).toHaveBeenCalledWith("/auth/account/data-export");
  });
});

describe("fetchDataExportFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks with the session header and returns the file", async () => {
    const blob = new Blob(["zip"]);
    const fetch = vi.fn(async () => ({ ok: true, status: 200, blob: async () => blob }));
    vi.stubGlobal("fetch", fetch);
    const api = { baseURL: "http://x", config: { headers: { "X-Session-Token": "t" } } };
    expect(await fetchDataExportFile(api)).toBe(blob);
    expect(fetch).toHaveBeenCalledWith("http://x/auth/account/data-export/download", {
      headers: { "X-Session-Token": "t" },
    });
  });

  it("fails when the server refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(fetchDataExportFile({ baseURL: "http://x", config: {} })).rejects.toThrow("404");
  });
});
