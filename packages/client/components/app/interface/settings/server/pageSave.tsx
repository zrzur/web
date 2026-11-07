import {
  type Accessor,
  type JSX,
  createContext,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";

import { SettingsSaveBar } from "@revolt/ui";

/**
 * One save bar per settings page. Each form on the page (profile, rules
 * channel, lobby…) keeps its own save logic and puts a <SaveSlot/> where its
 * own bar used to be; the slot reports the form's state here and the page
 * shows a single bar: "Unsaved changes · Reset · Save changes". Save sends
 * every form that has changes, Reset drops them all.
 */
type PageForm = {
  dirty: Accessor<boolean>;
  saving: Accessor<boolean>;
  error: Accessor<string | undefined>;
  canSave: Accessor<boolean>;
  reset: () => void;
  form: () => HTMLFormElement | undefined;
  /** For parts that are not a <form>: how to save them */
  save?: () => unknown;
};

const PageSaveContext = createContext<{
  add: (form: PageForm) => () => void;
}>();

export function PageSave(props: { children: JSX.Element }) {
  const [forms, setForms] = createSignal<PageForm[]>([]);

  const add = (form: PageForm) => {
    setForms((list) => [...list, form]);
    return () => setForms((list) => list.filter((entry) => entry !== form));
  };

  const dirty = () => forms().filter((form) => form.dirty());

  return (
    <PageSaveContext.Provider value={{ add }}>
      {props.children}
      <SettingsSaveBar
        show={dirty().length > 0}
        saving={forms().some((form) => form.saving())}
        error={forms()
          .map((form) => form.error())
          .find(Boolean)}
        canSave={dirty().every((form) => form.canSave())}
        onReset={() => dirty().forEach((form) => form.reset())}
        onSave={() =>
          dirty().forEach((form) =>
            form.save ? form.save() : form.form()?.requestSubmit(),
          )
        }
      />
    </PageSaveContext.Provider>
  );
}

/**
 * Where a form used to render its own save bar. On a page with a
 * <PageSave/> it joins the page's single bar; anywhere else it is the bar.
 */
export function SaveSlot(props: {
  show: boolean;
  saving?: boolean;
  error?: string;
  canSave?: boolean;
  onReset: () => void;
}) {
  const page = useContext(PageSaveContext);
  if (!page) return <SettingsSaveBar {...props} />;

  let marker: HTMLSpanElement | undefined;
  onCleanup(
    page.add({
      dirty: () => props.show,
      saving: () => !!props.saving,
      error: () => props.error,
      canSave: () => props.canSave !== false,
      reset: () => props.onReset(),
      form: () => marker?.closest("form") ?? undefined,
    }),
  );
  return <span ref={marker} hidden />;
}

/**
 * Join the page's save bar from a part that is not a <form> (it brings its
 * own save function). Returns false when there is no page bar around, so
 * the part keeps its own Save button.
 */
export function usePageSaveRegistration(form: {
  dirty: () => boolean;
  saving: () => boolean;
  error: () => string | undefined;
  reset: () => void;
  save: () => unknown;
}) {
  const page = useContext(PageSaveContext);
  if (!page) return false;
  onCleanup(
    page.add({
      ...form,
      canSave: () => true,
      form: () => undefined,
    }),
  );
  return true;
}
