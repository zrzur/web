import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";

import { ModalController } from "./controller";

/** A controller with one open settings modal */
function open() {
  return createRoot(() => {
    const controller = new ModalController();
    controller.openModal({ type: "settings", config: "server" } as unknown as Parameters<typeof controller.openModal>[0]);
    return { controller, id: controller.modals[0].id };
  });
}

const visible = (controller: ModalController) =>
  controller.modals.filter((modal) => modal.show).length;

describe("modal close guard", () => {
  it("keeps a modal open on Escape and close while its guard holds back", () => {
    vi.useFakeTimers();
    const { controller, id } = open();
    let dirty = true;
    controller.guardClose(id, () => dirty);

    controller.pop();
    controller.remove(id);
    expect(visible(controller)).toBe(1);

    dirty = false;
    controller.pop();
    expect(visible(controller)).toBe(0);
    vi.useRealTimers();
  });

  it("closes everything on closeAll (e.g. signing out), unsaved or not", () => {
    vi.useFakeTimers();
    const { controller, id } = open();
    controller.guardClose(id, () => true);
    controller.closeAll();
    expect(visible(controller)).toBe(0);
    vi.useRealTimers();
  });

  it("removing a guard lets the modal close again", () => {
    vi.useFakeTimers();
    const { controller, id } = open();
    const release = controller.guardClose(id, () => true);
    release();
    controller.pop();
    expect(visible(controller)).toBe(0);
    vi.useRealTimers();
  });
});
