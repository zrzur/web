/**
 * Builds the country nameplates in public/nameplates from the flag-icons
 * package (lipis/flag-icons, MIT, see public/nameplates/SOURCES.md). The
 * package is not a dependency of the app: unpack a checked tarball somewhere
 * and point this at it.
 *
 *   node scripts/designs/flags.mjs <unpacked flag-icons folder>
 *
 * Every plate is 448 x 84. The flag itself stands at the end of the row, at
 * full plate height and its true 4:3 shape, nothing squeezed or stretched. Its
 * edge colours run on towards the name, and its inner edge fades into them. A
 * flag has writing on it, so it is never mirrored: right-to-left rows move it
 * to the other end (`#rtl`).
 *
 * Also writes `components/ui/.../profiles/plateNames.ts` and the Arabic and
 * German names into scripts/i18n/ui-110705.json.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const client = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = resolve(client, "../..");
const pnpmDir = join(root, "node_modules/.pnpm");
const require = createRequire(
  join(
    pnpmDir,
    readdirSync(pnpmDir).find((d) => d.startsWith("svgo@")),
    "node_modules/svgo/package.json",
  ),
);
const { optimize } = require("svgo");

const source = process.argv[2];
if (!source) throw new Error("Give the unpacked flag-icons folder");

const OUT = join(client, "public/nameplates");
/** Size of every plate */
const W = 448;
const H = 84;
/** The flag at full plate height: 84 high and 4:3 */
const FLAG_W = 112;
/** Where it starts, flush with the end of the plate */
const END = W - FLAG_W;

/** Members of the Arab League, first in every list */
export const ARAB =
  `dz bh km dj eg iq jo kw lb ly mr ma om ps qa sa so sd sy tn ae ye`.split(
    " ",
  );

/** English names; the two observers and the three home flags are included */
const NAMES = {
  af: "Afghanistan",
  al: "Albania",
  dz: "Algeria",
  ad: "Andorra",
  ao: "Angola",
  ag: "Antigua and Barbuda",
  ar: "Argentina",
  am: "Armenia",
  au: "Australia",
  at: "Austria",
  az: "Azerbaijan",
  bs: "Bahamas",
  bh: "Bahrain",
  bb: "Barbados",
  by: "Belarus",
  be: "Belgium",
  bz: "Belize",
  bj: "Benin",
  bt: "Bhutan",
  bo: "Bolivia",
  ba: "Bosnia and Herzegovina",
  bw: "Botswana",
  br: "Brazil",
  bn: "Brunei",
  bg: "Bulgaria",
  bf: "Burkina Faso",
  bi: "Burundi",
  cv: "Cape Verde",
  kh: "Cambodia",
  cm: "Cameroon",
  ca: "Canada",
  cf: "Central African Republic",
  td: "Chad",
  cl: "Chile",
  cn: "China",
  co: "Colombia",
  km: "Comoros",
  cg: "Congo",
  cd: "DR Congo",
  cr: "Costa Rica",
  ci: "Ivory Coast",
  hr: "Croatia",
  cu: "Cuba",
  cy: "Cyprus",
  cz: "Czechia",
  dk: "Denmark",
  dj: "Djibouti",
  dm: "Dominica",
  do: "Dominican Republic",
  ec: "Ecuador",
  eg: "Egypt",
  sv: "El Salvador",
  gq: "Equatorial Guinea",
  er: "Eritrea",
  ee: "Estonia",
  sz: "Eswatini",
  et: "Ethiopia",
  fj: "Fiji",
  fi: "Finland",
  fr: "France",
  ga: "Gabon",
  gm: "Gambia",
  ge: "Georgia",
  de: "Germany",
  gh: "Ghana",
  gr: "Greece",
  gd: "Grenada",
  gt: "Guatemala",
  gn: "Guinea",
  gw: "Guinea-Bissau",
  gy: "Guyana",
  ht: "Haiti",
  hn: "Honduras",
  hu: "Hungary",
  is: "Iceland",
  in: "India",
  id: "Indonesia",
  ir: "Iran",
  iq: "Iraq",
  ie: "Ireland",
  it: "Italy",
  jm: "Jamaica",
  jo: "Jordan",
  kz: "Kazakhstan",
  ke: "Kenya",
  ki: "Kiribati",
  kw: "Kuwait",
  kg: "Kyrgyzstan",
  lv: "Latvia",
  lb: "Lebanon",
  ls: "Lesotho",
  lr: "Liberia",
  ly: "Libya",
  li: "Liechtenstein",
  lt: "Lithuania",
  lu: "Luxembourg",
  mg: "Madagascar",
  mw: "Malawi",
  my: "Malaysia",
  mv: "Maldives",
  ml: "Mali",
  mt: "Malta",
  mh: "Marshall Islands",
  mr: "Mauritania",
  mu: "Mauritius",
  mx: "Mexico",
  md: "Moldova",
  mc: "Monaco",
  mn: "Mongolia",
  me: "Montenegro",
  ma: "Morocco",
  mz: "Mozambique",
  mm: "Myanmar",
  na: "Namibia",
  nr: "Nauru",
  nl: "Netherlands",
  nz: "New Zealand",
  ni: "Nicaragua",
  ng: "Nigeria",
  mk: "North Macedonia",
  no: "Norway",
  om: "Oman",
  pk: "Pakistan",
  ps: "Palestine",
  pg: "Papua New Guinea",
  py: "Paraguay",
  pe: "Peru",
  ph: "Philippines",
  pl: "Poland",
  pt: "Portugal",
  qa: "Qatar",
  ro: "Romania",
  ru: "Russia",
  rw: "Rwanda",
  kn: "Saint Kitts and Nevis",
  lc: "Saint Lucia",
  vc: "Saint Vincent and the Grenadines",
  ws: "Samoa",
  sm: "San Marino",
  st: "Sao Tome and Principe",
  sa: "Saudi Arabia",
  sn: "Senegal",
  rs: "Serbia",
  sc: "Seychelles",
  sl: "Sierra Leone",
  sg: "Singapore",
  sk: "Slovakia",
  si: "Slovenia",
  sb: "Solomon Islands",
  so: "Somalia",
  za: "South Africa",
  ss: "South Sudan",
  es: "Spain",
  lk: "Sri Lanka",
  sd: "Sudan",
  sr: "Suriname",
  se: "Sweden",
  sy: "Syria",
  tj: "Tajikistan",
  tz: "Tanzania",
  th: "Thailand",
  tl: "Timor-Leste",
  tg: "Togo",
  to: "Tonga",
  tt: "Trinidad and Tobago",
  tn: "Tunisia",
  tr: "Turkey",
  tm: "Turkmenistan",
  tv: "Tuvalu",
  ug: "Uganda",
  ua: "Ukraine",
  ae: "United Arab Emirates",
  gb: "United Kingdom",
  us: "United States",
  uy: "Uruguay",
  uz: "Uzbekistan",
  vu: "Vanuatu",
  va: "Vatican City",
  ve: "Venezuela",
  vn: "Vietnam",
  ye: "Yemen",
  zm: "Zambia",
  zw: "Zimbabwe",
  bd: "Bangladesh",
  jp: "Japan",
  la: "Laos",
  ne: "Niger",
  pw: "Palau",
  kp: "North Korea",
  kr: "South Korea",
  ch: "Switzerland",
  fm: "Micronesia",
  np: "Nepal",
  pa: "Panama",
  // not UN seats of their own, asked for by name
  "gb-eng": "England",
  "gb-sct": "Scotland",
  kurdistan: "Kurdistan",
};

/** Plain Modern Standard Arabic and German where the system names are long */
const NAME_FIXES = {
  ps: ["فلسطين", "Palästina"],
  sa: ["السعودية", "Saudi-Arabien"],
  ae: ["الإمارات العربية المتحدة", "Vereinigte Arabische Emirate"],
  km: ["جزر القمر", "Komoren"],
  ci: ["ساحل العاج", "Elfenbeinküste"],
  cd: ["جمهورية الكونغو الديمقراطية", "Demokratische Republik Kongo"],
  cg: ["الكونغو", "Kongo"],
  cv: ["الرأس الأخضر", "Kap Verde"],
  mm: ["ميانمار", "Myanmar"],
  tl: ["تيمور الشرقية", "Timor-Leste"],
  bn: ["بروناي", "Brunei"],
  va: ["الفاتيكان", "Vatikanstadt"],
  us: ["الولايات المتحدة", "Vereinigte Staaten"],
  gb: ["المملكة المتحدة", "Vereinigtes Königreich"],
  kr: ["كوريا الجنوبية", "Südkorea"],
  kp: ["كوريا الشمالية", "Nordkorea"],
  tr: ["تركيا", "Türkei"],
  cz: ["التشيك", "Tschechien"],
  "gb-eng": ["إنجلترا", "England"],
  "gb-sct": ["اسكتلندا", "Schottland"],
  kurdistan: ["كردستان", "Kurdistan"],
};

/**
 * A soft light on the cloth, and the fade of the flag's inner edge. The fade
 * towards the name is not in the art: `.z-plate` in decorations.css masks it.
 */
const LIGHT =
  `<linearGradient id="zg" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-opacity="0"/><stop offset="1" stop-opacity=".14"/></linearGradient>` +
  `<linearGradient id="zh"><stop stop-color="#000"/><stop offset=".12" stop-color="#fff"/></linearGradient>` +
  `<linearGradient id="zr"><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`;

/**
 * Vertical bands: run on the band at the flag's hoist, which meets the flag.
 * Everything else runs on its fly edge: the stripes carry straight on.
 */
const HOIST_EDGE = new Set(
  "fr it ie be ro ml td ci ng gn pe mx ca dz sn zm cm".split(" "),
);

/** Where an edge column would not do: writing along it, or no field at all */
const BANDS = {
  ir: ["#239F40", "#FFFFFF", "#DA0000"],
  np: ["#FFFFFF"],
};

/** Our own drawing: flag-icons has no flag for Kurdistan */
const KURDISTAN = (() => {
  let rays = "";
  for (let i = 0; i < 42; i++) {
    const a = (i * Math.PI) / 21 - Math.PI / 2;
    const r = i % 2 ? 62 : 104;
    rays += `${(320 + Math.cos(a) * r).toFixed(1)} ${(240 + Math.sin(a) * r).toFixed(1)}${i < 41 ? "L" : ""}`;
  }
  return (
    `<path fill="#ed2024" d="M0 0h640v160H0z"/><path fill="#fff" d="M0 160h640v160H0z"/>` +
    `<path fill="#278e43" d="M0 320h640v160H0z"/><path fill="#febd11" d="M${rays}Z"/>` +
    `<circle cx="320" cy="240" r="50" fill="#febd11"/>`
  );
})();

function flagSvg(code) {
  if (code === "kurdistan") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">${KURDISTAN}</svg>`;
  }
  const raw = readFileSync(join(source, "flags/4x3", `${code}.svg`), "utf8");
  return optimize(raw, {
    multipass: true,
    floatPrecision: 1,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { removeViewBox: false } },
      },
    ],
  }).data;
}

/** One thin column of the flag, drawn out towards the name */
function field(code) {
  if (BANDS[code]) {
    const h = H / BANDS[code].length;
    return BANDS[code]
      .map(
        (colour, i) =>
          `<rect y="${i * h}" width="${W}" height="${h + 0.5}" fill="${colour}"/>`,
      )
      .join("");
  }
  const x = HOIST_EDGE.has(code) ? 2 : 632;
  return `<svg width="${W}" height="${H}" viewBox="${x} 0 6 480" preserveAspectRatio="none"><use href="#zf" width="640" height="480"/></svg>`;
}

function plate(code) {
  const svg = flagSvg(code);
  const open = svg.match(/^<svg[^>]*>/)[0];
  const links = open.includes("xmlns:xlink")
    ? ' xmlns:xlink="http://www.w3.org/1999/xlink"'
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${links} width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>#zk{mask:url(#zm)}#rtl:target~#zp{transform:translateX(${-END}px)}#rtl:target~#zp #zk{mask:url(#zn)}</style>` +
    `<defs><symbol id="zf" viewBox="0 0 640 480" preserveAspectRatio="none">${svg.slice(open.length, -"</svg>".length)}</symbol>` +
    `${LIGHT}<mask id="zm"><rect width="${FLAG_W}" height="${H}" fill="url(#zh)"/></mask><mask id="zn"><rect width="${FLAG_W}" height="${H}" fill="url(#zr)"/></mask></defs>` +
    field(code) +
    `<g id="rtl"/><g id="zp"><g transform="translate(${END})"><g id="zk"><use href="#zf" width="${FLAG_W}" height="${H}"/></g></g></g>` +
    `<rect width="${W}" height="${H}" fill="url(#zg)"/></svg>`
  );
}

mkdirSync(OUT, { recursive: true });
const codes = Object.keys(NAMES);
let total = 0;
for (const code of codes) {
  const svg = plate(code);
  total += svg.length;
  writeFileSync(join(OUT, `flag-${code}.svg`), svg);
}

/* names: English in code, the other two through the translation script */
const display = (locale) => new Intl.DisplayNames([locale], { type: "region" });
const arabic = display("ar");
const german = display("de");
const nameOf = (code, names, at) =>
  NAME_FIXES[code]?.[at] ?? names.of(code.toUpperCase());

const entries = codes
  .map((code) => `    "flag-${code}": t\`${NAMES[code]}\`,`)
  .join("\n");
writeFileSync(
  join(client, "components/ui/components/features/profiles/plateNames.ts"),
  `import { useLingui } from "@lingui/solid/macro";

/** Names of the country nameplates. Made by scripts/designs/flags.mjs. */
export function useCountryNames(): Record<string, string> {
  const { t } = useLingui();
  return {
${entries}
  };
}
`,
);

const translations = {};
for (const code of codes) {
  translations[NAMES[code]] = [
    nameOf(code, arabic, 0),
    nameOf(code, german, 1),
  ];
}
writeFileSync(
  join(client, "scripts/i18n/ui-110705.json"),
  `${JSON.stringify(translations, null, 2)}\n`,
);

const ids = (list) => list.map((c) => `"${c}"`).join(", ");
console.log(`${codes.length} plates, ${(total / 1024).toFixed(0)} KB`);
console.log("rest", ids(codes.filter((c) => !ARAB.includes(c))));
