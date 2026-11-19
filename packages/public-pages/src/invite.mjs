import { plainDescription } from "./plainText.mjs";

/**
 * Invite links (SITE=invite, the app's own host): `/invite/{code}` gets the
 * server's name, picture and description in its head, so a link pasted in
 * another chat app shows the server instead of the app's general text.
 *
 * What a preview may show is what the invite page shows to anyone with the
 * link: name, picture, banner, description and a rounded member count. Never
 * who made the invite, never a message. A mature server gives its name only.
 * Invite pages are never for search engines: `noindex` on every one.
 */

/** Codes as the short-link host accepts them (`zrzur.cc/{code}`) */
const CODE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

/** The invite code of a path, or undefined when the path is not an invite */
export function inviteCode(path) {
  const match = /^\/invite\/([^/]+)\/?$/.exec(path);
  return match && match[1].length <= 64 && CODE.test(match[1])
    ? match[1]
    : undefined;
}

/** The code behind `/og/invite/{code}.png` */
export function inviteImageCode(path) {
  const match = /^\/og\/invite\/([^/]+)\.png$/.exec(path);
  return match && match[1].length <= 64 && CODE.test(match[1])
    ? match[1]
    : undefined;
}

/** Bit 4 of a server's flags marks it as mature on some instances; the
 * invite answer has no such field, so only what the API marks is trusted */
const isMature = (data) => data?.server_nsfw === true;

/**
 * The server of an invite as the preview image draws it, or null when the
 * answer is not a server invite
 */
export function inviteCard(data) {
  if (!data || data.type !== "Server") return null;
  const mature = isMature(data);
  return {
    _id: data.server_id,
    name: data.server_name,
    description: mature ? "" : (data.server_description ?? ""),
    icon: mature ? undefined : data.server_icon,
    banner: mature ? undefined : data.server_banner,
    member_count: data.member_count ?? 0,
  };
}

const TEXT = {
  en: {
    site: "Zrzur",
    join: (name) => `Join ${name} on Zrzur`,
    about: (name, members) =>
      `${members} members. Open the link to see ${name} and join.`,
    members: (members) => `${members} members`,
    ended: "This invite link has ended",
    endedAbout: "Ask the person who sent it for a new one.",
  },
  ar: {
    site: "زرزور",
    join: (name) => `انضم إلى ${name} في زرزور`,
    about: (name, members) =>
      `الأعضاء: ${members}. افتح الرابط لترى ${name} وتنضم.`,
    members: (members) => `الأعضاء: ${members}`,
    ended: "انتهى رابط الدعوة هذا",
    endedAbout: "اطلب رابطًا جديدًا ممن أرسله إليك.",
  },
  de: {
    site: "Zrzur",
    join: (name) => `Tritt ${name} auf Zrzur bei`,
    about: (name, members) =>
      `${members} Mitglieder. Öffne den Link, um ${name} zu sehen und beizutreten.`,
    members: (members) => `${members} Mitglieder`,
    ended: "Dieser Einladungslink ist abgelaufen",
    endedAbout: "Bitte die Person, die ihn geschickt hat, um einen neuen.",
  },
};
const LOCALE = { en: "en_US", ar: "ar_AR", de: "de_DE" };

/** Arabic for a name written in Arabic letters, otherwise English */
const languageOf = (lang, name) =>
  TEXT[lang] ? lang : /[؀-ۿ]/.test(name ?? "") ? "ar" : "en";

const clip = (text, max = 160) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** A member count as a preview says it: exact below 100, rounded above */
export function roughMembers(count) {
  const n = Math.max(0, Math.floor(count ?? 0));
  if (n < 100) return String(n);
  if (n < 1000) return `${Math.floor(n / 10) * 10}+`;
  return `${Math.floor(n / 100) / 10}k+`.replace(".0k", "k");
}

/**
 * The head of an invite page
 * @param input.origin https://app.zrzur.com
 * @param input.code the invite code
 * @param input.lang the ?hl= language, if any
 * @param input.data what `GET /invites/{code}` answered (null: no such link)
 */
export function inviteMeta({ origin, code, lang, data }) {
  const card = inviteCard(data);
  const language = languageOf(lang, card?.name);
  const text = TEXT[language];
  const canonical = `${origin}/invite/${code}`;
  const members = roughMembers(card?.member_count);
  const about = card ? plainDescription(card.description) : "";

  return {
    lang: language,
    dir: language === "ar" ? "rtl" : "ltr",
    title: card ? text.join(card.name) : text.ended,
    description: card
      ? clip(
          about
            ? `${text.members(members)} · ${about}`
            : text.about(card.name, members),
        )
      : text.endedAbout,
    canonical,
    alternates: [],
    image: card
      ? `${origin}/og/invite/${encodeURIComponent(code)}.png`
      : `${origin}/og/site.png`,
    siteName: text.site,
    locale: LOCALE[language],
    type: "website",
    // a dead link is still the app's page (it says so itself), not a 404
    status: 200,
    noindex: true,
  };
}
