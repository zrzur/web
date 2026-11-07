import type { AutoModRule, AutoModTrigger } from "@zrzur/sdk/solid";

export type TriggerType = AutoModTrigger["type"];

export const TRIGGER_TYPES: TriggerType[] = [
  "Keywords",
  "MentionSpam",
  "LinkSpam",
  "RepeatedMessages",
];

/** Most rules a server may have (the server refuses more) */
export const MAX_RULES = 10;

/** Fixed id: the optional list shows as switched on when this rule exists */
export const INSULTS_RULE_ID = "preset-arabic-insults";

/** Words that left the platform list: each server decides about them */
export const INSULT_WORDS = ["يا كلب", "يا حمار", "عاهرة"];

/** The optional list as an ordinary rule, which the owner can then edit */
export function insultsRule(name: string): AutoModRule {
  return {
    ...newRule("Keywords", []),
    id: INSULTS_RULE_ID,
    name,
    trigger: { type: "Keywords", words: [...INSULT_WORDS], allow: [] },
  };
}

/** A list typed one per line or separated by commas */
export function parseList(text: string): string[] {
  return text
    .split(/[\n,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatList(items?: string[]): string {
  return (items ?? []).join("\n");
}

/** The trigger a new rule of this type starts with */
export function defaultTrigger(type: TriggerType): AutoModTrigger {
  switch (type) {
    case "Keywords":
      return { type, words: [], allow: [] };
    case "MentionSpam":
      return { type, max: 5 };
    case "LinkSpam":
      return { type, new_member_minutes: 10, allowed_domains: [] };
    case "RepeatedMessages":
      return { type, channels: 3, seconds: 30 };
  }
}

/** A new rule with a free id */
export function newRule(
  type: TriggerType,
  existing: AutoModRule[],
): AutoModRule {
  let n = existing.length + 1;
  while (existing.some((rule) => rule.id === `rule${n}`)) n++;
  return {
    id: `rule${n}`,
    name: "",
    enabled: true,
    trigger: defaultTrigger(type),
    actions: { block: true },
    exempt_roles: [],
    exempt_channels: [],
  };
}

/** Why a draft can't be saved yet, or undefined when it can */
export function draftProblem(
  rule: AutoModRule,
): "name" | "words" | "number" | "links" | "action" | undefined {
  if (!rule.name.trim()) return "name";
  const trigger = rule.trigger;
  if (trigger.type === "Keywords" && !trigger.words.length) return "words";
  if (
    trigger.type === "MentionSpam" &&
    !(trigger.max >= 1 && trigger.max <= 50)
  )
    return "number";
  if (
    trigger.type === "RepeatedMessages" &&
    !(
      trigger.channels >= 2 &&
      trigger.channels <= 20 &&
      trigger.seconds >= 1 &&
      trigger.seconds <= 3600
    )
  )
    return "number";
  if (
    trigger.type === "LinkSpam" &&
    !trigger.new_member_minutes &&
    !trigger.allowed_domains?.length
  )
    return "links";
  const actions = rule.actions;
  if (!actions.block && !actions.alert_channel && !actions.timeout_minutes)
    return "action";
  return undefined;
}

/** Replace or add a rule, keeping the order */
export function upsertRule(rules: AutoModRule[], rule: AutoModRule) {
  return rules.some((entry) => entry.id === rule.id)
    ? rules.map((entry) => (entry.id === rule.id ? rule : entry))
    : [...rules, rule];
}
