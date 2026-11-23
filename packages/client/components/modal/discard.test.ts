import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";

import { ModalController } from "./controller";

type Props = Parameters<ModalController["openModal"]>[0];

describe("a window that could not be drawn", () => {
  it("is taken off the list at once, also when it holds back closing", () => {
    createRoot((dispose) => {
      const controller = new ModalController();
      controller.openModal({ type: "add_friend" } as unknown as Props);
      controller.openModal({
        type: "settings",
        config: "server",
      } as unknown as Props);
      const [first, second] = controller.modals.map((modal) => modal.id);
      controller.guardClose(second, () => true);

      controller.discard(second);
      expect(controller.modals.map((modal) => modal.id)).toEqual([first]);
      expect(controller.isOpen("settings")).toBe(false);

      // Escape now closes the window that is really there
      controller.pop();
      expect(controller.isOpen()).toBe(false);
      dispose();
    });
  });
});
