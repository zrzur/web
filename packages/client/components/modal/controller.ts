import { batch } from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";

import type { Modals } from "./types";

export type ActiveModal = {
  /**
   * Unique modal Id
   */
  id: string;

  /**
   * Whether to show the modal
   */
  show: boolean;

  /**
   * Props to pass to modal
   */
  props: Modals;
};

/**
 * Global modal controller for layering and displaying one or more modal to the user
 */
export class ModalController {
  modals: ActiveModal[];
  setModals: SetStoreFunction<ActiveModal[]>;

  /** Runs whenever a modal opens (the app closes open menus and tooltips) */
  protected onOpen?: () => void;

  /**
   * Construct controller
   */
  constructor() {
    const [modals, setModals] = createStore<ActiveModal[]>([]);
    // eslint-disable-next-line solid/reactivity
    this.modals = modals;
    this.setModals = setModals;

    this.openModal = this.openModal.bind(this);
    this.pop = this.pop.bind(this);
    this.remove = this.remove.bind(this);
    this.isOpen = this.isOpen.bind(this);
    this.closeAll = this.closeAll.bind(this);
  }

  /**
   * Add a modal to the stack
   * @param props Modal parameters
   */
  openModal(props: Modals) {
    // official accounts have no profile to open, from anywhere
    if (props.type === "user_profile" && props.user.official) return;

    //Unique ID from clock that can't run backwards
    const id = performance.now().toString();
    this.setModals((modals) => [
      ...modals,
      {
        id,
        show: true,
        props,
      },
    ]);
    this.onOpen?.();
    // after modal commits to DOM,
    // we can begin animations!
    // setTimeout(
    //   () =>
    //     this.setModals((modals) =>
    //       modals.map((modal) =>
    //         modal.id === id ? { ...modal, show: true } : modal,
    //       ),
    //     ),
    //   0,
    // );
  }

  /**
   * Modals that may refuse to close (e.g. settings with unsaved changes):
   * the check returns true to keep the modal open
   */
  #closeGuards = new Map<string, () => boolean>();

  /**
   * Let a modal hold back being closed by Escape or its own close actions
   * @returns Removes the guard
   */
  guardClose(id: string, holdBack: () => boolean) {
    this.#closeGuards.set(id, holdBack);
    return () => {
      if (this.#closeGuards.get(id) === holdBack) this.#closeGuards.delete(id);
    };
  }

  /**
   * Remove the top modal
   */
  pop() {
    const modal = [...this.modals].reverse().find((modal) => modal.show);

    if (modal) {
      this.remove(modal.id);
    }
  }

  /**
   * Remove all modals (signing out and the like: nothing is held back)
   */
  closeAll() {
    batch(() => {
      for (const modal of this.modals) {
        this.remove(modal.id, true);
      }
    });
  }

  /**
   * Close modal by id
   * @param force Close even if the modal holds back closing
   */
  remove(id: string, force = false) {
    if (!force && this.#closeGuards.get(id)?.()) return;
    this.#closeGuards.delete(id);
    this.setModals((entry) => entry.id === id, "show", false);

    setTimeout(() => {
      this.setModals(this.modals.filter((entry) => entry.id !== id));
    }, 500); /** FIXME / TODO: set to motion anim time + 100ms */
  }

  /**
   * Whether a modal is currently open
   * @returns Boolean
   */
  isOpen(type?: string) {
    return type
      ? !!this.modals.find((x) => x.show && x.props.type === type)
      : !!this.modals.find((x) => x.show);
  }
}
