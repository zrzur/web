// Shared by the Discover specs: the listing answers both versions of the page
// are given, and the one sign-in they use. The dev stack has one listed server
// and no bots, so lists, the top row and pictures are fabricated in this
// browser; the page, the login and everything the user does are real.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The app and the site are two origins of one build (see the spec's header) */
export const APP = process.env.E2E_APP ?? "http://localhost:31133";
export const SITE = process.env.E2E_SITE ?? "http://127.0.0.1:31133";
export const API = process.env.E2E_API ?? "http://127.0.0.1:14702";
export const MEDIA = process.env.E2E_MEDIA ?? "http://127.0.0.1:14704";

export const LOCALES = ["ar", "en", "de"];
export const SIZES = [
  { name: "desktop", width: 1366, height: 800 },
  { name: "phone", width: 375, height: 800 },
];

const file = (tag, id) => ({
  _id: id,
  tag,
  filename: `${id}.svg`,
  metadata: { type: "Image", width: 1200, height: 400 },
  content_type: "image/svg+xml",
  size: 1,
});

const server = (
  i,
  name,
  description,
  category,
  language,
  tags,
  members,
  online,
  extra = {},
) => ({
  _id: `01HTESTSERVER${String(i).padStart(13, "0")}`,
  name,
  description,
  category,
  language,
  tags,
  member_count: members,
  online_count: online,
  nsfw: false,
  featured: false,
  link: `mock-${i}`,
  icon: file("icons", `s${i}`),
  ...(i % 4 === 3 ? {} : { banner: file("banners", `s${i}`) }),
  ...extra,
});

const bot = (
  i,
  username,
  description,
  category,
  language,
  tags,
  count,
  extra = {},
) => ({
  _id: `01HTESTB0T${String(i).padStart(16, "0")}`,
  username,
  description,
  category,
  language,
  tags,
  server_count: count,
  featured: false,
  verified: false,
  avatar: file("avatars", `b${i}`),
  ...extra,
});

export const SERVERS = [
  server(
    1,
    "ربع الحارة",
    "سهرات ألعاب كل خميس وجمعة، وقنوات صوتية للعب الجماعي. نلعب ألعاب الورق والطاولة أونلاين، ونرحّب بالمبتدئين.",
    "gaming",
    "ar",
    ["ألعاب", "صوت"],
    18420,
    1240,
    { boost: "MegaBoost", flags: 1 },
  ),
  server(
    2,
    "Lernkreis Berlin",
    "Wir lernen zusammen für Prüfungen, jeden Abend mit Pomodoro-Runden im Sprachkanal.",
    "education",
    "de",
    ["lernen", "uni"],
    5310,
    400,
    { featured: true },
  ),
  server(
    3,
    "مكتبة المساء",
    "نادٍ لقراءة الروايات العربية، كتاب جديد كل شهر ولقاء صوتي في نهايته.",
    "community",
    "ar",
    ["كتب", "قراءة"],
    3120,
    190,
    { featured: true },
  ),
  server(
    4,
    "Pixel Workshop",
    "Pixel art, feedback and weekly jams for people who draw small.",
    "art",
    "en",
    ["pixelart", "jam"],
    9040,
    610,
    { boost: "Boost" },
  ),
  server(
    5,
    "مقام",
    "موسيقى شرقية: عزف، ودروس عود، وتحليل مقامات.",
    "music",
    "ar",
    ["عود"],
    2210,
    95,
  ),
  server(
    6,
    "Rust & Friends",
    "A calm place to ask Rust questions, share crates and review code.",
    "technology",
    "en",
    ["rust", "code"],
    12800,
    950,
  ),
  server(
    7,
    "Dabke United",
    "Fans of football from Damascus to Düsseldorf. Match threads every weekend.",
    "sports",
    "en",
    ["football"],
    4100,
    230,
  ),
  server(
    8,
    "Anime Abend",
    "Wöchentliche Watchpartys und Manga-Tipps auf Deutsch.",
    "anime",
    "de",
    ["anime", "manga"],
    6400,
    310,
  ),
  server(
    9,
    "مختبر العلوم",
    "تجارب منزلية وأسئلة علمية للطلاب والفضوليين.",
    "science",
    "ar",
    ["فيزياء"],
    1890,
    75,
  ),
  server(
    10,
    "Tandem Café",
    "Practise Arabic, English and German with native speakers, in voice and text.",
    "languages",
    "en",
    ["arabic", "tandem"],
    7300,
    420,
  ),
  server(
    11,
    "ليالي السينما",
    "نشاهد فيلماً كل سبت ونتناقش فيه.",
    "entertainment",
    "ar",
    ["أفلام"],
    2600,
    120,
  ),
  server(
    12,
    "Night Owls",
    "For people who are awake when nobody else is.",
    "other",
    "en",
    ["chill"],
    1400,
    65,
  ),
  server(13, "مجلس المبرمجين", "", "technology", "ar", [], 240, undefined),
  server(
    14,
    "Kleine Runde",
    "Ein neuer, kleiner Server für Brettspiele.",
    "gaming",
    "de",
    ["brettspiele"],
    12,
    undefined,
  ),
  // the fullest card: long words in two languages, five long tags
  server(
    16,
    "مجتمع المطوّرين والمصمّمين وصنّاع الألعاب المستقلّين في العالم العربي",
    "مساحة واسعة يلتقي فيها المطوّرون والمصمّمون وصنّاع الألعاب المستقلّون لتبادل الخبرات وعرض مشروعاتهم ومناقشة أحدث الأدوات والأساليب، مع جلسات أسبوعية مفتوحة للمبتدئين والمحترفين على حدّ سواء، ومسابقات شهرية بجوائز رمزية.",
    "gaming",
    "ar",
    [
      "تطوير الألعاب",
      "التصميم الجرافيكي",
      "البرمجة للمبتدئين",
      "المشروعات المفتوحة",
      "المسابقات الشهرية",
    ],
    123456,
    2300,
  ),
  server(
    17,
    "Donaudampfschifffahrtsgesellschaftskapitäne und Gemeinschaftsveranstaltungen",
    "Herzlich willkommen in unserer außerordentlich gemeinschaftsorientierten Entwicklergemeinschaft für Softwarearchitektur, Datenbankverwaltungssysteme und Benutzeroberflächengestaltung mit wöchentlichen Sprechstunden, Veröffentlichungsbesprechungen und Fortbildungsveranstaltungen.",
    "technology",
    "de",
    [
      "Softwareentwicklung",
      "Benutzeroberflächen",
      "Datenbankverwaltung",
      "Fortbildungsangebote",
      "Gemeinschaftsprojekte",
    ],
    654321,
    4100,
  ),
];

export const TOP_ROW = [
  server(
    20,
    "Top Row Tavern",
    "Paid top-row place for the test.",
    "gaming",
    "en",
    ["paid"],
    880,
    40,
    { promoted: true },
  ),
];

export const BOTS = [
  bot(
    1,
    "حارس",
    "يحمي سيرفرك من الرسائل المزعجة والروابط الخطرة. استخدم /تحذير و/حظر و/سجل لإدارة الأعضاء.",
    "moderation",
    "ar",
    ["حماية"],
    4820,
    { featured: true, verified: true, banner: file("banners", "b1") },
  ),
  bot(
    2,
    "Nabra",
    "Plays music in voice channels. Try /play, /skip and /queue.",
    "music",
    "en",
    ["music"],
    3900,
    { boost: "Boost" },
  ),
  bot(
    3,
    "Quizmaster",
    "Trivia nights with /quiz and /score, in three languages.",
    "games",
    "en",
    ["trivia"],
    1450,
  ),
  bot(
    4,
    "Erinnerung",
    "Erinnert deinen Server an Termine mit /remind.",
    "utility",
    "de",
    ["termine"],
    870,
  ),
  bot(5, "نكتة", "ينشر نكتة كل صباح.", "fun", "ar", ["ضحك"], 620),
  bot(
    6,
    "Welcome Mat",
    "Greets new members and hands out roles.",
    "social",
    "en",
    ["roles"],
    2100,
  ),
  // in no server yet: its count takes the most room in the last row
  bot(
    7,
    "Benutzerverwaltungsassistent",
    "Verwaltet Benutzerberechtigungen, Rollenzuweisungen und Willkommensnachrichten für außerordentlich umfangreiche Gemeinschaftsserver, einschließlich regelmäßiger Sicherheitsüberprüfungen und ausführlicher Protokollierung sämtlicher Moderationsentscheidungen.",
    "tools",
    "de",
    [
      "Berechtigungen",
      "Rollenverwaltung",
      "Willkommensnachrichten",
      "Sicherheitsüberprüfung",
      "Protokollierung",
    ],
    0,
  ),
];

const hue = (id) =>
  [...id].reduce((sum, c) => sum + c.charCodeAt(0) * 37, 0) % 360;
const picture = (id) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="1200" height="400" fill="hsl(${hue(id)} 45% 34%)"/></svg>`;

const select = (list, url) => {
  const q = url.searchParams.get("query")?.toLowerCase();
  const category = url.searchParams.get("category");
  const language = url.searchParams.get("language");
  const tag = url.searchParams.get("tag");
  let out = list;
  if (url.searchParams.get("featured") === "true")
    out = out.filter((x) => x.featured);
  if (category) out = out.filter((x) => x.category === category);
  if (language) out = out.filter((x) => x.language === language);
  if (tag) out = out.filter((x) => x.tags.includes(tag));
  if (q)
    out = out.filter((x) =>
      `${x.name ?? x.username} ${x.description} ${x.tags.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 24);
  return out.slice(offset, offset + limit);
};

/** Discover's answers, the same for every page of this browser context */
export async function stubDiscover(context, options = {}) {
  const all = options.realServers ? options.realServers : [];
  // mode: "hold" never answers (loading), "fail" answers 500, "empty" no lists
  // count: that many plain listings; top: that many paid top-row places
  const { mode, billing = true, open = 0, count, top } = options;
  const plain = SERVERS.slice(0, count ?? SERVERS.length).map((item) =>
    count === undefined ? item : { ...item, featured: false, boost: undefined },
  );
  const row =
    top === undefined
      ? TOP_ROW
      : Array.from({ length: top }, (_, i) =>
          server(
            30 + i,
            `Paid ${i + 1}`,
            "A paid place.",
            "gaming",
            "en",
            [],
            100,
            10,
            {
              promoted: true,
            },
          ),
        );
  const servers = mode === "empty" ? [] : [...all, ...plain];
  const bots = mode === "empty" ? [] : BOTS;
  await context.route(`${API}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(body),
      });
    if (request.method() !== "GET") return route.fallback();
    if (path === "/billing/plans")
      return json({ available: billing, checkout_available: false });
    const list = path === "/discover/servers" || path === "/discover/bots";
    if (mode === "hold" && (list || path.startsWith("/discover/promoted")))
      return undefined;
    if (mode === "fail" && list) return json({ type: "InternalError" }, 500);
    if (path === "/discover/promoted")
      return billing && mode !== "empty"
        ? json({ slots: 8, open, servers: row })
        : json({ slots: 0, open: 0, servers: [] });
    if (path === "/discover/promoted/bots")
      return json({ slots: billing ? 3 : 0, open: 0, bots: [] });
    if (path === "/discover/servers") return json(select(servers, url));
    if (path === "/discover/bots") return json(select(bots, url));
    if (path.startsWith("/discover/servers/")) {
      const id = path.split("/")[3];
      const found = [...servers, ...TOP_ROW].find(
        (x) => x._id === id || x.link === id,
      );
      return found ? json(found) : json({ type: "NotFound" }, 404);
    }
    if (path.startsWith("/discover/bots/")) {
      const found = BOTS.find((x) => x._id === path.split("/")[3]);
      return found ? json(found) : json({ type: "NotFound" }, 404);
    }
    if (/^\/bots\/01HTEST/.test(path) && path.endsWith("/invite"))
      return json({
        _id: path.split("/")[2],
        username: "Test bot",
        description: "A test bot.",
        public: true,
        default_permissions: 2 ** 6 + 2 ** 20,
      });
    return route.fallback();
  });
  await context.route(`${MEDIA}/**`, (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[2] ?? "";
    if (!/^[sb]\d+$/.test(id)) return route.fallback();
    return route.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: picture(id),
    });
  });
}

/**
 * Sign in through the real login page and return the browser state. Only the
 * dev-stack accounts file, read at run time; nothing from it is ever printed.
 */
export async function signIn(browser, index = 1) {
  const path =
    process.env.ZRZUR_DEV_ACCOUNTS ??
    fileURLToPath(
      new URL(
        "../../../../../../test-data/dev-stack-accounts.json",
        import.meta.url,
      ),
    );
  const account = JSON.parse(readFileSync(path, "utf8")).accounts[index];
  const context = await browser.newContext({ locale: "en" });
  const page = await context.newPage();
  try {
    await page.goto(`${APP}/login`);
    await page.locator('input[type="email"]').fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    return await context.storageState({ indexedDB: true });
  } finally {
    await context.close();
  }
}

/** The session of the page, for cleaning up after a test. Never printed. */
export const sessionToken = (page) =>
  page.evaluate(
    () =>
      new Promise((done) => {
        const open = indexedDB.open("localforage");
        open.onerror = () => done(undefined);
        open.onsuccess = () => {
          try {
            const db = open.result;
            const get = db
              .transaction("keyvaluepairs")
              .objectStore("keyvaluepairs")
              .get("auth");
            get.onsuccess = () => done(get.result?.session?.token);
            get.onerror = () => done(undefined);
          } catch {
            done(undefined);
          }
        };
      }),
  );

/** Ends the session this run opened, and only that one */
export async function signOut(browser, state, origin = APP) {
  if (!state) return;
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  try {
    // a page still busy from the last test can abort this load: once more
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(`${origin}/login`, { waitUntil: "commit" });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(1500);
    const token = await sessionToken(page);
    if (!token) throw new Error("no session token found: log out by hand");
    const response = await page.request.post(`${API}/auth/session/logout`, {
      headers: { "x-session-token": token },
    });
    if (!response.ok()) throw new Error(`logout answered ${response.status()}`);
  } finally {
    await context.close();
  }
}
