import type { API } from "@zrzur/sdk/solid";

/** One rule: a role, member or channel, allowed or denied */
export type Rule = API.CommandPermission;
export type RuleType = API.CommandPermissionType;

/**
 * Id used in the editor's target menu for "everyone" / "every channel";
 * the API uses the server id for both
 */
export const EVERYONE = "everyone";

/** Add a rule, replacing the one for the same target */
export function setRule(rules: Rule[], rule: Rule): Rule[] {
  const index = rules.findIndex(
    (entry) => entry.type === rule.type && entry.id === rule.id,
  );
  if (index < 0) return [...rules, rule];
  return rules.map((entry, i) => (i === index ? rule : entry));
}

/** Take one rule out */
export function removeRule(rules: Rule[], type: RuleType, id: string) {
  return rules.filter((entry) => !(entry.type === type && entry.id === id));
}

const ORDER: Record<RuleType, number> = { Role: 1, Member: 2, Channel: 3 };

/** Everyone and every channel first, then roles, members and channels */
export function sortRules(rules: Rule[], serverId: string): Rule[] {
  const rank = (rule: Rule) =>
    rule.id === serverId ? ORDER[rule.type] / 10 : ORDER[rule.type];
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => rank(a.rule) - rank(b.rule) || a.index - b.index)
    .map((entry) => entry.rule);
}
