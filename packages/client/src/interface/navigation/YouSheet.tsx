import { Show, Suspense, createSignal, lazy } from "solid-js";

const [open, setOpen] = createSignal(false);
/** the sheet's code is fetched the first time it is opened */
const [wanted, setWanted] = createSignal(false);

const Sheet = lazy(() =>
  import("../You").then((m) => ({ default: m.YouSheet })),
);

/** Phones: open "You" as a sheet over the screen you are on */
export const openYouSheet = () => {
  setWanted(true);
  setOpen(true);
};

/**
 * Where the "You" sheet appears. Mounted once, beside the phone tab bar; it
 * costs nothing until the round button is pressed.
 */
export function YouSheetHost() {
  return (
    <Show when={wanted()}>
      <Suspense>
        <Sheet show={open()} onClose={() => setOpen(false)} />
      </Suspense>
    </Show>
  );
}
