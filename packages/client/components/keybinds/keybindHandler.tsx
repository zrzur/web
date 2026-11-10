import {
  type JSXElement,
  createContext,
  createEffect,
  onCleanup,
  untrack,
  useContext,
} from "solid-js";

import { shortcutFor } from "./active";
import {
  ACTION_PRIORITY,
  ESCAPE_ACTIONS,
  KeybindAction,
  keybindFilter,
} from "./keybindActions";

type KeybindContext = {
  createKeybind: (keybind: KeybindAction, callback: () => void) => void;
};

const keybindContext = createContext<KeybindContext>(null! as KeybindContext);

/** Shortcut ids that are actions of this context (the others have their own listeners) */
const CONTEXT_ACTIONS = new Set<string>(Object.values(KeybindAction));

const PRIORITY = new Map(
  ACTION_PRIORITY.map((action, index) => [action, index]),
);

/**
 * The actions a key press can mean, before filtering. One table lookup for
 * the changeable shortcuts, plus the fixed Escape actions and "start typing".
 */
export function candidateActions(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
  >,
): KeybindAction[] {
  const out: KeybindAction[] = [];
  const id = shortcutFor(event);
  if (id && CONTEXT_ACTIONS.has(id)) out.push(id as KeybindAction);
  if (event.key === "Escape") out.push(...ESCAPE_ACTIONS);
  if (event.key?.length === 1 && event.key !== " ")
    out.push(KeybindAction.CHAT_FOCUS_COMPOSITION);
  return out.length > 1
    ? out.sort((a, b) => PRIORITY.get(a)! - PRIORITY.get(b)!)
    : out;
}

export function KeybindContext(props: { children: JSXElement }) {
  /**
   * Callbacks of every action that is bound now
   */
  const bound = new Map<KeybindAction, Set<{ callback: () => void }>>();

  /**
   * How many of each action are bound (for the filters)
   */
  const currentlyBound = ACTION_PRIORITY.reduce(
    (d, k) => ({ ...d, [k]: 0 }),
    {} as Record<KeybindAction, number>,
  );

  function onKeyDown(event: KeyboardEvent) {
    // a held key fires once, as before
    if (event.repeat) return;
    const target = event.target as HTMLElement | null;
    const fired = candidateActions(event).find(
      (action) =>
        currentlyBound[action] > 0 &&
        keybindFilter(action, event, currentlyBound, target),
    );
    if (!fired) return;
    for (const entry of [...(bound.get(fired) ?? [])]) untrack(entry.callback);
  }

  document.body.addEventListener("keydown", onKeyDown);
  onCleanup(() => document.body.removeEventListener("keydown", onKeyDown));

  return (
    <keybindContext.Provider
      value={{
        createKeybind(keybind, callback) {
          currentlyBound[keybind]++;
          let set = bound.get(keybind);
          if (!set) bound.set(keybind, (set = new Set()));
          const entry = { callback };
          set.add(entry);
          onCleanup(() => {
            currentlyBound[keybind]--;
            set.delete(entry);
          });
        },
      }}
    >
      {props.children}
    </keybindContext.Provider>
  );
}

/**
 * Wrapper for contextual createKeybind function
 * @param keybind Keybind
 * @param callback Callback
 */
export function createKeybind(keybind: KeybindAction, callback: () => void) {
  const { createKeybind } = useContext(keybindContext);
  createKeybind(keybind, callback);
}

/**
 * Declarative keybind component
 */
export function Keybind(props: {
  keybind: KeybindAction;
  onPressed: () => void;
}) {
  createEffect(() => createKeybind(props.keybind, props.onPressed));
  return null;
}
