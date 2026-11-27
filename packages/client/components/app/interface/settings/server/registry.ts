/**
 * Server settings pages and their sections: the one place that knows which
 * page a section is on, which old page ids still work, and the words the
 * settings search finds each section by (in all three languages, so people
 * find it however they type).
 */

export type PageId =
  | "overview"
  | "features"
  | "channels"
  | "emoji"
  | "soundboard"
  | "insights"
  | "members"
  | "roles"
  | "invites"
  | "joining"
  | "lobby"
  | "discovery"
  | "safety"
  | "log"
  | "apps"
  | "wings";

/**
 * Page ids and addresses from before. The long pages of 2026-11 were split
 * into one page per topic on 2026-11-27, then the pages of one block were
 * folded back into fuller ones the same day (owner: a page of two words is
 * not a page). Each old address opens its new place ("page",
 * "page#section" or "page/sub-view").
 */
export const ALIASES: Record<string, string> = {
  // the one-topic pages of 2026-11-27, folded into fuller pages the same day
  access: "joining",
  "access#join-mode": "joining",
  "access#verification": "joining#verification",
  "access/requests": "joining/requests",
  newcomers: "joining#rules",
  "newcomers#rules": "joining#rules",
  "newcomers#on-join": "joining#on-join",
  "newcomers#questions": "joining#questions",
  bans: "members#bans",
  emergency: "safety",
  "emergency#emergency": "safety",
  filters: "safety#filters",
  danger: "overview#danger",
  // the long pages from before
  "joining#join-mode": "joining",
  "joining#lobby": "lobby",
  "joining/lobby": "lobby",
  rules: "joining#rules",
  "safety#emergency": "safety",
  "overview#discovery": "discovery",
  "overview#verified-server": "discovery#verified-server",
  "overview#invites": "invites",
  "overview#features": "features",
  "overview#threads": "features#threads",
  "overview#events": "features#events",
  "overview#tickets": "features#tickets",
  "members#invites": "invites#invite-list",
  // older names still in links and notes
  events: "features#events",
  discover: "discovery",
  emojis: "emoji",
  sounds: "soundboard",
  "emoji#soundboard": "soundboard",
  privacy: "joining",
  join_requests: "joining/requests",
  requests: "joining/requests",
  notices: "features",
  verification: "joining#verification",
  autorole: "joining#on-join",
  welcome: "joining#on-join",
  audit: "log",
  stats: "insights",
  analytics: "insights",
  bots: "apps#bots",
  webhooks: "apps#webhooks",
  ownership: "overview#danger",
  profile: "overview",
};

/** The address an id (new or old) stands for */
export function resolvePage(id: string): string {
  return ALIASES[id] ?? id;
}

/** Split "page#section" into its parts */
export function splitAddress(address: string): {
  page: string;
  section?: string;
} {
  const [page, section] = address.split("#");
  return { page, section: section || undefined };
}

type Words = { en: string; ar: string; de: string };

export type SectionInfo = {
  id: string;
  page: PageId;
  /** Words in all three languages: name of the section and its fields */
  words: Words;
};

/** Every section, in page order */
export const SECTIONS: SectionInfo[] = [
  {
    id: "profile",
    page: "overview",
    words: {
      en: "server profile name icon banner picture description preview",
      ar: "ملف السيرفر الاسم الأيقونة الشعار الغلاف الصورة الوصف معاينة",
      de: "serverprofil name symbol icon banner bild beschreibung vorschau",
    },
  },
  {
    id: "discovery",
    page: "discovery",
    words: {
      en: "discovery discover listing category language tags public list",
      ar: "الاكتشاف اكتشف إدراج الفئة اللغة الوسوم العلامات قائمة عامة",
      de: "entdecken discover eintrag kategorie sprache tags öffentlich liste",
    },
  },
  {
    id: "invites",
    page: "invites",
    words: {
      en: "custom invite link vanity short link sharing",
      ar: "رابط دعوة مخصص رابط قصير مشاركة",
      de: "eigener einladungslink kurzlink teilen",
    },
  },
  {
    id: "features",
    page: "features",
    words: {
      en: "features rules channel system messages join leave kick ban welcome counters notices",
      ar: "الميزات قناة القواعد رسائل النظام انضمام مغادرة طرد حظر ترحيب عدادات إشعارات",
      de: "funktionen regelkanal systemnachrichten beitritt austritt kick bann willkommen zähler hinweise",
    },
  },
  {
    id: "threads",
    page: "features",
    words: {
      en: "threads forums posts switch on off disable",
      ar: "الخيوط المنتديات المنشورات تشغيل إيقاف تعطيل",
      de: "threads foren beiträge einschalten ausschalten deaktivieren",
    },
  },
  {
    id: "events",
    page: "features",
    words: {
      en: "events scheduled lobby welcome page switch on off channel list",
      ar: "الفعاليات الأحداث المجدولة الردهة صفحة الترحيب تشغيل إيقاف قائمة القنوات",
      de: "events veranstaltungen termine lobby willkommensseite einschalten ausschalten kanalliste",
    },
  },
  {
    id: "tickets",
    page: "features",
    words: {
      en: "tickets support private channel staff help desk",
      ar: "التذاكر الدعم قناة خاصة الفريق المساعدة",
      de: "tickets support privater kanal team hilfe",
    },
  },
  {
    id: "verified-server",
    page: "discovery",
    words: {
      en: "verified server official badge apply check",
      ar: "سيرفر موثق رسمي شارة تقديم تحقق",
      de: "verifizierter server offiziell abzeichen bewerben prüfung",
    },
  },
  {
    id: "notifications",
    page: "overview",
    words: {
      en: "default notifications all messages mentions only notify members",
      ar: "الإشعارات الافتراضية كل الرسائل الإشارات فقط تنبيه الأعضاء",
      de: "standard benachrichtigungen alle nachrichten nur erwähnungen mitglieder",
    },
  },
  {
    id: "danger",
    page: "overview",
    words: {
      en: "danger zone transfer ownership owner delete server",
      ar: "منطقة الخطر نقل الملكية المالك حذف السيرفر",
      de: "gefahrenbereich besitz übertragen inhaber server löschen",
    },
  },
  {
    id: "insights",
    page: "insights",
    words: {
      en: "insights statistics stats growth joins leaves messages activity active members voice charts",
      ar: "الإحصاءات إحصائيات النمو المنضمون المغادرون الرسائل النشاط الأعضاء النشطون الصوت رسوم بيانية",
      de: "statistiken einblicke wachstum beitritte austritte nachrichten aktivität aktive mitglieder sprache diagramme",
    },
  },
  {
    id: "channels",
    page: "channels",
    words: {
      en: "channels categories text voice slow mode room size order delete",
      ar: "القنوات الفئات نصية صوتية الوضع البطيء حجم الغرفة ترتيب حذف",
      de: "kanäle kategorien text sprache langsammodus raumgröße reihenfolge löschen",
    },
  },
  {
    id: "rules",
    page: "joining",
    words: {
      en: "rules accept screening agree",
      ar: "القواعد قبول الموافقة",
      de: "regeln akzeptieren zustimmen",
    },
  },
  {
    id: "join-mode",
    page: "joining",
    words: {
      en: "who can join access public private locked approval requests members can invite",
      ar: "من يمكنه الانضمام الوصول عام خاص مقفل الموافقة طلبات يمكن للأعضاء الدعوة",
      de: "wer beitreten darf zugang öffentlich privat gesperrt genehmigung anfragen mitglieder einladen",
    },
  },
  {
    id: "verification",
    page: "joining",
    words: {
      en: "verification level email age account new members",
      ar: "التحقق مستوى البريد الإلكتروني عمر الحساب أعضاء جدد",
      de: "überprüfung verifizierung stufe e-mail kontoalter neue mitglieder",
    },
  },
  {
    id: "on-join",
    page: "joining",
    words: {
      en: "when someone joins automatic roles auto role everyone welcome message greeting new members",
      ar: "عند الانضمام أدوار تلقائية دور تلقائي الجميع رسالة الترحيب تحية أعضاء جدد",
      de: "beim beitritt automatische rollen auto rolle alle willkommensnachricht begrüßung neue mitglieder",
    },
  },
  {
    id: "questions",
    page: "joining",
    words: {
      en: "welcome questions interests roles onboarding answers",
      ar: "أسئلة الترحيب الاهتمامات الأدوار الإجابات",
      de: "willkommensfragen interessen rollen antworten onboarding",
    },
  },
  {
    id: "lobby",
    page: "lobby",
    words: {
      en: "lobby design colours layout greeting buttons faq tagline about sections channels",
      ar: "الردهة التصميم الألوان التخطيط التحية الأزرار أسئلة شائعة نبذة الأقسام",
      de: "lobby design farben layout begrüßung schaltflächen faq slogan über abschnitte",
    },
  },
  {
    id: "emoji",
    page: "emoji",
    words: {
      en: "emoji custom upload name delete slots",
      ar: "إيموجي رموز تعبيرية مخصصة رفع اسم حذف",
      de: "emoji eigene hochladen name löschen plätze",
    },
  },
  {
    id: "soundboard",
    page: "soundboard",
    words: {
      en: "soundboard sounds audio upload play voice call",
      ar: "لوحة الأصوات أصوات صوت رفع تشغيل مكالمة صوتية",
      de: "soundboard sounds töne hochladen abspielen sprachanruf",
    },
  },
  {
    id: "emergency",
    page: "safety",
    words: {
      en: "emergency pause invites direct messages raid",
      ar: "طوارئ إيقاف الدعوات الرسائل الخاصة غارة",
      de: "notfall pausieren einladungen direktnachrichten raid",
    },
  },
  {
    id: "filters",
    page: "safety",
    words: {
      en: "filters automod spam words links mentions repeated messages rules",
      ar: "المرشحات الإشراف التلقائي رسائل مزعجة كلمات روابط إشارات رسائل مكررة",
      de: "filter automod spam wörter links erwähnungen wiederholte nachrichten",
    },
  },
  {
    id: "log",
    page: "log",
    words: {
      en: "audit log history who changed what",
      ar: "سجل التدقيق السجل التاريخ من غيّر ماذا",
      de: "protokoll audit verlauf wer was geändert",
    },
  },
  {
    id: "members",
    page: "members",
    words: {
      en: "members list search roles kick ban timeout nickname",
      ar: "الأعضاء قائمة بحث الأدوار طرد حظر كتم لقب",
      de: "mitglieder liste suche rollen kick bann timeout spitzname",
    },
  },
  {
    id: "invite-list",
    page: "invites",
    words: {
      en: "invites active links create revoke uses expiry",
      ar: "الدعوات روابط نشطة إنشاء إلغاء الاستخدامات انتهاء",
      de: "einladungen aktive links erstellen widerrufen nutzungen ablauf",
    },
  },
  {
    id: "roles",
    page: "roles",
    words: {
      en: "roles permissions everyone colour create reorder",
      ar: "الأدوار الأذونات الصلاحيات الجميع اللون إنشاء ترتيب",
      de: "rollen berechtigungen alle farbe erstellen sortieren",
    },
  },
  {
    id: "bans",
    page: "members",
    words: {
      en: "bans unban banned people",
      ar: "الحظر رفع الحظر المحظورون",
      de: "banns entbannen gebannte personen",
    },
  },
  {
    id: "bots",
    page: "apps",
    words: {
      en: "bots apps remove",
      ar: "البوتات التطبيقات إزالة",
      de: "bots apps entfernen",
    },
  },
  {
    id: "webhooks",
    page: "apps",
    words: {
      en: "webhooks integrations create edit delete url post",
      ar: "الويب هوك التكاملات إنشاء تعديل حذف رابط نشر",
      de: "webhooks integrationen erstellen bearbeiten löschen url posten",
    },
  },
  {
    id: "wings",
    page: "wings",
    words: {
      en: "wings level perks boost",
      ar: "الأجنحة المستوى المزايا تعزيز",
      de: "flügel wings stufe vorteile boost",
    },
  },
];

/** Page names in the three languages (search only; the sidebar uses Lingui) */
const PAGE_WORDS: Record<PageId, string> = {
  overview:
    "overview general profile danger delete transfer ownership نظرة عامة الملف الخطر حذف نقل الملكية allgemein übersicht profil gefahr löschen übertragen",
  features: "features functions الميزات funktionen",
  channels: "channels القنوات kanäle",
  emoji: "emoji الإيموجي emojis",
  soundboard: "soundboard sounds لوحة الأصوات الأصوات soundboard sounds",
  insights: "insights statistics الإحصاءات einblicke statistiken",
  members: "members bans الأعضاء الحظر mitglieder banns sperren",
  roles: "roles الأدوار الرتب rollen",
  invites: "invites invite links الدعوات روابط einladungen",
  joining:
    "access who can join joining new members welcome onboarding rules الوصول الانضمام الأعضاء الجدد الترحيب القواعد zugang beitritt neue mitglieder willkommen regeln",
  lobby: "lobby الردهة lobby",
  discovery: "discovery discover الاكتشاف entdecken",
  safety:
    "protection safety emergency raid filters automod spam الحماية الأمان الطوارئ الفلاتر schutz sicherheit notfall filter",
  log: "audit log سجل التدقيق protokoll",
  apps: "apps التطبيقات bots webhooks",
  wings: "wings الأجنحة flügel",
};

/** What the search matches a section by */
export function sectionKeywords(section: SectionInfo) {
  return `${section.words.en} ${section.words.ar} ${section.words.de}`;
}

/** What the search matches a whole page by: its name and every section */
export function pageKeywords(page: PageId) {
  return `${PAGE_WORDS[page]} ${SECTIONS.filter((s) => s.page === page)
    .map(sectionKeywords)
    .join(" ")}`;
}

/** Sections of a page */
export function sectionsOf(page: PageId) {
  return SECTIONS.filter((section) => section.page === page);
}
