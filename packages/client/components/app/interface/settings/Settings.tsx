import {
  type JSX,
  Accessor,
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  Setter,
  untrack,
  useContext,
} from "solid-js";
import { Motion, Presence } from "solid-motionone";

import { Rerun } from "@solid-primitives/keyed";

import { useModals } from "@revolt/modal";
import { UnsavedChangesContext } from "@revolt/ui/components/design/UnsavedChanges";

import { SettingsConfiguration, SettingsEntry, SettingsList } from ".";
import { SettingsContent } from "./_layout/Content";
import { SettingsSidebar } from "./_layout/Sidebar";

/**
 * Each settings configuration (user, server, channel…) has its own context
 * shape; the shared layout passes it through without reading it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsContext = any;

export interface SettingsProps {
  /** Optional destination when opened from a specific feature. */
  initialPage?: string;
  /**
   * Close settings
   */
  onClose?: () => void;

  /**
   * Settings context
   */
  context: SettingsContext;

  contentRef: Setter<HTMLDivElement | undefined>;

  /** The modal showing these settings, so Escape can be held back too */
  modalId?: string;
}

/**
 * Transition animation
 */
export type SettingsTransition = "normal" | "to-child" | "to-parent";

/**
 * Provide navigation to child components
 */
const SettingsNavigationContext = createContext<{
  page: Accessor<string | undefined>;
  navigate: (path: string | SettingsEntry) => void;
  registerAction: (action: () => JSX.Element) => () => void;
}>();

/**
 * Generic Settings component
 */
export function Settings(props: SettingsProps & SettingsConfiguration<SettingsContext>) {
  // an address is "page", "page#section" or "page/sub-view"; the section
  // is scrolled to once the page has opened
  const open = (address: string | undefined) =>
    address === undefined
      ? undefined
      : (props.resolve?.(address) ?? address).split("#")[0];
  const sectionOf = (address: string | undefined) =>
    address === undefined
      ? undefined
      : (props.resolve?.(address) ?? address).split("#")[1];
  const scrollToSection = (section: string | undefined, delay: number) => {
    if (!section) return;
    setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-section="${CSS.escape(section)}"]`,
      );
      if (!target) return;
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      target.dataset.flash = "true";
      setTimeout(() => delete target.dataset.flash, 1600);
    }, delay);
  };

  const [page, setPage] = createSignal<undefined | string>(
    // eslint-disable-next-line
    open(props.initialPage ?? (props.context as any)?.page),
  );
  // eslint-disable-next-line solid/reactivity
  scrollToSection(sectionOf(props.initialPage), 700);
  const [transition, setTransition] =
    createSignal<SettingsTransition>("normal");
  const [action, setAction] = createSignal<(() => JSX.Element) | undefined>();

  // unsaved changes: pages register a check; while any reports changes,
  // switching page and closing are held back and the save bar is nudged
  const dirtyChecks = new Set<() => boolean>();
  const [attention, setAttention] = createSignal(0);
  const holdBack = () => {
    if (![...dirtyChecks].some((dirty) => dirty())) return false;
    setAttention((n) => n + 1);
    return true;
  };
  const changeTo = (id: string | undefined) => {
    if (id !== page() && holdBack()) return;
    setPage(id);
  };
  const close = () => {
    if (!holdBack()) props.onClose?.();
  };

  const modals = useModals();
  // eslint-disable-next-line solid/reactivity
  const modalId = props.modalId;
  if (modalId) onCleanup(modals.guardClose(modalId, holdBack));

  // closing the tab or reloading asks first while something is unsaved
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if ([...dirtyChecks].some((dirty) => dirty())) event.preventDefault();
  };
  window.addEventListener("beforeunload", beforeUnload);
  onCleanup(() => window.removeEventListener("beforeunload", beforeUnload));

  /**
   * Register the action associated with the current settings page
   */
  function registerAction(nextAction: () => JSX.Element) {
    setAction(() => nextAction);

    return () =>
      setAction((currentAction) =>
        currentAction === nextAction ? undefined : currentAction,
      );
  }

  /**
   * Navigate to a certain page
   */
  function navigate(entry: string | SettingsEntry) {
    let id: string | undefined;
    if (typeof entry === "object") {
      if (entry.onClick) {
        entry.onClick();
      } else if (entry.href) {
        window.open(entry.href, "_blank", "noopener,noreferrer");
      } else if (entry.id) {
        id = entry.id;
      }
    } else {
      id = entry;
    }

    if (!id) return;
    const section = sectionOf(id);
    id = open(id)!;
    if (id === page()) {
      // already on that page: only scroll
      scrollToSection(section, 0);
      return;
    }
    if (holdBack()) return;

    const current = page();
    if (current?.startsWith(id)) {
      setTransition("to-parent");
    } else if (current && id.startsWith(current)) {
      setTransition("to-child");
    } else {
      setTransition("normal");
    }

    setPage(id);
    scrollToSection(section, 450);
  }

  return (
    <SettingsNavigationContext.Provider
      value={{
        page,
        navigate,
        registerAction,
      }}
    >
      <UnsavedChangesContext.Provider
        value={{
          register(dirty) {
            dirtyChecks.add(dirty);
            return () => dirtyChecks.delete(dirty);
          },
          attention,
        }}
      >
        <MemoisedList
          context={props.context}
          list={props.list}
          onClose={props.onClose && close}
        >
          {(list) => (
            <>
              <SettingsSidebar
                list={list}
                page={page}
                setPage={changeTo as Setter<string | undefined>}
              />
              <SettingsContent
                ref={props.contentRef}
                action={action}
                page={page}
                list={list}
                title={props.title}
                onClose={props.onClose && close}
              >
                <Presence exitBeforeEnter>
                  <Rerun on={page}>
                    <Motion.div
                      style={
                        untrack(transition) === "normal"
                          ? {}
                          : { visibility: "hidden" }
                      }
                      ref={(el) =>
                        untrack(transition) !== "normal" &&
                        setTimeout(() => (el.style.visibility = "visible"), 250)
                      }
                      initial={initialFor(transition())}
                      animate={{
                        opacity: 1,
                        x: 0,
                        y: 0,
                      }}
                      exit={exitFor(transition())}
                      transition={{
                        duration: 0.2,
                        easing: [0.17, 0.67, 0.58, 0.98],
                      }}
                    >
                      {props.render({ page }, props.context)}
                    </Motion.div>
                  </Rerun>
                </Presence>
              </SettingsContent>
            </>
          )}
        </MemoisedList>
      </UnsavedChangesContext.Provider>
    </SettingsNavigationContext.Provider>
  );
}

// Plain functions rather than inline ternaries: the JSX compiler wraps an
// inline ternary prop in a memo, and Motion reads these props again while
// the page is being disposed, i.e. outside any owner, which leaked a
// computation on every page switch.
function initialFor(transition: SettingsTransition) {
  if (transition === "normal") return { opacity: 0, y: 6 };
  return { x: transition === "to-child" ? "100vw" : "-100vw" };
}

function exitFor(transition: SettingsTransition) {
  if (transition === "normal") return undefined;
  return { x: transition === "to-child" ? "-100vw" : "100vw" };
}

/**
 * Memoise the list but generate it within context
 */
function MemoisedList(props: {
  context: SettingsContext;
  onClose?: () => void;
  list: (context: SettingsContext, onClose?: () => void) => SettingsList<unknown>;
  children: (list: Accessor<SettingsList<unknown>>) => JSX.Element;
}) {
  /**
   * Generate list of categories / links
   */
  const list = createMemo(() => props.list(props.context, props.onClose));
  return <>{props.children(list)}</>;
}

/**
 * Use settings navigation context
 */
export const useSettingsNavigation = () =>
  useContext(SettingsNavigationContext)!;
