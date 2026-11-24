import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useDate } from "../profile/CommunityParts";

import { Checklist, ErrorText } from "./parts";
import { ProgramEligibility, ProgramId } from "./programsApi";
import { useProgramText } from "./useProgramText";

/**
 * The checklist the server measured for one program and one server, bot or
 * person, in the reader's language: met, not met, or checked by a person;
 * and why applying is blocked, if it is. Used by the apply dialog and by
 * Server settings → Verified Server.
 */
export function ProgramChecklist(props: {
  program: ProgramId;
  eligibility: ProgramEligibility;
}) {
  const words = useProgramText();
  const date = useDate();
  return (
    <>
      <Checklist role="list">
        <For each={props.eligibility.checks}>
          {(line) => (
            <li
              role="listitem"
              data-check={line.code}
              data-met={line.met === undefined ? "person" : String(line.met)}
            >
              <span aria-hidden="true">
                {line.met === undefined ? "•" : line.met ? "✓" : "✕"}
              </span>
              <span>
                {words.check(line, props.program)}
                <Show
                  when={line.met === undefined && line.code !== "retention"}
                >
                  {" · "}
                  <Trans>a person checks it</Trans>
                </Show>
              </span>
            </li>
          )}
        </For>
      </Checklist>
      <Show when={props.eligibility.blocked}>
        <ErrorText role="status">
          {words.failure(props.eligibility.blocked)}
          <Show when={props.eligibility.blocked_until}>
            {" "}
            <Trans>
              You can apply again from {date(props.eligibility.blocked_until)}.
            </Trans>
          </Show>
        </ErrorText>
      </Show>
    </>
  );
}
