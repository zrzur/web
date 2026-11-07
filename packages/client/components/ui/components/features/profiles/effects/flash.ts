/**
 * Flash check, WCAG 2.3.1 "three flashes or below threshold".
 *
 * A flash is a pair of opposing changes in relative luminance of 10% or more
 * of the maximum (1.0), where the darker value is below 0.8. A red flash is
 * the same for saturated red. At most 3 in any second, over an area of a
 * quarter of a 10 degree field (21,824 CSS px on a 341 x 256 area). Effects
 * are tested over black and over white, as the area behind them can be either.
 */

/** One sample: relative luminance and how saturated-red it is */
export type Sample = { luminance: number; red: number };

export const FLASH_LIMIT_PER_SECOND = 3;
/** 25% of the 341 x 256 CSS px safe area */
export const FLASH_AREA_PX = 21824;

const channel = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/** Sample of a colour with channels from 0 to 1 */
export function sampleOf(r: number, g: number, b: number): Sample {
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const total = r + g + b;
  const redness = total > 0 ? r / total : 0;
  return {
    luminance,
    // saturated red: at least 80% of the colour is red
    red: redness >= 0.8 ? Math.max(0, (r - g - b) * 320) : 0,
  };
}

/** How many flashes one spot of the picture makes at most in any second */
export function flashesPerSecond(samples: Sample[], fps: number) {
  type Change = { frame: number; direction: number };
  const changes = (
    value: (s: Sample) => number,
    opposing: (a: number, b: number) => boolean,
  ) => {
    const found: Change[] = [];
    let anchor = value(samples[0]);
    for (let frame = 1; frame < samples.length; frame++) {
      const current = value(samples[frame]);
      if (opposing(anchor, current)) {
        found.push({ frame, direction: Math.sign(current - anchor) });
        anchor = current;
      } else if (
        found.length &&
        Math.sign(current - anchor) === found[found.length - 1].direction
      ) {
        // still moving the same way: the extreme, not a new change
        anchor = current;
      }
    }
    return found;
  };

  const most = (list: Change[]) => {
    // a flash needs two opposing changes
    const flashes: number[] = [];
    for (let i = 1; i < list.length; i++) {
      if (list[i].direction !== list[i - 1].direction) {
        flashes.push(list[i].frame);
        i++;
      }
    }
    let best = 0;
    for (let i = 0; i < flashes.length; i++) {
      const inWindow = flashes.filter(
        (frame) => frame >= flashes[i] && frame < flashes[i] + fps,
      ).length;
      best = Math.max(best, inWindow);
    }
    return best;
  };

  const general = changes(
    (s) => s.luminance,
    (a, b) => {
      const bright = Math.max(a, b);
      const dark = Math.min(a, b);
      return bright - dark >= 0.1 && dark < 0.8;
    },
  );
  const red = changes(
    (s) => s.red,
    (a, b) => Math.abs(a - b) > 20,
  );

  return Math.max(most(general), most(red));
}

/**
 * Check a whole animation. `frames[f][y][x]` is a sample; each cell stands for
 * `cellArea` CSS px. Returns the largest area breaking the limit.
 */
export function failingArea(
  frames: Sample[][][],
  fps: number,
  cellArea: number,
) {
  if (!frames.length) return 0;
  const rows = frames[0].length;
  const columns = frames[0][0].length;
  let failing = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const samples = frames.map((frame) => frame[y][x]);
      if (flashesPerSecond(samples, fps) > FLASH_LIMIT_PER_SECOND) {
        failing += cellArea;
      }
    }
  }
  return failing;
}
