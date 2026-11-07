import { createSignal } from "solid-js";

import type { AccountAge, Client, MatureAccess } from "@zrzur/sdk/solid";

/**
 * The signed-in account's age information.
 *
 * Zrzur keeps only the year and month of birth, as stated by the user. The
 * server works out the age group and enforces every rule (sign-up, mature
 * channels and Servers, notifications, Discover); this module only mirrors
 * its answer so the app can show the right screen. Nothing here grants access.
 *
 * - `undefined`: not loaded yet
 * - `null`: the server has no age rules
 */
const [accountAge, setAccountAge] = createSignal<AccountAge | null>();

/**
 * "Add your month and year of birth" is closed unless the person opens it.
 *
 * The month and year of birth are asked at the first entry, before anything
 * else (the server refuses every request until then; see the AgeRequired
 * lifecycle state). This prompt stays for the age gate on mature content.
 */
const [agePromptDismissed, setDismissed] = createSignal(true);

/**
 * Close (or open) the age prompt
 * @param dismissed Whether the prompt is closed
 */
function setAgePromptDismissed(dismissed: boolean) {
  setDismissed(dismissed);
}

export { accountAge, agePromptDismissed, setAccountAge, setAgePromptDismissed };

/**
 * Whether mature content may be opened, and if not, why (unknown until the
 * server says otherwise)
 */
export function matureAccess(): MatureAccess {
  return accountAge()?.mature_access ?? "age_unknown";
}

/**
 * Whether content marked as mature may be shown to the signed-in account
 */
export function canViewMature() {
  return matureAccess() === "allowed";
}

/**
 * Whether to show the month and year of birth prompt (only once opened)
 */
export function shouldAskForAge() {
  return accountAge()?.band === "unknown" && !agePromptDismissed();
}

/**
 * Load the age information of the signed-in account
 * @param client Client
 */
export async function refreshAccountAge(client: Client) {
  try {
    setAccountAge(await client.account.fetchAge());
  } catch {
    // stay unknown: the server still enforces the age rules
  }
}

/**
 * Forget the age when signing out
 */
export function resetAccountAge() {
  setAccountAge(undefined);
  setDismissed(true);
}

/**
 * Format a year and month as the `YYYY-MM` value the API expects
 * @param year Full year
 * @param month 1-12
 */
export function toBirthMonth(year: number, month: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * Split a `YYYY-MM` value into year and month
 * @param value Year and month of birth
 */
export function fromBirthMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

/** The youngest age Zrzur allows */
export const MINIMUM_AGE = 16;

/**
 * Whether a `YYYY-MM` birth month is below the minimum age. Only used to ask
 * "are you sure?" before sending it; the server decides.
 * @param value Year and month of birth
 * @param now Current date (for tests)
 */
export function isUnderMinimumAge(value: string, now = new Date()) {
  const { year, month } = fromBirthMonth(value);
  if (!year || !month) return false;
  const born = year * 12 + (month - 1);
  const today = now.getFullYear() * 12 + now.getMonth();
  return born >= today - MINIMUM_AGE * 12;
}

/**
 * Whether the server refused an age because the person is under the minimum
 * (the error arrives as an object or as the JSON text of one)
 * @param error What the API call threw
 */
export function isAgeRefusal(error: unknown) {
  if (!error) return false;
  const text = typeof error === "string" ? error : JSON.stringify(error);
  return typeof text === "string" && text.includes("AgeRequirementNotMet");
}
