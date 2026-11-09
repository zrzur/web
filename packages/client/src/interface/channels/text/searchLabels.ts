import { useLingui } from "@lingui/solid/macro";

import type { HasValue, SearchKey, SearchProblem } from "./searchSyntax";

/**
 * Localised words for the search filters: the keywords stay English in the
 * box, the chips and hints speak the user's language.
 */
export function useSearchLabels() {
  const { t } = useLingui();

  const key = (key: SearchKey) =>
    ({
      from: t`From`,
      mentions: t`Mentions`,
      has: t`Has`,
      before: t`Before`,
      after: t`After`,
      during: t`On day`,
      in: t`In`,
      pinned: t`Pinned`,
    })[key];

  const hint = (key: SearchKey) =>
    ({
      from: t`Messages from a member`,
      mentions: t`Messages that mention a member`,
      has: t`Messages with a link, file, image, video, embed or sound`,
      before: t`Messages before a day`,
      after: t`Messages after a day`,
      during: t`Messages on a day`,
      in: t`Messages in a channel, across the server`,
      pinned: t`Only pinned messages`,
    })[key];

  const has = (value: HasValue) =>
    ({
      link: t`Link`,
      file: t`File`,
      image: t`Image`,
      video: t`Video`,
      embed: t`Embed`,
      sound: t`Sound`,
    })[value];

  const problem = (problem: SearchProblem) => {
    const value = problem.value;
    switch (problem.reason) {
      case "unknown-user":
        return t`No member called "${value}".`;
      case "unknown-channel":
        return t`No channel called "${value}".`;
      case "bad-date":
        return t`"${value}" is not a day. Write it like 2026-11-09.`;
      case "bad-has":
        return t`has: takes link, file, image, video, embed or sound.`;
      case "bad-pinned":
        return t`pinned: takes true or false.`;
    }
  };

  return { key, hint, has, problem, yes: t`Yes`, no: t`No` };
}
