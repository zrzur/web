import { createContext, useContext } from "solid-js";

/**
 * Field errors of the surrounding <Form>, shown under each field in the
 * app's own style and language (instead of the browser's pop-up)
 */
export const FieldErrors = createContext<{
  get: (name: string) => string | undefined;
  clear: (name: string) => void;
}>();

/**
 * The problem the surrounding <Form> found with one field, and how to clear
 * it, for controls that draw their own error line (the sign-up consent)
 */
export function useFieldError(name: string) {
  const errors = useContext(FieldErrors);
  return {
    message: () => errors?.get(name),
    clear: () => errors?.clear(name),
  };
}
