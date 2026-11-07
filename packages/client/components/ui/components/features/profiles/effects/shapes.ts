/**
 * The drawings the effects are made of, in plain canvas paths. All original to
 * Zrzur (AGPL-3.0). Each is drawn once around the origin, at size 1, into a
 * small canvas that is then blitted. Each has a deep edge and a light body, so
 * it holds on dark and on pale surfaces.
 */
import type { Tone } from "./effects";

export type EffectShape =
  | "snowball"
  | "flake"
  | "streak"
  | "ripple"
  | "paper"
  | "spark"
  | "petal"
  | "bubble"
  | "leaf"
  | "orb"
  | "kite"
  | "curtain"
  | "sparkle"
  | "comet"
  | "lantern"
  | "blossom"
  | "plane"
  | "butterfly"
  | "ink"
  | "shard"
  | "bead"
  | "runnel"
  | "ray"
  | "moon"
  | "rosette"
  | "wave"
  | "feather"
  | "seed"
  | "heart";

type Draw = (
  context: CanvasRenderingContext2D,
  tone: Tone,
  frame: number,
) => void;

const TAU = Math.PI * 2;

function radial(
  context: CanvasRenderingContext2D,
  radius: number,
  stops: [number, string][],
  x = 0,
  y = 0,
) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

function along(
  context: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  stops: [number, string][],
) {
  const gradient = context.createLinearGradient(...from, ...to);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  return gradient;
}

/** A colour with an opacity, from `#rrggbb` */
const fade = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

/** Fill, then a deep hairline: the two that keep a shape on any surface */
function solid(
  context: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  deep: string,
  line = 0.09,
) {
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = deep;
  context.lineWidth = line;
  context.lineJoin = "round";
  context.stroke();
}

/** A soft ring of light under a shape */
function halo(
  context: CanvasRenderingContext2D,
  colour: string,
  radius: number,
) {
  context.fillStyle = radial(context, radius, [
    [0, fade(colour, 0.42)],
    [0.5, fade(colour, 0.16)],
    [1, fade(colour, 0)],
  ]);
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
}

/** Six arms with side branches */
const flakeArms = (context: CanvasRenderingContext2D) => {
  for (let i = 0; i < 6; i++) {
    context.save();
    context.rotate((i * Math.PI) / 3);
    context.moveTo(0, 0);
    context.lineTo(0, -1);
    context.moveTo(0, -0.62);
    context.lineTo(0.26, -0.86);
    context.moveTo(0, -0.62);
    context.lineTo(-0.26, -0.86);
    context.moveTo(0, -0.34);
    context.lineTo(0.17, -0.5);
    context.moveTo(0, -0.34);
    context.lineTo(-0.17, -0.5);
    context.restore();
  }
};

function teardrop(
  context: CanvasRenderingContext2D,
  length: number,
  width: number,
) {
  context.moveTo(0, -length);
  context.bezierCurveTo(width, -length * 0.4, width, length, 0, length);
  context.bezierCurveTo(-width, length, -width, -length * 0.4, 0, -length);
  context.closePath();
}

function star(
  context: CanvasRenderingContext2D,
  points: number,
  outer: number,
  inner: number,
) {
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 ? inner : outer;
    context[i ? "lineTo" : "moveTo"](
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  context.closePath();
}

type Drawing = {
  /** How far it reaches from its centre, at size 1 */
  reach: [number, number];
  /** Half width and height of its solid part */
  body?: [number, number];
  /** Canvas pixels per unit: more for what is shown large */
  unit?: number;
  draw: Draw;
};

const SHAPES: Record<EffectShape, Drawing> = {
  snowball: {
    reach: [1.6, 1.6],
    body: [1, 1],
    draw(context, [fill, deep, light]) {
      halo(context, deep, 1.6);
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      solid(
        context,
        radial(
          context,
          1.1,
          [
            [0, light],
            [0.7, fill],
            [1, fill],
          ],
          -0.3,
          -0.3,
        ),
        deep,
        0.16,
      );
    },
  },
  flake: {
    reach: [1.2, 1.2],
    body: [1, 1],
    unit: 70,
    draw(context, [, deep, light]) {
      context.lineCap = "round";
      context.beginPath();
      flakeArms(context);
      context.strokeStyle = deep;
      context.lineWidth = 0.2;
      context.stroke();
      context.beginPath();
      flakeArms(context);
      context.strokeStyle = light;
      context.lineWidth = 0.09;
      context.stroke();
    },
  },
  streak: {
    reach: [1.1, 0.14],
    body: [1, 0.06],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(-1, 0);
      context.lineTo(0.84, -0.055);
      context.quadraticCurveTo(1.04, 0, 0.84, 0.055);
      context.closePath();
      context.fillStyle = along(
        context,
        [-1, 0],
        [1, 0],
        [
          [0, fade(deep, 0)],
          [0.5, fade(deep, 0.75)],
          [0.8, fill],
          [1, light],
        ],
      );
      context.fill();
    },
  },
  ripple: {
    reach: [1.05, 1.05],
    body: [1, 1],
    unit: 170,
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      context.strokeStyle = deep;
      context.lineWidth = 0.03;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 0.985, 0, TAU);
      context.strokeStyle = light;
      context.lineWidth = 0.02;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 0.76, 0, TAU);
      context.strokeStyle = fade(deep, 0.5);
      context.lineWidth = 0.014;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 0.76, 0.5, 2.4);
      context.strokeStyle = light;
      context.lineWidth = 0.014;
      context.stroke();
    },
  },
  paper: {
    reach: [1.2, 0.8],
    body: [1, 0.6],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(-1, -0.56);
      context.lineTo(1, -0.56);
      context.lineTo(1, 0.56);
      context.lineTo(-1, 0.56);
      context.closePath();
      solid(
        context,
        along(
          context,
          [-1, -0.5],
          [1, 0.5],
          [
            [0, light],
            [0.4, fill],
            [1, fill],
          ],
        ),
        deep,
        0.1,
      );
    },
  },
  spark: {
    reach: [2.6, 1.3],
    body: [1.2, 0.6],
    draw(context, [fill, deep, light]) {
      halo(context, fill, 1.3);
      context.beginPath();
      context.moveTo(-2.5, 0);
      context.quadraticCurveTo(-0.6, -0.5, 0.7, -0.5);
      context.arc(0.7, 0, 0.5, -Math.PI / 2, Math.PI / 2);
      context.quadraticCurveTo(-0.6, 0.5, -2.5, 0);
      context.closePath();
      context.fillStyle = along(
        context,
        [-2.5, 0],
        [1.2, 0],
        [
          [0, fade(deep, 0)],
          [0.5, deep],
          [0.8, fill],
          [1, light],
        ],
      );
      context.fill();
    },
  },
  petal: {
    reach: [1.1, 1.1],
    body: [0.8, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, 1);
      context.bezierCurveTo(1.1, 0.3, 0.9, -0.8, 0.14, -0.96);
      context.lineTo(0, -0.74);
      context.lineTo(-0.14, -0.96);
      context.bezierCurveTo(-0.9, -0.8, -1.1, 0.3, 0, 1);
      context.closePath();
      solid(
        context,
        radial(
          context,
          1.5,
          [
            [0, light],
            [0.5, fill],
            [1, deep],
          ],
          0,
          1,
        ),
        deep,
        0.08,
      );
    },
  },
  bubble: {
    unit: 64,
    reach: [1.1, 1.1],
    body: [1, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      context.fillStyle = radial(context, 1, [
        [0, fade(fill, 0.04)],
        [0.72, fade(fill, 0.14)],
        [1, fade(fill, 0.55)],
      ]);
      context.fill();
      context.strokeStyle = deep;
      context.lineWidth = 0.08;
      context.stroke();
      context.beginPath();
      context.arc(0, 0, 0.72, 3.5, 4.5);
      context.strokeStyle = light;
      context.lineWidth = 0.13;
      context.lineCap = "round";
      context.stroke();
      context.beginPath();
      context.arc(0.42, 0.46, 0.09, 0, TAU);
      context.fillStyle = light;
      context.fill();
    },
  },
  leaf: {
    unit: 64,
    reach: [1.1, 1.2],
    body: [0.62, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, -1.05);
      context.bezierCurveTo(0.9, -0.5, 0.8, 0.4, 0, 1.05);
      context.bezierCurveTo(-0.8, 0.4, -0.9, -0.5, 0, -1.05);
      context.closePath();
      solid(
        context,
        along(
          context,
          [-0.7, -0.8],
          [0.7, 0.9],
          [
            [0, light],
            [0.4, fill],
            [1, deep],
          ],
        ),
        deep,
        0.08,
      );
      context.beginPath();
      context.moveTo(0, -0.9);
      context.lineTo(0, 1.05);
      for (const y of [-0.3, 0.1, 0.5]) {
        context.moveTo(0, y + 0.22);
        context.lineTo(0.42, y - 0.08);
        context.moveTo(0, y + 0.22);
        context.lineTo(-0.42, y - 0.08);
      }
      context.strokeStyle = deep;
      context.lineWidth = 0.06;
      context.stroke();
    },
  },
  orb: {
    reach: [2, 2],
    body: [0.7, 0.7],
    draw(context, [fill, deep, light]) {
      context.fillStyle = radial(context, 2, [
        [0, fade(fill, 0.7)],
        [0.4, fade(fill, 0.3)],
        [0.7, fade(deep, 0.14)],
        [1, fade(deep, 0)],
      ]);
      context.beginPath();
      context.arc(0, 0, 2, 0, TAU);
      context.fill();
      context.beginPath();
      context.arc(0, 0, 0.56, 0, TAU);
      solid(
        context,
        radial(context, 0.6, [
          [0, "#ffffff"],
          [0.5, light],
          [1, fill],
        ]),
        deep,
        0.1,
      );
    },
  },
  kite: {
    unit: 64,
    reach: [1.5, 2.4],
    body: [0.7, 1.3],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, 1.34);
      context.bezierCurveTo(0.5, 1.6, -0.5, 1.8, 0.1, 2.3);
      context.strokeStyle = deep;
      context.lineWidth = 0.08;
      context.lineCap = "round";
      context.stroke();
      for (const [x, y] of [
        [0.12, 1.66],
        [-0.04, 1.98],
      ]) {
        context.beginPath();
        context.moveTo(x - 0.18, y - 0.1);
        context.lineTo(x + 0.18, y + 0.1);
        context.lineTo(x + 0.18, y - 0.1);
        context.lineTo(x - 0.18, y + 0.1);
        context.closePath();
        context.fillStyle = light;
        context.fill();
      }
      context.beginPath();
      context.moveTo(0, -1.3);
      context.lineTo(0.92, -0.2);
      context.lineTo(0, 1.34);
      context.lineTo(-0.92, -0.2);
      context.closePath();
      solid(context, fill, deep, 0.1);
      context.beginPath();
      context.moveTo(0, -1.3);
      context.lineTo(0.92, -0.2);
      context.lineTo(0, -0.2);
      context.closePath();
      context.fillStyle = fade(light, 0.8);
      context.fill();
      context.beginPath();
      context.moveTo(0, 1.34);
      context.lineTo(-0.92, -0.2);
      context.lineTo(0, -0.2);
      context.closePath();
      context.fillStyle = fade(deep, 0.45);
      context.fill();
      context.beginPath();
      context.moveTo(0, -1.3);
      context.lineTo(0, 1.34);
      context.moveTo(-0.92, -0.2);
      context.lineTo(0.92, -0.2);
      context.strokeStyle = fade(deep, 0.8);
      context.lineWidth = 0.06;
      context.stroke();
    },
  },
  curtain: {
    reach: [1.1, 3.4],
    body: [0.8, 3],
    draw(context, [fill, deep, light]) {
      // a soft upright band of light, brightest at its top edge
      context.fillStyle = along(
        context,
        [0, -3.2],
        [0, 3.2],
        [
          [0, fade(light, 0)],
          [0.14, fade(light, 0.8)],
          [0.32, fade(fill, 0.75)],
          [0.66, fade(deep, 0.34)],
          [1, fade(deep, 0)],
        ],
      );
      context.save();
      context.filter = "blur(4px)";
      context.fillRect(-0.7, -3.2, 1.4, 6.4);
      context.restore();
    },
  },
  sparkle: {
    reach: [1.6, 1.6],
    body: [0.6, 0.6],
    draw(context, [fill, deep, light]) {
      halo(context, fill, 1.6);
      context.beginPath();
      star(context, 4, 1.05, 0.2);
      solid(context, light, deep, 0.07);
    },
  },
  comet: {
    unit: 56,
    reach: [5.2, 1.2],
    body: [4, 0.2],
    draw(context, [fill, deep, light]) {
      context.translate(4, 0);
      halo(context, fill, 1.1);
      context.beginPath();
      context.moveTo(-9, 0);
      context.quadraticCurveTo(-2.6, -0.3, 0, -0.26);
      context.arc(0, 0, 0.26, -Math.PI / 2, Math.PI / 2);
      context.quadraticCurveTo(-2.6, 0.3, -9, 0);
      context.closePath();
      context.fillStyle = along(
        context,
        [-9, 0],
        [0.3, 0],
        [
          [0, fade(deep, 0)],
          [0.5, fade(deep, 0.42)],
          [0.84, fade(fill, 0.9)],
          [1, light],
        ],
      );
      context.fill();
      context.beginPath();
      context.arc(0, 0, 0.27, 0, TAU);
      solid(context, "#ffffff", deep, 0.05);
    },
  },
  lantern: {
    unit: 64,
    reach: [2.2, 2.2],
    body: [0.8, 1.1],
    draw(context, [fill, deep, light]) {
      halo(context, fill, 2.2);
      context.beginPath();
      context.moveTo(-0.5, -1);
      context.bezierCurveTo(-1, -0.5, -0.86, 0.6, -0.4, 1);
      context.lineTo(0.4, 1);
      context.bezierCurveTo(0.86, 0.6, 1, -0.5, 0.5, -1);
      context.closePath();
      solid(
        context,
        radial(
          context,
          1.2,
          [
            [0, "#FFFBE0"],
            [0.4, light],
            [1, fill],
          ],
          0,
          0.3,
        ),
        deep,
        0.08,
      );
      context.beginPath();
      for (const x of [-0.42, 0, 0.42]) {
        context.moveTo(x * 0.8, -1);
        context.quadraticCurveTo(x * 1.5, 0, x * 0.8, 1);
      }
      context.strokeStyle = fade(deep, 0.5);
      context.lineWidth = 0.05;
      context.stroke();
      context.fillStyle = deep;
      context.fillRect(-0.54, -1.1, 1.08, 0.14);
      context.fillRect(-0.44, 0.96, 0.88, 0.14);
    },
  },
  blossom: {
    reach: [1.15, 1.15],
    body: [0.8, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, 1);
      context.bezierCurveTo(1, 0.4, 1, -0.7, 0.2, -1);
      context.lineTo(0, -0.66);
      context.lineTo(-0.2, -1);
      context.bezierCurveTo(-1, -0.7, -1, 0.4, 0, 1);
      context.closePath();
      solid(
        context,
        radial(
          context,
          1.5,
          [
            [0, deep],
            [0.3, fill],
            [0.8, light],
          ],
          0,
          1,
        ),
        deep,
        0.07,
      );
    },
  },
  plane: {
    unit: 64,
    reach: [1.5, 1],
    body: [1.3, 0.7],
    draw(context, [fill, deep, light]) {
      // nose to the right, seen a little from above
      context.beginPath();
      context.moveTo(1.3, 0);
      context.lineTo(-1.2, -0.76);
      context.lineTo(-0.56, -0.02);
      context.closePath();
      solid(context, light, deep, 0.07);
      context.beginPath();
      context.moveTo(1.3, 0);
      context.lineTo(-1.2, 0.5);
      context.lineTo(-0.56, -0.02);
      context.closePath();
      solid(context, fill, deep, 0.07);
      context.beginPath();
      context.moveTo(1.3, 0);
      context.lineTo(-0.56, -0.02);
      context.lineTo(-0.72, 0.28);
      context.closePath();
      solid(context, deep, deep, 0.05);
    },
  },
  butterfly: {
    unit: 64,
    reach: [1.25, 1.2],
    body: [1.1, 1],
    draw(context, [fill, deep, light]) {
      for (const side of [-1, 1]) {
        context.save();
        context.scale(side, 1);
        context.beginPath();
        context.moveTo(0.04, -0.1);
        context.bezierCurveTo(0.4, -1.2, 1.2, -1.1, 1.14, -0.44);
        context.bezierCurveTo(1.1, -0.06, 0.5, 0.06, 0.04, 0.04);
        context.closePath();
        solid(
          context,
          radial(
            context,
            1.2,
            [
              [0, light],
              [0.55, fill],
              [1, deep],
            ],
            0.2,
            -0.3,
          ),
          deep,
          0.08,
        );
        context.beginPath();
        context.moveTo(0.04, 0.08);
        context.bezierCurveTo(0.6, 0.1, 0.9, 0.4, 0.66, 0.74);
        context.bezierCurveTo(0.44, 1, 0.1, 0.56, 0.04, 0.2);
        context.closePath();
        solid(context, fill, deep, 0.08);
        context.beginPath();
        context.arc(0.8, -0.56, 0.13, 0, TAU);
        context.fillStyle = light;
        context.fill();
        context.restore();
      }
      context.beginPath();
      context.ellipse(0, 0.1, 0.07, 0.56, 0, 0, TAU);
      context.fillStyle = deep;
      context.fill();
    },
  },
  ink: {
    unit: 120,
    reach: [1.25, 1.25],
    body: [1, 1],
    draw(context, [fill, deep]) {
      const lobes = 11;
      context.beginPath();
      for (let i = 0; i <= lobes * 8; i++) {
        const a = (i / (lobes * 8)) * TAU;
        const r =
          0.8 +
          Math.sin(a * 3 + 1) * 0.1 +
          Math.sin(a * 7 + 2) * 0.07 +
          Math.sin(a * 11) * 0.04;
        context[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      context.closePath();
      const edge = radial(context, 1, [
        [0, fade(deep, 0.85)],
        [0.62, fade(deep, 0.62)],
        [0.86, fade(fill, 0.7)],
        [1, fade(fill, 0.85)],
      ]);
      solid(context, edge, deep, 0.03);
      for (const [x, y, r] of [
        [0.98, 0.3, 0.07],
        [-0.86, 0.66, 0.05],
        [0.3, -1.04, 0.06],
        [-0.6, -0.9, 0.04],
      ]) {
        context.beginPath();
        context.arc(x, y, r, 0, TAU);
        context.fillStyle = fill;
        context.fill();
      }
    },
  },
  shard: {
    unit: 64,
    reach: [1, 1.5],
    body: [0.6, 1.3],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, -1.4);
      context.lineTo(0.62, -0.3);
      context.lineTo(0.3, 1.3);
      context.lineTo(-0.5, 0.4);
      context.lineTo(-0.34, -0.7);
      context.closePath();
      solid(context, fill, deep, 0.07);
      context.beginPath();
      context.moveTo(0, -1.4);
      context.lineTo(0.62, -0.3);
      context.lineTo(0.06, 0);
      context.closePath();
      context.fillStyle = light;
      context.fill();
      context.beginPath();
      context.moveTo(0.06, 0);
      context.lineTo(0.3, 1.3);
      context.lineTo(-0.5, 0.4);
      context.closePath();
      context.fillStyle = fade(deep, 0.5);
      context.fill();
    },
  },
  bead: {
    reach: [1.15, 1.15],
    body: [1, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      solid(
        context,
        radial(
          context,
          1.3,
          [
            [0, fade(light, 0.5)],
            [0.6, fade(fill, 0.8)],
            [1, deep],
          ],
          0.3,
          0.4,
        ),
        deep,
        0.1,
      );
      context.beginPath();
      context.arc(-0.34, -0.36, 0.22, 0, TAU);
      context.fillStyle = "#ffffff";
      context.fill();
    },
  },
  runnel: {
    unit: 90,
    reach: [1.7, 0.42],
    body: [1.5, 0.26],
    draw(context, [fill, deep, light]) {
      // a drop at the right end and the wet trail it leaves
      context.beginPath();
      context.moveTo(-1.65, 0);
      context.quadraticCurveTo(0.2, -0.05, 0.92, -0.2);
      context.arc(1.14, 0, 0.22, -2.1, 2.1);
      context.quadraticCurveTo(0.2, 0.05, -1.65, 0);
      context.closePath();
      context.fillStyle = along(
        context,
        [-1.65, 0],
        [1.3, 0],
        [
          [0, fade(fill, 0)],
          [0.5, fade(fill, 0.34)],
          [0.8, fade(fill, 0.9)],
          [1, fill],
        ],
      );
      context.fill();
      context.strokeStyle = fade(deep, 0.9);
      context.lineWidth = 0.035;
      context.stroke();
      context.beginPath();
      context.arc(1.14, -0.12, 0.08, 0, TAU);
      context.fillStyle = light;
      context.fill();
    },
  },
  ray: {
    reach: [1.1, 0.34],
    body: [1, 0.2],
    draw(context, [fill, , light]) {
      context.save();
      context.filter = "blur(3px)";
      context.beginPath();
      context.moveTo(-1, -0.02);
      context.lineTo(1, -0.26);
      context.lineTo(1, 0.26);
      context.lineTo(-1, 0.02);
      context.closePath();
      context.fillStyle = along(
        context,
        [-1, 0],
        [1, 0],
        [
          [0, fade(light, 0.95)],
          [0.5, fade(fill, 0.7)],
          [1, fade(fill, 0)],
        ],
      );
      context.fill();
      context.restore();
    },
  },
  moon: {
    unit: 72,
    reach: [1.6, 1.6],
    body: [1, 1],
    draw(context, [fill, deep, light], frame) {
      halo(context, fill, 1.6);
      context.beginPath();
      context.arc(0, 0, 1, 0, TAU);
      context.fillStyle = fade(deep, 0.36);
      context.fill();
      context.strokeStyle = deep;
      context.lineWidth = 0.08;
      context.stroke();
      // new moon to new moon: the lit part grows from the right
      const phase = (frame + 1) / 9;
      const lit = phase < 0.5 ? 1 : -1;
      const bulge = Math.cos(phase * TAU);
      context.beginPath();
      context.arc(0, 0, 0.96, -Math.PI / 2, Math.PI / 2, lit < 0);
      context.ellipse(
        0,
        0,
        Math.abs(bulge) * 0.96,
        0.96,
        0,
        Math.PI / 2,
        -Math.PI / 2,
        lit < 0 ? bulge > 0 : bulge < 0,
      );
      context.closePath();
      context.fillStyle = radial(
        context,
        1.1,
        [
          [0, light],
          [1, fill],
        ],
        lit * 0.3,
        -0.2,
      );
      context.fill();
    },
  },
  rosette: {
    reach: [1.05, 1.05],
    body: [1, 1],
    unit: 220,
    draw(context, [fill, deep, light]) {
      const petals = 12;
      for (const [line, stroke] of [
        [0.016, deep],
        [0.007, light],
      ] as const) {
        context.beginPath();
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * TAU;
          const b = ((i + 1) / petals) * TAU;
          context.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3);
          context.quadraticCurveTo(
            Math.cos(a + 0.5) * 1.3,
            Math.sin(a + 0.5) * 1.3,
            Math.cos(b) * 0.3,
            Math.sin(b) * 0.3,
          );
        }
        context.moveTo(0.98, 0);
        context.arc(0, 0, 0.98, 0, TAU);
        context.moveTo(0.3, 0);
        context.arc(0, 0, 0.3, 0, TAU);
        context.strokeStyle = stroke;
        context.lineWidth = line;
        context.stroke();
      }
      context.beginPath();
      context.arc(0, 0, 0.12, 0, TAU);
      context.fillStyle = fill;
      context.fill();
    },
  },
  wave: {
    reach: [1.45, 0.16],
    body: [1.4, 0.1],
    unit: 280,
    draw(context, [fill, deep, light]) {
      const path = () => {
        context.beginPath();
        for (let i = 0; i <= 72; i++) {
          const x = -1.4 + (i / 72) * 2.8;
          const y = Math.sin(x * 7) * 0.09 + Math.sin(x * 16 + 1) * 0.02;
          context[i ? "lineTo" : "moveTo"](x, y);
        }
      };
      context.lineCap = "round";
      const span = (colour: string) =>
        along(
          context,
          [-1.4, 0],
          [1.4, 0],
          [
            [0, fade(colour, 0)],
            [0.2, colour],
            [0.8, colour],
            [1, fade(colour, 0)],
          ],
        );
      path();
      context.strokeStyle = span(deep);
      context.lineWidth = 0.02;
      context.stroke();
      path();
      context.strokeStyle = span(fill);
      context.lineWidth = 0.011;
      context.stroke();
      path();
      context.strokeStyle = span(light);
      context.lineWidth = 0.003;
      context.stroke();
    },
  },
  feather: {
    unit: 64,
    reach: [0.8, 1.5],
    body: [0.5, 1.3],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0.02, 1);
      context.bezierCurveTo(0.8, 0.6, 0.66, -0.8, 0.04, -1.36);
      context.bezierCurveTo(-0.6, -0.9, -0.74, 0.5, 0.02, 1);
      context.closePath();
      solid(
        context,
        along(
          context,
          [0, -1.3],
          [0, 1],
          [
            [0, light],
            [0.6, fill],
            [1, deep],
          ],
        ),
        deep,
        0.06,
      );
      context.beginPath();
      context.moveTo(0.02, 1.4);
      context.quadraticCurveTo(0.06, 0, 0.04, -1.2);
      for (let i = 0; i < 6; i++) {
        const y = -0.84 + i * 0.3;
        context.moveTo(0.04, y + 0.1);
        context.lineTo(0.42, y - 0.12);
        context.moveTo(0.04, y + 0.1);
        context.lineTo(-0.38, y - 0.12);
      }
      context.strokeStyle = fade(deep, 0.7);
      context.lineWidth = 0.035;
      context.lineCap = "round";
      context.stroke();
    },
  },
  seed: {
    unit: 64,
    reach: [1.1, 1.5],
    body: [0.7, 1.2],
    draw(context, [fill, deep, light]) {
      context.lineCap = "round";
      const hairs = () => {
        context.beginPath();
        for (let i = 0; i < 13; i++) {
          const a = -Math.PI / 2 + (i - 6) * 0.3;
          context.moveTo(0, -0.26);
          context.lineTo(Math.cos(a) * 0.92, -0.26 + Math.sin(a) * 0.92);
        }
        context.moveTo(0, -0.26);
        context.lineTo(0, 1.16);
      };
      hairs();
      context.strokeStyle = deep;
      context.lineWidth = 0.1;
      context.stroke();
      hairs();
      context.strokeStyle = light;
      context.lineWidth = 0.045;
      context.stroke();
      for (let i = 0; i < 13; i++) {
        const a = -Math.PI / 2 + (i - 6) * 0.3;
        context.beginPath();
        context.arc(
          Math.cos(a) * 0.92,
          -0.26 + Math.sin(a) * 0.92,
          0.07,
          0,
          TAU,
        );
        context.fillStyle = fill;
        context.fill();
      }
      context.beginPath();
      context.ellipse(0, 1.2, 0.08, 0.2, 0, 0, TAU);
      context.fillStyle = deep;
      context.fill();
    },
  },
  heart: {
    unit: 64,
    reach: [1.5, 1.4],
    body: [1, 1],
    draw(context, [fill, deep, light]) {
      context.beginPath();
      context.moveTo(0, 1);
      context.bezierCurveTo(-1.5, -0.1, -0.84, -1.2, 0, -0.42);
      context.bezierCurveTo(0.84, -1.2, 1.5, -0.1, 0, 1);
      context.closePath();
      solid(
        context,
        radial(
          context,
          1.4,
          [
            [0, light],
            [0.5, fill],
            [1, deep],
          ],
          -0.3,
          -0.5,
        ),
        deep,
        0.09,
      );
    },
  },
};

/** How far a drawing reaches from its centre, at size 1 */
export const shapeReach = (shape: EffectShape) => SHAPES[shape].reach;

/** Canvas pixels per unit of a drawing's own canvas */
export const shapeUnit = (shape: EffectShape) => SHAPES[shape].unit ?? 40;

/** Half width and height of the solid part, at size 1: what covers the card */
export const shapeBody = (shape: EffectShape) =>
  SHAPES[shape].body ?? SHAPES[shape].reach;

export function drawShape(
  context: CanvasRenderingContext2D,
  shape: EffectShape,
  tone: Tone,
  frame: number,
) {
  SHAPES[shape].draw(context, tone, frame);
}
