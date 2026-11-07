/** Product country-flag selection. Other symbols and the explicitly excluded IL flag are not offered. */
const COUNTRIES = new Set(
  `AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW`.split(
    " ",
  ),
);
export function countryFlagCode(text: string): string | undefined {
  const points = [...text].map((c) => c.codePointAt(0)!);
  if (points.length !== 2 || points.some((p) => p < 0x1f1e6 || p > 0x1f1ff))
    return;
  const code = String.fromCharCode(...points.map((p) => p - 0x1f1e6 + 65));
  return COUNTRIES.has(code) ? code : undefined;
}
export function isOfferedEmoji(text: string): boolean {
  const points = [...text].map((c) => c.codePointAt(0)!);
  const flag =
    points.some((p) => p >= 0x1f1e6 && p <= 0x1f1ff) ||
    [0x1f3c1, 0x1f3f3, 0x1f3f4, 0x1f38c, 0x1f6a9].includes(points[0]);
  return !flag || !!countryFlagCode(text);
}
