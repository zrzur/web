import { untrack } from "solid-js";

import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

import {
  type CommandTarget,
  commandEditor,
  trackCommandTarget,
} from "./commandState";
import { parseCommandOptions, spanAtCursor } from "./commandText";

let active: EditorView | undefined;

/** Ask the editor to draw the chips again */
const refresh = StateEffect.define<null>();

/** What the command bar may do to a message box */
function targetOf(view: EditorView): CommandTarget {
  return {
    refresh: () => view.dispatch({ effects: refresh.of(null) }),
    edit(from, to, insert, cursorAt) {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: cursorAt ?? from + insert.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    move(position) {
      view.dispatch({
        selection: { anchor: Math.min(position, view.state.doc.length) },
        scrollIntoView: true,
      });
      view.focus();
    },
  };
}

function track(view: EditorView) {
  active = view;
  const doc = view.state.doc.toString();
  const head = view.state.selection.main.head;
  // never run Solid effects (which may edit the text) inside an editor update
  queueMicrotask(() => trackCommandTarget(targetOf(view), doc, head));
}

const marks = {
  name: Decoration.mark({ class: "cm-cmd-name" }),
  chip: Decoration.mark({ class: "cm-cmd-opt" }),
  active: Decoration.mark({ class: "cm-cmd-opt cm-cmd-opt-active" }),
  missing: Decoration.mark({ class: "cm-cmd-opt cm-cmd-opt-missing" }),
};

const commandPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      // follow the message box being typed in (or changed by the bar)
      if (
        (update.view.hasFocus || !active || active === update.view) &&
        (update.docChanged || update.selectionSet || update.focusChanged)
      ) {
        track(update.view);
      }
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)))
      ) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      // read on each rebuild; setCommandLayout asks for one
      const current = untrack(commandEditor.layout);
      const doc = view.state.doc.toString();
      if (!current || !doc.startsWith("/") || current.prefix > doc.length) {
        return builder.finish();
      }

      // `/command sub` in bold
      const nameEnd = doc.slice(0, current.prefix).trimEnd().length;
      if (nameEnd > 0) builder.add(0, nameEnd, marks.name);

      const required = new Set(
        current.options.filter((o) => o.required).map((o) => o.name),
      );
      const spans = parseCommandOptions(
        doc,
        current.prefix,
        current.options.map((o) => o.name),
      );
      const here = spanAtCursor(spans, view.state.selection.main.head);
      for (const span of spans) {
        const mark =
          span === here
            ? marks.active
            : current.showMissing && !span.value && required.has(span.name)
              ? marks.missing
              : marks.chip;
        builder.add(span.from, span.nameEnd, mark);
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const commandTheme = EditorView.theme({
  ".cm-cmd-name": {
    fontWeight: 600,
  },
  ".cm-cmd-opt": {
    padding: "1px 4px",
    marginInlineEnd: "2px",
    borderRadius: "6px",
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-input, rgba(255, 255, 255, 0.08))",
  },
  ".cm-cmd-opt-active": {
    color: "var(--z-fg-primary)",
    background: "color-mix(in srgb, var(--z-accent) 26%, transparent)",
  },
  ".cm-cmd-opt-missing": {
    color: "var(--z-danger)",
  },
});

export type { CommandLayout } from "./commandState";

/** Slash command chips in the message box */
export const commandPlugins = [commandPlugin, commandTheme];
