import { createRoot } from "solid-js";

import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { describe, expect, it, vi } from "vitest";

import {
  formatTimestamp,
  relativeClockRunning,
  timestampFormat,
  timestampSeconds,
  timestampTitle,
  useRelativeClock,
} from "./timestampFormat";

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(utc);

// 10 July 2021 13:21:08 UTC
const at = dayjs.unix(1625923268).utc().locale("en");

describe("message timestamps", () => {
  it("draws every format letter", () => {
    expect(formatTimestamp(at, "t")).toBe("1:21 PM");
    expect(formatTimestamp(at, "T")).toBe("1:21:08 PM");
    expect(formatTimestamp(at, "d")).toBe("07/10/2021");
    expect(formatTimestamp(at, "D")).toBe("July 10, 2021");
    expect(formatTimestamp(at, "f")).toBe("July 10, 2021 1:21 PM");
    expect(formatTimestamp(at, "F")).toBe("Saturday, July 10, 2021 1:21 PM");
  });

  it("writes relative times", () => {
    const now = dayjs().locale("en");
    expect(formatTimestamp(now.subtract(6, "minute"), "R")).toBe(
      "6 minutes ago",
    );
    expect(formatTimestamp(now.add(2, "hour"), "R")).toBe("in 2 hours");
  });

  it("uses the default for a missing or unknown letter", () => {
    expect(timestampFormat(undefined)).toBe("f");
    expect(timestampFormat("x")).toBe("f");
    expect(timestampFormat("R")).toBe("R");
    expect(timestampFormat("d")).toBe("d");
  });

  it("shows the tooltip in words, not the technical date", () => {
    expect(timestampTitle(at)).toBe("Saturday, July 10, 2021 1:21 PM");
  });

  it("refuses numbers that are not a moment", () => {
    expect(timestampSeconds("1625937668")).toBe(1625937668);
    expect(timestampSeconds("0")).toBe(0);
    expect(timestampSeconds("99999999999999999")).toBeUndefined();
    expect(timestampSeconds("9000000000000")).toBeUndefined();
    expect(timestampSeconds("12a")).toBeUndefined();
  });

  it("runs one shared clock only while a relative time is shown", () => {
    vi.useFakeTimers();
    const first = createRoot((dispose) => {
      useRelativeClock();
      return dispose;
    });
    const second = createRoot((dispose) => {
      useRelativeClock();
      return dispose;
    });
    expect(relativeClockRunning()).toBe(true);
    first();
    expect(relativeClockRunning()).toBe(true);
    second();
    expect(relativeClockRunning()).toBe(false);
    vi.useRealTimers();
  });
});
