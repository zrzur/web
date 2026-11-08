import { describe, expect, it } from "vitest";

import { pageHandlesPush, skipDesktopNotification } from "./notificationRules";

const ME = "01ARZ3NDEKTSV4RRFFQ69G5FAA";
const OTHER = "01ARZ3NDEKTSV4RRFFQ69G5FBB";

describe("skipDesktopNotification", () => {
  const base = {
    selfId: ME,
    authorId: OTHER,
    channelId: "C1",
    viewingChannelId: "C2",
    focused: true,
    visible: true,
  };

  it("never notifies for the account's own message", () => {
    expect(skipDesktopNotification({ ...base, authorId: ME })).toBe(true);
    // also when the author object is not loaded: only the id counts
    expect(
      skipDesktopNotification({ ...base, authorId: ME, focused: false }),
    ).toBe(true);
  });

  it("skips the channel being looked at in a focused, visible window", () => {
    expect(skipDesktopNotification({ ...base, viewingChannelId: "C1" })).toBe(
      true,
    );
  });

  it("notifies for the open channel when the window is not focused or hidden", () => {
    expect(
      skipDesktopNotification({
        ...base,
        viewingChannelId: "C1",
        focused: false,
      }),
    ).toBe(false);
    expect(
      skipDesktopNotification({
        ...base,
        viewingChannelId: "C1",
        visible: false,
      }),
    ).toBe(false);
  });

  it("notifies for someone else's message in another channel", () => {
    expect(skipDesktopNotification(base)).toBe(false);
  });
});

describe("pageHandlesPush", () => {
  it("leaves the push to an open page that is visible", () => {
    expect(
      pageHandlesPush([{ visibilityState: "visible", focused: false }]),
    ).toBe(true);
    expect(
      pageHandlesPush([{ visibilityState: "hidden", focused: true }]),
    ).toBe(true);
  });

  it("shows the push when no page is open or all are in the background", () => {
    expect(pageHandlesPush([])).toBe(false);
    expect(
      pageHandlesPush([{ visibilityState: "hidden", focused: false }]),
    ).toBe(false);
  });
});
