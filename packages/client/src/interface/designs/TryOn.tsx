import {
  type JSX,
  createContext,
  createMemo,
  createSignal,
  useContext,
} from "solid-js";

import { useLingui } from "@lingui/solid/macro";

import { useStyleLabels } from "@revolt/app/interface/settings/user/profile/StyleEditors";
import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";
import {
  type UserStyle,
  THEME_PRESETS,
  isCommunityRef,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";

import { useAccountGate } from "../../DesignsSite";

import { useFontLabel } from "./Home";
import { sendableStyle } from "./Looks";
import { type Wear, isOn, takenOff } from "./gallery";

const same = (a?: string[], b?: string[]) =>
  (a ?? []).join() === (b ?? []).join();

/** Whether two styles show the same thing */
function sameStyle(a: UserStyle, b: UserStyle) {
  return (
    same(a.theme, b.theme) &&
    (a.name_font ?? "default") === (b.name_font ?? "default") &&
    same(a.name_colour, b.name_colour) &&
    (a.decoration ?? "") === (b.decoration ?? "") &&
    (a.nameplate ?? "") === (b.nameplate ?? "") &&
    (a.effect ?? "") === (b.effect ?? "")
  );
}

/**
 * What you are trying on, kept for the whole of Designs: every tile on every
 * page changes the same mirror. Nothing reaches your profile until you save.
 */
function createTryOn() {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const labels = useStyleLabels();
  const effectLabel = useEffectLabels();
  const fontLabel = useFontLabel();
  const signedIn = useAccountGate();

  const current = () => userStyleOf(client().user) ?? {};
  const [draft, setDraft] = createSignal<UserStyle>({ ...current() });
  // what the pointer rests on: seen on you at once, kept only on a tap
  const [peek, setPeek] = createSignal<Wear>();
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal<UserStyle>();
  const [error, setError] = createSignal<string>();
  const [lastName, setLastName] = createSignal<string>();

  const changed = () => !sameStyle(draft(), current());
  const shown = createMemo(() => ({ ...draft(), ...peek() }));

  function put(wear: Wear) {
    setError(undefined);
    setSaved(undefined);
    setDraft((style) => ({ ...style, ...wear }));
  }

  /** a tap: on, or off again when it is already on */
  function toggle(wear: Wear, name?: string) {
    setPeek(undefined);
    if (isOn(draft(), wear)) {
      put(takenOff(wear));
      setLastName(undefined);
    } else {
      put(wear);
      setLastName(name);
    }
  }

  function reset() {
    setDraft({ ...current() });
    setError(undefined);
    setLastName(undefined);
  }

  async function save() {
    if (!signedIn()) return;
    setSaving(true);
    setError(undefined);
    const before = current();
    try {
      await client().user!.edit({ style: sendableStyle(draft()) });
      setSaved(before);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    const before = saved();
    if (!before) return;
    setDraft({ ...before });
    setSaving(true);
    try {
      await client().user!.edit({ style: sendableStyle(before) });
      setSaved(undefined);
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setSaving(false);
    }
  }

  /** the pieces you have on, each with a way to take it off */
  const parts = createMemo(() => {
    const style = draft();
    const list: { key: string; label: string; clear: Wear }[] = [];
    if (style.decoration)
      list.push({
        key: "decoration",
        label: isCommunityRef(style.decoration)
          ? t`Community decoration`
          : labels.decoration(style.decoration),
        clear: { decoration: undefined, decoration_file: undefined },
      });
    if (style.nameplate)
      list.push({
        key: "nameplate",
        label: labels.nameplate(style.nameplate),
        clear: { nameplate: undefined, nameplate_file: undefined },
      });
    if (style.effect)
      list.push({
        key: "effect",
        label: effectLabel(style.effect),
        clear: { effect: undefined, effect_file: undefined },
      });
    if (style.theme?.length) {
      const preset = THEME_PRESETS.find((p) => same(p.colours, style.theme));
      list.push({
        key: "theme",
        label: preset ? labels.theme(preset.id) : t`Own colours`,
        clear: { theme: undefined },
      });
    }
    if (style.name_font && style.name_font !== "default")
      list.push({
        key: "font",
        label: fontLabel(style.name_font),
        clear: { name_font: undefined },
      });
    if (style.name_colour?.length)
      list.push({
        key: "colour",
        label:
          style.name_colour.length === 2 ? t`Gradient name` : t`Coloured name`,
        clear: { name_colour: undefined },
      });
    return list;
  });

  return {
    current,
    draft,
    shown,
    changed,
    parts,
    saving,
    saved,
    error,
    lastName,
    peek: setPeek,
    put,
    toggle,
    reset,
    save,
    undo,
    /** whether a tile's pieces are on you */
    wearing: (wear: Wear) => isOn(draft(), wear),
  };
}

export type TryOn = ReturnType<typeof createTryOn>;

const Context = createContext<TryOn>();

export function TryOnProvider(props: { children: JSX.Element }) {
  const tryOn = createTryOn();
  return <Context.Provider value={tryOn}>{props.children}</Context.Provider>;
}

export function useTryOn() {
  const tryOn = useContext(Context);
  if (!tryOn) throw new Error("useTryOn outside TryOnProvider");
  return tryOn;
}
