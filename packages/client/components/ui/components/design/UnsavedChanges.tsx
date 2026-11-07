import { Accessor, createContext, onCleanup, useContext } from "solid-js";

/**
 * Settings pages report unsaved changes here; the settings frame holds back
 * page switches and closing while any page is dirty and raises `attention`
 * (a counter) so the save bar can point at itself.
 */
export const UnsavedChangesContext = createContext<{
  register: (dirty: () => boolean) => () => void;
  attention: Accessor<number>;
}>();

/**
 * Report whether this part of the page has unsaved changes.
 * Outside a settings frame nothing is held back.
 * @returns How many times leaving was held back (changes when it happens)
 */
export function useUnsavedChanges(dirty: () => boolean): Accessor<number> {
  const context = useContext(UnsavedChangesContext);
  if (!context) return () => 0;
  onCleanup(context.register(dirty));
  return context.attention;
}
