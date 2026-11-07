import { createMemo, createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { LobbyRoleQuestion, Server } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import { Column, SettingsSection } from "@revolt/ui";

import { LobbyRoleQuestionsEditor } from "../LobbyRoleQuestionsEditor";
import { SaveSlot } from "../pageSave";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Equal as saved: the server sends `null` where the draft has no value */
const same = (a: unknown, b: unknown) => {
  const flat = (value: unknown) =>
    JSON.stringify(value, (_key, item) => (item === null ? undefined : item));
  return flat(a) === flat(b);
};

/**
 * Roles by interest: the questions new members see in a window when they
 * first open the server (and from the server menu after that).
 */
export function RoleQuestions(props: { server: Server }) {
  const { t } = useLingui();
  const describeError = useError();

  const [draft, setDraft] = createStore<{ questions: LobbyRoleQuestion[] }>({
    // eslint-disable-next-line solid/reactivity
    questions: copy(props.server.lobby?.onboarding ?? []),
  });
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [showErrors, setShowErrors] = createSignal(false);

  const dirty = createMemo(
    () =>
      // read through the store (not unwrap) so every field is tracked:
      // reconcile edits the questions in place
      same(draft.questions, props.server.lobby?.onboarding ?? []) === false,
  );

  const invalid = () =>
    draft.questions.some(
      (q) =>
        !q.question.trim() ||
        !q.options.length ||
        q.options.some(
          (o) => !o.label.trim() || !o.role || !props.server.roles.has(o.role),
        ),
    );

  async function save() {
    if (saving() || !dirty()) return;
    if (invalid()) {
      setShowErrors(true);
      setError(
        t`Complete every role question and choose a role for each answer.`,
      );
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const lobby = props.server.lobby;
      const onboarding = copy(unwrap(draft.questions)).map((q) => ({
        ...q,
        question: q.question.trim(),
        description: q.description?.trim() || undefined,
        options: q.options.map((o) => ({ ...o, label: o.label.trim() })),
      }));
      await props.server.edit({
        // only the questions change; the rest of the lobby stays as it is
        lobby: {
          ...copy(lobby ?? {}),
          enabled: lobby?.enabled ?? false,
          onboarding,
        },
      });
      // what was saved is now the draft (the server object may not have
      // received the update yet, and reading it back would undo the edit)
      setDraft("questions", reconcile(copy(onboarding), { key: "id" }));
      setShowErrors(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(
      "questions",
      reconcile(copy(props.server.lobby?.onboarding ?? [])),
    );
    setShowErrors(false);
    setError(undefined);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Column gap="xl">
        <SettingsSection
          title={<Trans>Roles by interest</Trans>}
          description={
            <Trans>
              New members answer these in a window when they first open the
              server, and get each answer's role right away. They can skip it
              and change their answers later from the server menu.
            </Trans>
          }
        >
          <LobbyRoleQuestionsEditor
            server={props.server}
            questions={draft.questions}
            showErrors={showErrors()}
            onChange={(value) =>
              setDraft("questions", reconcile(value, { key: "id" }))
            }
          />
        </SettingsSection>

        <SaveSlot
          show={dirty()}
          saving={saving()}
          error={error()}
          onReset={reset}
        />
      </Column>
    </form>
  );
}
