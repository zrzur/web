import type { CommunityKind } from "./communityApi";

/** The image size a nameplate is made at */
export const PLATE_WIDTH = 1024;
export const PLATE_HEIGHT = 192;

/**
 * The member list, measured in the browser: the same at every window width
 * and in both directions. `nameplateLayer` in MemberSidebar.tsx is the layer;
 * e2e/stack-runner/creator-templates.mjs fails when these stop matching.
 */
const ROW = {
  width: 243,
  height: 38,
  avatar: 32,
  avatarInset: 8,
  nameInset: 48,
  /** the name's line, centred in the row */
  nameHeight: 18,
};

/** Where the mask reaches 55 percent and full, from the avatar's side */
const FADE_HALF = 0.3;
const FADE_FULL = 0.65;

/** A name of about eight letters, to draw the outline with */
const SAMPLE_NAME = 54;

export type PlateDirection = "ltr" | "rtl";

/** How much of a nameplate shows at this distance across the image, 0 to 1 */
export function plateVisibility(x: number, direction: PlateDirection) {
  const across = x / PLATE_WIDTH;
  const from = direction === "ltr" ? across : 1 - across;
  if (from >= FADE_FULL) return 1;
  if (from >= FADE_HALF) {
    return 0.55 + ((from - FADE_HALF) / (FADE_FULL - FADE_HALF)) * 0.45;
  }
  return (from / FADE_HALF) * 0.55;
}

/**
 * The member row laid over the image, in image pixels. `center / cover` on a
 * row wider than the image scales it to the row's width, so nothing is lost
 * at the sides and the same amount goes at the top and the bottom.
 */
export function plateGuide() {
  const scale = PLATE_WIDTH / ROW.width;
  const shown = ROW.height * scale;
  const crop = (PLATE_HEIGHT - shown) / 2;
  const middle = PLATE_HEIGHT / 2;
  const radius = (ROW.avatar * scale) / 2;
  const avatar = (ROW.avatarInset + ROW.avatar / 2) * scale;
  const nameStart = ROW.nameInset * scale;
  const nameWidth = SAMPLE_NAME * scale;
  return {
    scale,
    crop,
    top: crop,
    bottom: PLATE_HEIGHT - crop,
    middle,
    radius,
    avatar: { ltr: avatar, rtl: PLATE_WIDTH - avatar },
    name: {
      ltr: { from: nameStart, to: nameStart + nameWidth },
      rtl: {
        from: PLATE_WIDTH - nameStart - nameWidth,
        to: PLATE_WIDTH - nameStart,
      },
      height: ROW.nameHeight * scale,
    },
    /** fully seen from here on, in each direction */
    full: { ltr: FADE_FULL * PLATE_WIDTH, rtl: (1 - FADE_FULL) * PLATE_WIDTH },
    /** at least 55 percent in both directions; nothing is full in both */
    shared: {
      from: FADE_HALF * PLATE_WIDTH,
      to: (1 - FADE_HALF) * PLATE_WIDTH,
    },
  };
}

/** The guide marks in the studio, as shares of the image */
export function plateMarks() {
  const guide = plateGuide();
  const percent = (value: number, of: number) =>
    `${((value / of) * 100).toFixed(2)}%`;
  return {
    crop: percent(guide.crop, PLATE_HEIGHT),
    avatarInset: percent(guide.avatar.ltr - guide.radius, PLATE_WIDTH),
    avatarSize: percent(guide.radius * 2, PLATE_WIDTH),
    nameInset: percent(guide.name.ltr.from, PLATE_WIDTH),
    nameSize: percent(guide.name.ltr.to - guide.name.ltr.from, PLATE_WIDTH),
    nameEdge: percent(guide.middle - guide.name.height / 2, PLATE_HEIGHT),
  };
}

/** The art is half as wide again as the avatar and centred on it */
export const DECORATION_SIZE = 1024;
export const decorationAvatarRadius = () => DECORATION_SIZE / 1.5 / 2;

export type TemplateWords = {
  avatar: string;
  keepClear: string;
  around: string;
  name: string;
  cropped: string;
  ltrLanguages: string;
  rtlLanguages: string;
  fullFromHere: string;
  fullUpToHere: string;
  bothDirections: string;
  effectText: string;
  effectRules: string;
};

const FONT = `"IBM Plex Sans Variable", "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif`;
const font = (size: number) => `600 ${size}px ${FONT}`;

const INK = "rgba(255, 255, 255, 0.92)";
const LINE = "rgba(255, 255, 255, 0.72)";

/** A line of text, smaller rather than past `room` */
function write(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  size: number,
  room: number,
) {
  ctx.textAlign = align;
  ctx.font = font(size);
  const width = ctx.measureText(text).width;
  if (width > room) ctx.font = font(Math.floor((size * room) / width));
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y);
}

function hatch(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, PLATE_WIDTH, bottom - top);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(0, top, PLATE_WIDTH, bottom - top);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 2;
  for (let x = -bottom; x < PLATE_WIDTH + bottom; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x + bottom - top, top);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The nameplate template. Top half of the shown band: how the art fades in
 * left-to-right languages; bottom half: right-to-left. The brighter the pink,
 * the more of the art shows.
 */
export function drawPlateTemplate(
  ctx: CanvasRenderingContext2D,
  words: TemplateWords,
) {
  const guide = plateGuide();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#171925";
  ctx.fillRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);

  for (let x = 0; x < PLATE_WIDTH; x += 4) {
    ctx.fillStyle = `rgba(224, 25, 95, ${plateVisibility(x, "ltr") * 0.6})`;
    ctx.fillRect(x, guide.top, 4, guide.middle - guide.top);
    ctx.fillStyle = `rgba(224, 25, 95, ${plateVisibility(x, "rtl") * 0.6})`;
    ctx.fillRect(x, guide.middle, 4, guide.bottom - guide.middle);
  }

  hatch(ctx, 0, guide.top);
  hatch(ctx, guide.bottom, PLATE_HEIGHT);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  for (const y of [guide.top, guide.bottom]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PLATE_WIDTH, y);
    ctx.stroke();
  }

  ctx.setLineDash([8, 6]);
  // where each direction reaches full; the part between is never full in both
  ctx.beginPath();
  ctx.moveTo(guide.full.ltr, guide.top);
  ctx.lineTo(guide.full.ltr, guide.middle);
  ctx.moveTo(guide.full.rtl, guide.middle);
  ctx.lineTo(guide.full.rtl, guide.bottom);
  ctx.stroke();

  ctx.setLineDash([12, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  for (const x of [guide.avatar.ltr, guide.avatar.rtl]) {
    ctx.beginPath();
    ctx.arc(x, guide.middle, guide.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  const nameTop = guide.middle - guide.name.height / 2;
  for (const { from, to } of [guide.name.ltr, guide.name.rtl]) {
    ctx.strokeRect(from, nameTop, to - from, guide.name.height);
  }
  ctx.setLineDash([]);

  write(ctx, words.cropped, PLATE_WIDTH / 2, 9, "center", 12, 300);
  write(
    ctx,
    words.cropped,
    PLATE_WIDTH / 2,
    PLATE_HEIGHT - 8,
    "center",
    12,
    300,
  );
  for (const x of [guide.avatar.ltr, guide.avatar.rtl]) {
    write(ctx, words.avatar, x, guide.middle, "center", 18, guide.radius * 1.7);
  }
  for (const { from, to } of [guide.name.ltr, guide.name.rtl]) {
    write(
      ctx,
      words.name,
      (from + to) / 2,
      guide.middle,
      "center",
      22,
      to - from,
    );
  }
  write(
    ctx,
    words.bothDirections,
    PLATE_WIDTH / 2,
    guide.top + 18,
    "center",
    15,
    guide.full.ltr - guide.full.rtl - 16,
  );
  const room = 192;
  write(
    ctx,
    words.ltrLanguages,
    guide.full.ltr + 8,
    guide.top + 12,
    "left",
    15,
    room,
  );
  write(
    ctx,
    words.fullFromHere,
    guide.full.ltr + 8,
    guide.top + 30,
    "left",
    15,
    room,
  );
  write(
    ctx,
    words.rtlLanguages,
    guide.full.rtl - 8,
    guide.bottom - 30,
    "right",
    15,
    room,
  );
  write(
    ctx,
    words.fullUpToHere,
    guide.full.rtl - 8,
    guide.bottom - 12,
    "right",
    15,
    room,
  );
}

/** The decoration template: where the avatar sits under the art */
export function drawDecorationTemplate(
  ctx: CanvasRenderingContext2D,
  words: TemplateWords,
) {
  const centre = DECORATION_SIZE / 2;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(224, 25, 95, 0.18)";
  ctx.beginPath();
  ctx.arc(centre, centre, decorationAvatarRadius(), 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(224, 25, 95, 0.9)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 91, 168, 0.8)";
  ctx.strokeRect(2, 2, DECORATION_SIZE - 4, DECORATION_SIZE - 4);
  ctx.setLineDash([]);

  // a transparent image: words need their own ground on a white editor
  const label = (text: string, y: number) => {
    ctx.font = font(28);
    const width = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(13, 14, 22, 0.8)";
    ctx.fillRect(centre - width / 2 - 16, y - 24, width + 32, 48);
    write(ctx, text, centre, y, "center", 28, 960);
  };
  label(words.keepClear, centre);
  label(words.around, 60);
}

/** Size of an effect's picture: the shape of a profile */
export const EFFECT_WIDTH = 576;
export const EFFECT_HEIGHT = 1024;

/** Where a profile's parts sit, as parts of the picture */
export function effectMarks() {
  return { banner: 0.2, avatarY: 0.2, avatarSize: 0.26, textFrom: 0.36 };
}

/** The shape of a profile, with what must stay readable under the effect */
function drawEffectTemplate(
  ctx: CanvasRenderingContext2D,
  words: TemplateWords,
) {
  const marks = effectMarks();
  const width = EFFECT_WIDTH;
  const height = EFFECT_HEIGHT;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.beginPath();
  ctx.moveTo(0, height * marks.banner);
  ctx.lineTo(width, height * marks.banner);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(
    width / 2,
    height * marks.avatarY,
    (width * marks.avatarSize) / 2,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(13, 14, 22, 0.7)";
  ctx.fillRect(24, height * marks.textFrom, width - 48, 120);
  ctx.textBaseline = "middle";
  write(
    ctx,
    words.effectText,
    width / 2,
    height * marks.textFrom + 60,
    "center",
    24,
    width - 72,
  );
  write(
    ctx,
    words.avatar,
    width / 2,
    height * marks.avatarY,
    "center",
    24,
    200,
  );
  write(
    ctx,
    words.effectRules,
    width / 2,
    height - 60,
    "center",
    22,
    width - 48,
  );
}

/** Draw a template in the person's language and download it */
export async function downloadTemplate(
  kind: CommunityKind,
  words: TemplateWords,
  direction: PlateDirection,
) {
  const decoration = kind === "decorations";
  const effect = kind === "effects";
  const canvas = document.createElement("canvas");
  canvas.width = effect
    ? EFFECT_WIDTH
    : decoration
      ? DECORATION_SIZE
      : PLATE_WIDTH;
  canvas.height = effect
    ? EFFECT_HEIGHT
    : decoration
      ? DECORATION_SIZE
      : PLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // a font not used on screen yet would come out in the fallback
  await document.fonts?.load(font(15), Object.values(words).join(" "));
  ctx.direction = direction;
  if (effect) drawEffectTemplate(ctx, words);
  else if (decoration) drawDecorationTemplate(ctx, words);
  else drawPlateTemplate(ctx, words);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = effect
      ? "zrzur-effect-template.png"
      : decoration
        ? "zrzur-decoration-template.png"
        : "zrzur-nameplate-template.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
