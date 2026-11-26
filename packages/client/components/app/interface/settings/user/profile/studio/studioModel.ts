import {
  type CommunityItem,
  type CommunityKind,
  type CommunityRightsInput,
  type CommunityStatus,
  COMMUNITY_MAX_BYTES,
  COMMUNITY_MAX_DIMENSION,
  CREATOR_TERMS_VERSION,
  EFFECT_MAX_BYTES,
  kindOf,
} from "../communityApi";

// relative, so unit tests run without the app aliases
import { FRAME_FILE } from "../../../../../../ui/components/features/profiles/frames/communityFrame";

/** The tabs of the studio home */
export type StudioFilter =
  | "all"
  | "drafts"
  | "review"
  | "attention"
  | "published"
  | "withdrawn";

export const STUDIO_FILTERS: StudioFilter[] = [
  "all",
  "drafts",
  "review",
  "attention",
  "published",
  "withdrawn",
];

/** States a creator has to act on: sent back, refused, or taken down */
const ATTENTION: readonly CommunityStatus[] = [
  "ChangesRequested",
  "Rejected",
  "Suspended",
];

/**
 * The state a design is listed under. A published design with a new version
 * in the works is shown by that version's state: that is what the creator is
 * busy with.
 */
export function shownStatus(item: CommunityItem): CommunityStatus {
  return item.status === "Published" && item.pending
    ? (item.pending.status as CommunityStatus)
    : (item.status as CommunityStatus);
}

/** Which tabs a design belongs in (besides "all") */
export function filtersOf(item: CommunityItem): StudioFilter[] {
  const tabs: StudioFilter[] = [];
  const add = (status: CommunityStatus) => {
    if (status === "Draft") tabs.push("drafts");
    else if (status === "PendingReview") tabs.push("review");
    else if (ATTENTION.includes(status)) tabs.push("attention");
    else if (status === "Published") tabs.push("published");
    else if (status === "Archived") tabs.push("withdrawn");
  };
  add(item.status as CommunityStatus);
  if (item.status === "Published" && item.pending)
    add(item.pending.status as CommunityStatus);
  return [...new Set(tabs)];
}

/** How many designs each tab holds */
export function studioCounts(items: CommunityItem[]) {
  const counts: Record<StudioFilter, number> = {
    all: items.length,
    drafts: 0,
    review: 0,
    attention: 0,
    published: 0,
    withdrawn: 0,
  };
  for (const item of items) for (const tab of filtersOf(item)) counts[tab]++;
  return counts;
}

/** The note a reviewer left on what the creator is working on */
export function reviewNote(item: CommunityItem) {
  return (
    (item.status === "Published" && item.pending
      ? item.pending.review_note
      : undefined) ??
    item.review_note ??
    undefined
  );
}

/** The designs that wait for the creator, newest first as the server sent them */
export function needsAttention(items: CommunityItem[]) {
  return items.filter((item) => filtersOf(item).includes("attention"));
}

const fold = (text: string) =>
  text
    .normalize("NFKD")
    // Arabic marks and Latin accents: "ورد" finds "وَرْد", "cafe" finds "café"
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .toLowerCase();

/** The list under a tab, a type and a search */
export function studioList(
  items: CommunityItem[],
  filter: StudioFilter,
  kind: CommunityKind | "all",
  query: string,
) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filter !== "all" && !filtersOf(item).includes(filter)) return false;
    if (kind !== "all" && kindOf(item) !== kind) return false;
    if (!words.length) return true;
    const text = fold(
      [
        item.name,
        item.pending?.name,
        item.description,
        ...(item.tags ?? []),
      ].join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}

/** What a design can do next, for the creator */
export function actionsOf(item: CommunityItem, readOnly: boolean) {
  const status = item.status as CommunityStatus;
  const shown = shownStatus(item);
  const none = {
    edit: false,
    publish: false,
    withdraw: false,
    restore: false,
    remove: false,
    download: true,
  };
  if (readOnly) return none;
  return {
    edit: status !== "Suspended" && status !== "Archived",
    // something saved and not yet sent
    publish:
      shown === "Draft" || shown === "ChangesRequested" || shown === "Rejected",
    withdraw: status !== "Archived" && status !== "Suspended",
    restore: status === "Archived",
    // anything they publish, they can delete (owner, 2026-11-25); a design
    // a reviewer took down stays until the review is over
    remove: status !== "Suspended",
    download: true,
  };
}

/* ------------------------------------------------------------------ */
/* The six steps                                                       */
/* ------------------------------------------------------------------ */

export const STUDIO_STEPS = [
  "type",
  "file",
  "preview",
  "details",
  "rights",
  "send",
] as const;

export type StudioStep = (typeof STUDIO_STEPS)[number];

/** What the creator answers on the rights step */
export type RightsAnswers = {
  /** made it myself, or hold a licence to share it */
  own?: "mine" | "licensed";
  /** parts made by others */
  others?: boolean;
  othersText: string;
  /** parts made with AI tools */
  ai?: boolean;
  aiText: string;
  /** the box: true, no real person, Creator Terms accepted */
  confirmed: boolean;
};

export const emptyRights = (): RightsAnswers => ({
  othersText: "",
  aiText: "",
  confirmed: false,
});

/** Someone else's work needs its source named */
const needsSource = (answers: RightsAnswers) =>
  answers.own === "licensed" || answers.others === true;

/** What is still missing on the rights step, in the order it is asked */
export function rightsMissing(
  answers: RightsAnswers,
): ("own" | "others" | "othersText" | "ai" | "aiText" | "confirmed")[] {
  const missing: ReturnType<typeof rightsMissing> = [];
  if (!answers.own) missing.push("own");
  if (answers.own !== "licensed" && answers.others === undefined)
    missing.push("others");
  if (needsSource(answers) && answers.othersText.trim().length < 3)
    missing.push("othersText");
  if (answers.ai === undefined) missing.push("ai");
  if (answers.ai && answers.aiText.trim().length < 2) missing.push("aiText");
  if (!answers.confirmed) missing.push("confirmed");
  return missing;
}

/** The promise as the server stores it; only when nothing is missing */
export function rightsInput(
  answers: RightsAnswers,
): CommunityRightsInput | undefined {
  if (rightsMissing(answers).length) return undefined;
  return {
    confirmed: true,
    terms_version: CREATOR_TERMS_VERSION,
    third_party: needsSource(answers)
      ? answers.othersText.trim().slice(0, 280)
      : undefined,
    ai_parts: answers.ai ? answers.aiText.trim().slice(0, 280) : undefined,
  };
}

/** Answers to show for a promise the server already holds */
export function rightsFromStored(
  stored:
    | { third_party?: string | null; ai_parts?: string | null }
    | undefined
    | null,
): RightsAnswers {
  if (!stored) return emptyRights();
  return {
    // never answered for them: "I made it" is theirs to say each time (L-43)
    own: undefined,
    others: !!stored.third_party,
    othersText: stored.third_party ?? "",
    ai: !!stored.ai_parts,
    aiText: stored.ai_parts ?? "",
    // a box is never ticked for them
    confirmed: false,
  };
}

/** What the editor knows, as far as the steps care */
export type StepFacts = {
  kind?: CommunityKind;
  /** a file on the canvas, or the stored one of a design being edited */
  hasImage: boolean;
  /** a check of the file failed (not a warning) */
  fileRefused: boolean;
  name: string;
  rights: RightsAnswers;
  /** the stored promise still covers this version (no new file) */
  rightsKept: boolean;
};

/** Whether a step is finished */
export function stepDone(step: StudioStep, facts: StepFacts) {
  switch (step) {
    case "type":
      return !!facts.kind;
    case "file":
    case "preview":
      return facts.hasImage && !facts.fileRefused;
    case "details":
      return facts.name.trim().length >= 2;
    case "rights":
      return facts.rightsKept || rightsMissing(facts.rights).length === 0;
    case "send":
      return false;
  }
}

/** The first step that is not finished; "send" when all are */
export function firstOpenStep(facts: StepFacts): StudioStep {
  return STUDIO_STEPS.find((step) => !stepDone(step, facts)) ?? "send";
}

/** A step can be opened when every step before it is finished */
export function stepOpen(step: StudioStep, facts: StepFacts) {
  const index = STUDIO_STEPS.indexOf(step);
  return STUDIO_STEPS.slice(0, index).every((before) =>
    stepDone(before, facts),
  );
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

/** What each type asks of its file: the numbers shown and checked */
export const STUDIO_SPECS: Record<
  CommunityKind,
  {
    width: number;
    height: number;
    maxBytes: number;
    /** an effect has to move; the others may */
    mustMove: boolean;
    maxSeconds: number;
  }
> = {
  decorations: {
    width: COMMUNITY_MAX_DIMENSION,
    height: COMMUNITY_MAX_DIMENSION,
    maxBytes: COMMUNITY_MAX_BYTES,
    mustMove: false,
    maxSeconds: 12,
  },
  nameplates: {
    width: COMMUNITY_MAX_DIMENSION,
    height: 192,
    maxBytes: COMMUNITY_MAX_BYTES,
    mustMove: false,
    maxSeconds: 12,
  },
  effects: {
    width: 576,
    height: COMMUNITY_MAX_DIMENSION,
    maxBytes: EFFECT_MAX_BYTES,
    mustMove: true,
    maxSeconds: 4,
  },
  // a picture of exactly this size (`FRAME_FILE`), still or moving
  frames: {
    width: FRAME_FILE.width,
    height: FRAME_FILE.height,
    maxBytes: COMMUNITY_MAX_BYTES,
    mustMove: false,
    maxSeconds: 0,
  },
};
