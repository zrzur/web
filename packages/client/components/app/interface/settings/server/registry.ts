/**
 * Server settings pages and their sections: the one place that knows which
 * page a section is on, which old page ids still work, and the words the
 * settings search finds each section by (in all three languages, so people
 * find it however they type).
 */

export type PageId =
  | "overview"
  | "insights"
  | "channels"
  | "joining"
  | "emoji"
  | "soundboard"
  | "safety"
  | "log"
  | "members"
  | "roles"
  | "bans"
  | "apps"
  | "wings";

/**
 * Page ids and aliases from before the 2026-11 consolidation, and the
 * address they open now ("page", "page#section" or "page/sub-view")
 */
export const ALIASES: Record<string, string> = {
  lobby: "joining/lobby",
  discover: "overview#discovery",
  emojis: "emoji",
  sounds: "soundboard",
  access: "joining#join-mode",
  privacy: "joining#join-mode",
  "access/requests": "joining/requests",
  join_requests: "joining/requests",
  requests: "joining/requests",
  invites: "members#invites",
  notices: "overview#features",
  emergency: "safety#emergency",
  safety: "safety",
  verification: "joining#verification",
  filters: "safety#filters",
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
    page: "overview",
    words: {
      en: "discovery discover listing category language tags public list",
      ar: "الاكتشاف اكتشف إدراج الفئة اللغة الوسوم العلامات قائمة عامة",
      de: "entdecken discover eintrag kategorie sprache tags öffentlich liste",
    },
  },
  {
    id: "invites",
    page: "overview",
    words: {
      en: "custom invite link vanity short link sharing",
      ar: "رابط دعوة مخصص رابط قصير مشاركة",
      de: "eigener einladungslink kurzlink teilen",
    },
  },
  {
    id: "features",
    page: "overview",
    words: {
      en: "features rules channel system messages join leave kick ban welcome counters notices",
      ar: "الميزات قناة القواعد رسائل النظام انضمام مغادرة طرد حظر ترحيب عدادات إشعارات",
      de: "funktionen regelkanal systemnachrichten beitritt austritt kick bann willkommen zähler hinweise",
    },
  },
  {
    id: "threads",
    page: "overview",
    words: {
      en: "threads forums posts switch on off disable",
      ar: "الخيوط المنتديات المنشورات تشغيل إيقاف تعطيل",
      de: "threads foren beiträge einschalten ausschalten deaktivieren",
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
    page: "joining",
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
    id: "invites",
    page: "members",
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
    page: "bans",
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
  overview: "overview general نظرة عامة allgemein übersicht",
  insights: "insights الإحصاءات einblicke",
  channels: "channels القنوات kanäle",
  joining: "joining onboarding الانضمام الترحيب beitritt willkommen",
  emoji: "emoji الإيموجي emojis",
  soundboard: "soundboard لوحة الأصوات soundboard",
  safety: "safety الحماية sicherheit",
  log: "audit log سجل التدقيق protokoll",
  members: "members الأعضاء mitglieder",
  roles: "roles الأدوار rollen",
  bans: "bans الحظر banns sperren",
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
