import { afterEach, describe, expect, test, vi } from "vitest";
import { createPresenceUpdater, presenceRetryDelay } from "./presenceUpdate";

function fixture(save = vi.fn().mockResolvedValue(undefined)) {
  const pending = vi.fn(),
    retrying = vi.fn(),
    saved = vi.fn(),
    failed = vi.fn();
  return {
    save,
    pending,
    retrying,
    saved,
    failed,
    updater: createPresenceUpdater({ save, pending, retrying, saved, failed }),
  };
}
afterEach(() => vi.useRealTimers());

describe("presence saving", () => {
  test("understands rate-limit bodies without retrying arbitrary errors", () => {
    expect(presenceRetryDelay('{"type":"Failure","retry_after":1000}')).toBe(
      1100,
    );
    expect(presenceRetryDelay({ retry_after: 0 })).toBe(100);
    for (const error of [
      new Error("offline"),
      "forbidden",
      { retry_after: -1 },
      { retry_after: Infinity },
    ])
      expect(presenceRetryDelay(error)).toBeUndefined();
  });
  test("waits for the server window, then saves only the latest choice", async () => {
    vi.useFakeTimers();
    const f = fixture(
      vi
        .fn()
        .mockRejectedValueOnce('{"retry_after":1000}')
        .mockResolvedValue(undefined),
    );
    const completion = f.updater.submit("Idle");
    await vi.advanceTimersByTimeAsync(0);
    void f.updater.submit("Focus");
    void f.updater.submit("Online");
    await vi.advanceTimersByTimeAsync(1099);
    expect(f.save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(f.save.mock.calls.map((call) => call[0])).toEqual([
      "Idle",
      "Online",
    ]);
    expect(f.saved).toHaveBeenCalledTimes(1);
    expect(f.failed).not.toHaveBeenCalled();
    expect(f.pending).toHaveBeenLastCalledWith(undefined);
  });
  test("deduplicates clicks on an in-flight choice", async () => {
    let finish!: () => void;
    const f = fixture(
      vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const completion = f.updater.submit("Busy");
    void f.updater.submit("Busy");
    finish();
    await completion;
    expect(f.save).toHaveBeenCalledTimes(1);
  });
  test("reports save failure and allows a later retry", async () => {
    const failure = new Error("offline");
    const f = fixture(
      vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined),
    );
    await f.updater.submit("Invisible");
    expect(f.failed).toHaveBeenCalledWith(failure);
    expect(f.saved).not.toHaveBeenCalled();
    await f.updater.submit("Online");
    expect(f.saved).toHaveBeenCalledTimes(1);
  });
  test("caps automatic retries rather than retrying forever", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn().mockRejectedValue({ retry_after: 0 }));
    const completion = f.updater.submit("Online");
    await vi.runAllTimersAsync();
    await completion;
    expect(f.save).toHaveBeenCalledTimes(3);
    expect(f.failed).toHaveBeenCalledTimes(1);
    expect(f.saved).not.toHaveBeenCalled();
  });
  test("does not save a delayed choice after the account menu is disposed", async () => {
    vi.useFakeTimers();
    const f = fixture(vi.fn().mockRejectedValue({ retry_after: 1000 }));
    const completion = f.updater.submit("Online");
    await vi.advanceTimersByTimeAsync(0);
    f.updater.dispose();
    await completion;
    await vi.runAllTimersAsync();
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.saved).not.toHaveBeenCalled();
    expect(f.failed).not.toHaveBeenCalled();
  });
});
