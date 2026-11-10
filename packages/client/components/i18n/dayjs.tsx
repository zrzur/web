import { createSignal } from "solid-js";

import { i18n } from "@lingui/core";
import dayjs from "dayjs";
// the CommonJS locale files share the one dayjs the app imports; the esm ones
// pull in a second copy of dayjs (about 7 KB) into the app shell
import locale_ar_base from "dayjs/locale/ar";
import locale_en_GB from "dayjs/locale/en-gb";
import advancedFormat from "dayjs/plugin/advancedFormat";
import calendar from "dayjs/plugin/calendar";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";

import { type LocaleOptions, LanguageEntry, Languages } from "./Languages";

dayjs.extend(calendar);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);
dayjs.extend(updateLocale);

/**
 * Internal signal, don't try to use this unless you know what you're doing!
 */
const [timeLocale, setTimeLocale] = createSignal<[string, ILocale]>([
  null!,
  null!,
]);

export { dayjs, timeLocale };

// every other language loads when picked; these three are already in the
// start-up code (dayjs itself and LOCALE_OVERRIDES)
const LOCALE_FILES = import.meta.glob<{ default: ILocale }>([
  "../../node_modules/dayjs/esm/locale/*.js",
  "!../../node_modules/dayjs/esm/locale/{ar,en,en-gb}.js",
]);

async function timeLocaleData(target: string) {
  const load = LOCALE_FILES[`../../node_modules/dayjs/esm/locale/${target}.js`];
  return load ? (await load()).default : (dayjs.Ls[target] ?? dayjs.Ls.en);
}

export async function loadTimeLocale(
  language: LanguageEntry,
  localeOptions: LocaleOptions,
  useLocale?: ILocale,
) {
  const target = language.dayjs ?? language.i18n;
  const locale =
    useLocale ?? LOCALE_OVERRIDES[target] ?? (await timeLocaleData(target));

  // merge options for calendar
  (locale as unknown as { calendar: Record<string, string> }).calendar = {
    lastDay: i18n._(`[Yesterday at] LT`),
    sameDay: i18n._(`[Today at] LT`),
    nextDay: i18n._(`[Tomorrow at] LT`),
    lastWeek: i18n._(`[Last] dddd [at] LT`),
    nextWeek: i18n._(`dddd [at] LT`),
    sameElse: "L",
  };

  // merge locale options
  const options = {
    ...language.localeOptions,
    ...localeOptions,
  };

  updateTimeLocaleOptions(options, target, locale);
}

/**
 * Update dayjs locale given locale options
 * @param options Options
 * @param target Target locale (uses current if none specified)
 * @param useLocale Override locale data
 */
export function updateTimeLocaleOptions(
  options: LocaleOptions,
  target?: string,
  useLocale?: ILocale,
) {
  const [currentTarget, currentLocale] = timeLocale();
  target = target ?? currentTarget;
  useLocale = useLocale ?? currentLocale;

  const locale = {
    ...useLocale,
    formats: {
      ...useLocale.formats,
      L: options.dateFormat ?? useLocale.formats.L,
      LT: options.timeFormat ?? useLocale.formats.LT,
    },
  };

  setTimeLocale([target, locale]);
}

/**
 * Initialisation function
 */
export function initTime() {
  loadTimeLocale(Languages.en, {}, locale_en_GB);
}

/**
 * Create dayjs time objects with locale and extensions
 * @returns Dayjs creator
 */
export function useTime() {
  // eslint-disable-next-line solid/reactivity
  return (date?: dayjs.ConfigType) => dayjs(date).locale(...timeLocale());
}

/**
 * Define a custom en_US locale because dayjs doesn't include an exhaustive definition
 */
const locale_en_US: ILocale & { yearStart: number } = {
  name: "en",
  weekdays: locale_en_GB["weekdays"],
  weekdaysShort: locale_en_GB["weekdaysShort"],
  weekdaysMin: locale_en_GB["weekdaysMin"],
  months: locale_en_GB["months"],
  monthsShort: locale_en_GB["monthsShort"],
  weekStart: locale_en_GB["weekStart"],
  yearStart: (locale_en_GB as unknown as { yearStart: number })["yearStart"],
  relativeTime: locale_en_GB["relativeTime"],
  formats: {
    LT: "h:mm A",
    LTS: "h:mm:ss A",
    L: "MM/DD/YYYY",
    LL: "MMMM D, YYYY",
    LLL: "MMMM D, YYYY h:mm A",
    LLLL: "dddd, MMMM D, YYYY h:mm A",
  },
  ordinal: locale_en_GB["ordinal"],
};

/**
 * Arabic counts take different noun forms: 1, 2 (dual), 3–10 (plural) and
 * 11+ (singular). dayjs's own Arabic locale uses the 3–10 form for every
 * number ("36 دقائق"), so pick the right one here.
 */
const arabicCount =
  (one: string, two: string, few: string, many: string) => (n: number) =>
    n === 1
      ? one
      : n === 2
        ? two
        : n % 100 >= 3 && n % 100 <= 10
          ? `${n} ${few}`
          : `${n} ${many}`;

const locale_ar: ILocale = {
  ...locale_ar_base,
  relativeTime: {
    future: "بعد %s",
    past: "منذ %s",
    s: "لحظات",
    m: "دقيقة",
    mm: arabicCount("دقيقة", "دقيقتين", "دقائق", "دقيقة"),
    h: "ساعة",
    hh: arabicCount("ساعة", "ساعتين", "ساعات", "ساعة"),
    d: "يوم",
    dd: arabicCount("يوم", "يومين", "أيام", "يومًا"),
    M: "شهر",
    MM: arabicCount("شهر", "شهرين", "أشهر", "شهرًا"),
    y: "سنة",
    yy: arabicCount("سنة", "سنتين", "سنوات", "سنة"),
  } as unknown as ILocale["relativeTime"],
};

const LOCALE_OVERRIDES: Record<string, ILocale> = {
  "en-gb": locale_en_GB,
  en: locale_en_US,
  ar: locale_ar,
};
