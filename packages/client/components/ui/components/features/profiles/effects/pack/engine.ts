/**
 * The design pack's effects inside the app. Each collection's maker is run once
 * with the kit; its shapes are kept under `<collection>/<shape>` so no name can
 * clash with another collection or with `shapes.ts`.
 */

import { type PackMade, type PackShapeDef, type PackSpec, K } from "./kit";
import { MAKERS } from "./specs.generated";

/** A pack shape's name: always `<collection>/<shape>` */
export type PackShape = `${string}/${string}`;

const SHAPES = new Map<string, PackShapeDef>();
const SPECS = new Map<string, PackSpec>();

for (const [collection, make] of MAKERS) {
  const made: PackMade = make(K);
  for (const [name, def] of Object.entries(made.shapes ?? {})) {
    SHAPES.set(`${collection}/${name}`, def);
  }
  for (const [id, spec] of Object.entries(made.effects ?? {})) {
    SPECS.set(id, {
      ...spec,
      layers: spec.layers.map((layer) => ({
        ...layer,
        shape: `${collection}/${layer.shape}`,
      })),
    });
  }
}

export const packSpec = (id: string) => SPECS.get(id);

export const isPackShape = (shape: string): shape is PackShape =>
  SHAPES.has(shape);

export const packShapeReach = (shape: PackShape) =>
  SHAPES.get(shape)?.reach ?? [1, 1];

/** Canvas pixels per unit, as the gallery drew them */
export const packShapeUnit = (shape: PackShape) =>
  SHAPES.get(shape)?.unit ?? 64;

export const packShapeWide = (shape: PackShape) => !!SHAPES.get(shape)?.wide;

/**
 * Half width and height of the solid part. The pack gives the solid share of
 * the reach box; an ellipse with the same area has these half axes.
 */
export function packShapeBody(shape: PackShape): [number, number] {
  const def = SHAPES.get(shape);
  if (!def) return [1, 1];
  const k = Math.sqrt((4 * (def.body ?? 0.6)) / Math.PI);
  return [def.reach[0] * k, def.reach[1] * k];
}

export function drawPackShape(
  context: CanvasRenderingContext2D,
  shape: PackShape,
  tone: [string, string, string],
  frame: number,
) {
  SHAPES.get(shape)?.draw(context, tone, frame);
}
