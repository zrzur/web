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
      from: t({ message: "From", context: "search filter" }),
      mentions: t({ message: "Mentions", context: "search filter" }),
      has: t({ message: "Has", context: "search filter" }),
      before: t({ message: "Before", context: "search filter" }),
      after: t({ message: "After", context: "search filter" }),
      during: t({ message: "On day", context: "search filter" }),
      in: t({ message: "In", context: "search filter" }),
      pinned: t({ message: "Pinned", context: "search filter" }),
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
      link: t({ message: "Link", context: "search filter" }),
      file: t({ message: "File", context: "search filter" }),
      image: t({ message: "Image", context: "search filter" }),
      video: t({ message: "Video", context: "search filter" }),
      embed: t({ message: "Embed", context: "search filter" }),
      sound: t({ message: "Sound", context: "search filter" }),
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
      case "one-only":
        return t`Only one mentions: filter is used, so "${value}" was left out.`;
      case "too-many":
        return problem.key === "in"
          ? t`Up to 50 in: filters are used, so "${value}" was left out.`
          : t`Up to 10 from: filters are used, so "${value}" was left out.`;
      case "no-server":
        return t`in: works in servers only.`;
    }
  };

  return { key, hint, has, problem, yes: t`Yes`, no: t`No` };
}
