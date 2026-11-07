/** Longest webhook name, as on the server */
export const WEBHOOK_NAME_MAX = 80;

/** What is wrong with a webhook name, if anything (1 to 80 characters) */
export function webhookNameProblem(name: string): "empty" | "long" | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "empty";
  if ([...trimmed].length > WEBHOOK_NAME_MAX) return "long";
  return undefined;
}
