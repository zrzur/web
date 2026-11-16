/* eslint-disable */
// @ts-nocheck
/** Generated from Zrzur's design pack by its export script. Edit the pack, not this file. Each maker is one collection's effects, drawn with the kit in ./kit. */

import type { PackKit, PackMade } from "./kit";

export const MAKERS: [string, (K: PackKit) => PackMade][] = [
  ["ranks", (K) => ({
    shapes: {
      chevron: { reach: [1, 0.7], body: 0.3, draw(c, t) { c.beginPath(); c.moveTo(-0.9, 0.5); c.lineTo(0, -0.4); c.lineTo(0.9, 0.5); c.lineWidth = 0.32; c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#0C0A16"; c.stroke(); c.lineWidth = 0.18; c.strokeStyle = t[2]; c.stroke(); } },
      shard: { reach: [0.6, 1], body: 0.5, draw(c, t) { K.shape(c, [[0, -1], [0.55, 0], [0, 1], [-0.55, 0]]); K.solid(c, K.along(c, [-0.5, -1], [0.5, 1], [[0, "#FFFFFF"], [0.5, t[0]], [1, t[1]]]), "#0C0A16", 0.08); } },
      glint: { reach: [1, 1], body: 0.2, draw(c, t) { c.beginPath(); c.moveTo(0, -1); c.quadraticCurveTo(0.12, -0.12, 1, 0); c.quadraticCurveTo(0.12, 0.12, 0, 1); c.quadraticCurveTo(-0.12, 0.12, -1, 0); c.quadraticCurveTo(-0.12, -0.12, 0, -1); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "rank-up": {
        tones: [["#E8B030", "#8A5A08", "#FFF4C0"], ["#6AA8FF", "#1A3A9A", "#E8F6FF"], ["#B060F0", "#4A1488", "#F8E0FF"]],
        still: 1700,
        layers: [
          // chevrons climb in a column, one after another, then shards and glints burst
          { count: 6, shape: "chevron", size: [0.07, 0.07], path: (t, seed, index) => ({ x: 0.5, y: 0.95 - t * 0.7 - index * 0.04 }), life: 0.45, start: (index) => 0.02 + index * 0.05, fade: K.soft, colours: [0, 1, 2] },
          ...K.depth({ count: 16, shape: "shard", size: [0.016, 0.03], path: (t, seed, index) => { const ang = (index / 16) * K.TAU; const r = 0.3 * (1 - (1 - t) ** 2); return { x: 0.5 + Math.cos(ang) * r, y: 0.3 + Math.sin(ang) * r * 0.8 + t * t * 0.2, angle: ang + Math.PI / 2 }; }, life: 0.5, start: () => 0.38, fade: K.soft, colours: [0, 1, 2] }),
          { count: 14, shape: "glint", size: [0.012, 0.024], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5) * 0.8 }), life: 0.3, fade: K.glow, colours: [0, 1, 2] },
        ],
      },
    },
  })],
  ["hud", (K) => ({
    shapes: {
      hit: { reach: [1, 1], body: 0.2, draw(c, t) { c.lineCap = "round"; for (const [w, col] of [[0.34, "#0C0A16"], [0.18, t[2]]]) { c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(-0.9, -0.9); c.lineTo(-0.35, -0.35); c.moveTo(0.9, -0.9); c.lineTo(0.35, -0.35); c.moveTo(-0.9, 0.9); c.lineTo(-0.35, 0.35); c.moveTo(0.9, 0.9); c.lineTo(0.35, 0.35); c.stroke(); } } },
      orb: { reach: [1, 1], body: 0.3, draw(c, t) { K.halo(c, 1, t[0], 0.7); c.beginPath(); c.arc(0, 0, 0.36, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "hit-markers": {
        tones: [K.TONES.aqua, K.TONES.red, K.TONES.lime],
        still: 1500,
        layers: [
          { count: 10, shape: "hit", size: [0.03, 0.045], path: (t, seed, index) => ({ x: 0.15 + seed * 0.7, y: 0.12 + K.random(index, 4) * 0.6, grow: t < 0.2 ? 1.3 - t * 1.5 : 1 }), life: 0.22, fade: K.pop, colours: [0, 1] },
          ...K.depth({ count: 22, shape: "orb", size: [0.008, 0.016], path: K.rise(0.05, 0.04), life: 0.7, fade: K.soft, colours: [2, 0] }),
        ],
      },
    },
  })],
  ["arcade", (K) => {
    const heart = [".ooo.ooo.", "ohhhohhho", "ohlhhhhho", "ohhhhhhho", ".ohhhhho.", "..ohhho..", "...oho...", "....o...."];
    const coin = ["..oooo..", ".oyyyyo.", "oyylyyyo", "oylyydyo", "oyyyydyo", "oyyyddyo", ".oyyyyo.", "..oooo.."];
    const plus = [".w.", "www", ".w."];
    return {
      shapes: {
        pxcoin: { reach: [1, 1], body: 0.7, draw: (c, t) => K.px(c, coin, { o: t[1], y: t[0], l: t[2], d: t[1] }) },
        pxheart: { reach: [1, 1], body: 0.6, draw: (c, t) => K.px(c, heart, { o: t[1], h: t[0], l: t[2] }) },
        pxplus: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, plus, { w: t[2] }) },
      },
      effects: {
        "coin-rush": {
          tones: [K.TONES.gold, K.TONES.pink, K.TONES.aqua],
          still: 1500,
          layers: [
            {
              count: 16,
              shape: "pxcoin",
              size: [0.034, 0.05],
              path: (t, seed, index) => ({
                x: seed + (K.random(index, 4) - 0.5) * 0.12 * t,
                y: 1.06 - Math.sin(Math.PI * t) * (0.5 + K.random(index, 5) * 0.5),
                squash: 0.25 + 0.75 * Math.abs(Math.cos(t * 12 + seed * 9)),
              }),
              life: 0.55,
              fade: K.soft,
              colours: [0],
            },
            {
              count: 6,
              shape: "pxheart",
              size: [0.032, 0.046],
              path: (t, seed) => ({ x: seed, y: 1.08 - Math.round(t * 30) / 30 * 1.16 }),
              life: 0.85,
              fade: K.soft,
              colours: [1],
            },
            {
              count: 16,
              shape: "pxplus",
              size: [0.012, 0.02],
              path: (t, seed, index) => ({ x: seed, y: K.random(index, 5), grow: t < 0.5 ? 1 : 1.6 }),
              life: 0.22,
              fade: K.glow,
              colours: [2, 0],
            },
          ],
        },
      },
    };
  }],
  ["playerone", (K) => ({
    shapes: {
      chevron: {
        reach: [1, 1],
        body: 0.35,
        draw(c, t) {
          for (const y of [-0.45, 0.25]) {
            c.beginPath();
            c.moveTo(-0.8, y + 0.5); c.lineTo(0, y - 0.3); c.lineTo(0.8, y + 0.5);
            c.lineCap = "round"; c.lineJoin = "round";
            c.lineWidth = 0.42; c.strokeStyle = t[1]; c.stroke();
            c.lineWidth = 0.28; c.strokeStyle = y < 0 ? t[2] : t[0]; c.stroke();
          }
        },
      },
      xpbit: {
        reach: [1, 1],
        body: 0.6,
        draw(c, t) {
          c.beginPath(); c.roundRect(-0.7, -0.7, 1.4, 1.4, 0.3);
          K.solid(c, t[0], t[1], 0.14);
          c.fillStyle = t[2]; c.fillRect(-0.4, -0.45, 0.8, 0.3);
        },
      },
      lvring: {
        reach: [1.05, 1.05],
        wide: true,
        body: 0.06,
        unit: 160,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.96, 0, K.TAU);
          c.lineWidth = 0.03; c.strokeStyle = K.fade(t[0], 0.9); c.stroke();
          c.beginPath(); c.arc(0, 0, 0.86, 0, K.TAU);
          c.lineWidth = 0.012; c.strokeStyle = K.fade(t[2], 0.8); c.stroke();
        },
      },
    },
    effects: {
      "level-rise": {
        tones: [K.TONES.lime, K.TONES.violet, K.TONES.white],
        still: 1300,
        layers: [
          {
            count: 3,
            shape: "lvring",
            size: [0.3, 0.3],
            path: (t) => ({ x: 0.5, y: 0.42, grow: 0.15 + t * 1.1 }),
            life: 0.42,
            start: (i) => 0.04 + i * 0.22,
            fade: (t) => Math.sin(Math.PI * t) * 0.6,
            colours: [0, 1, 0],
          },
          ...K.depth({
            count: 12,
            shape: "chevron",
            size: [0.026, 0.04],
            path: (t, seed) => ({ x: seed, y: 1.1 - t * t * 0.4 - t * 0.9 }),
            life: 0.5,
            fade: K.soft,
            colours: [0, 1],
          }, 0.7, 0.4),
          ...K.depth({
            count: 16,
            shape: "xpbit",
            size: [0.009, 0.015],
            path: (t, seed) => ({ x: seed + Math.sin(t * 5 + seed * 20) * 0.03, y: 1.08 - t * 1.16, angle: t * 4 + seed * 6 }),
            life: 0.7,
            fade: K.soft,
            colours: [0, 2, 1],
          }),
        ],
      },
    },
  })],
  ["arena", (K) => ({
    shapes: {
      streamer: {
        reach: [0.5, 1.3],
        body: 0.35,
        draw(c, t) {
          c.beginPath();
          for (let i = 0; i <= 24; i++) { const y = -1.2 + (i / 24) * 2.4; const x = Math.sin(i * 0.62) * 0.26 - 0.2; i ? c.lineTo(x, y) : c.moveTo(x, y); }
          for (let i = 24; i >= 0; i--) { const y = -1.2 + (i / 24) * 2.4; c.lineTo(Math.sin(i * 0.62) * 0.26 + 0.2, y); }
          c.closePath();
          K.solid(c, K.along(c, [0, -1.2], [0, 1.2], [[0, t[2]], [0.4, t[0]], [1, t[1]]]), t[1], 0.05);
        },
      },
      medal: {
        reach: [0.8, 1.2],
        body: 0.5,
        draw(c, t) {
          K.shape(c, [[-0.5, -1.15], [-0.1, -1.15], [0.18, -0.2], [-0.2, -0.2]]); K.solid(c, "#E5484D", "#8C1D22", 0.06);
          K.shape(c, [[0.5, -1.15], [0.1, -1.15], [-0.18, -0.2], [0.2, -0.2]]); K.solid(c, "#F4F6FF", "#5A6078", 0.06);
          c.beginPath(); c.arc(0, 0.4, 0.62, 0, K.TAU);
          K.solid(c, K.radial(c, 0.9, [[0, t[2]], [0.6, t[0]], [1, t[1]]], -0.2, 0.2), t[1], 0.08);
          c.beginPath(); c.arc(0, 0.4, 0.4, 0, K.TAU); c.lineWidth = 0.06; c.strokeStyle = t[1]; c.stroke();
        },
      },
    },
    effects: {
      victory: {
        tones: [K.TONES.red, K.TONES.gold, K.TONES.white, K.TONES.sky],
        still: 1900,
        layers: [
          ...K.depth({
            count: 20,
            shape: "streamer",
            size: [0.036, 0.052],
            path: K.fall(0.07, 0.04, 7, 2),
            life: 0.7,
            fade: K.soft,
            colours: [0, 1, 2, 3],
          }, 0.8, 0.4),
          {
            count: 4,
            shape: "medal",
            size: [0.036, 0.046],
            path: (t, seed) => ({ x: 0.12 + seed * 0.76, y: -0.1 + t * 1.2, angle: Math.sin(t * 7 + seed * 9) * 0.4 }),
            life: 0.8,
            fade: K.soft,
            colours: [1],
          },
        ],
      },
    },
  })],
  ["realm", (K) => {
    const glyphs = [
      [[-2, -4, -2, 4], [-2, -4, 2.4, -0.6], [2.4, -0.6, -2, 1.4]],
      [[0, -4, 0, 4], [-2.6, -1, 0, -4], [0, -4, 2.6, -1]],
      [[0, -4, 2.4, -1], [2.4, -1, 0, 2], [0, 2, -2.4, -1], [-2.4, -1, 0, -4], [0, 2, 0, 4]],
      [[-2, 4, -2, -4], [-2, -4, 2.2, -0.8], [2.2, -0.8, 2.2, 4]],
      [[0, -4, 0, 4], [-2.6, -1.6, 2.6, 1.6]],
      [[0, -4, 0, 4], [-2.4, -4, -2.4, -1], [-2.4, -1, 2.4, -1], [2.4, -1, 2.4, -4]],
    ];
    return {
      shapes: {
        rune: {
          reach: [1.2, 1.4],
          body: 0.25,
          draw(c, t, frame) {
            K.halo(c, 1.2, t[0], 0.35);
            c.lineCap = "round";
            for (const [width, colour] of [[0.3, t[1]], [0.17, t[2]]]) {
              c.lineWidth = width; c.strokeStyle = colour; c.beginPath();
              for (const [a, b, d, e] of glyphs[frame % 6]) { c.moveTo(a / 4.4, b / 4.4); c.lineTo(d / 4.4, e / 4.4); }
              c.stroke();
            }
          },
        },
        mote: {
          reach: [1, 1],
          body: 0.4,
          draw(c, t) { K.shape(c, [[0, -1], [0.55, 0], [0, 1], [-0.55, 0]]); K.solid(c, t[2], t[0], 0.16); },
        },
      },
      effects: {
        arcane: {
          tones: [K.TONES.violet, K.TONES.gold],
          still: 1900,
          layers: [
            {
              count: 13,
              shape: "rune",
              size: [0.036, 0.054],
              path: (t, seed, index) => ({ x: seed, y: 1.05 - t * 1.05, angle: Math.sin(t * 3 + seed * 9) * 0.2, frame: index % 6 }),
              life: 0.8,
              fade: K.twinkle,
              colours: [0, 0, 1],
            },
            ...K.depth({
              count: 20,
              shape: "mote",
              size: [0.008, 0.014],
              path: K.rise(0.04),
              life: 0.6,
              fade: K.twinkle,
              colours: [1, 0],
            }),
          ],
        },
      },
    };
  }],
  ["raceway", (K) => ({
    shapes: {
      dash: {
        reach: [1.6, 0.14],
        body: 0.5,
        draw(c, t) {
          c.fillStyle = K.along(c, [-1.6, 0], [1.6, 0], [[0, K.fade(t[2], 0.95)], [0.25, K.fade(t[0], 0.8)], [1, K.fade(t[0], 0)]]);
          c.beginPath(); c.moveTo(-1.6, 0); c.lineTo(-1.3, -0.1); c.lineTo(1.6, 0); c.lineTo(-1.3, 0.1); c.closePath(); c.fill();
        },
      },
      check: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.fillStyle = t[1]; c.fillRect(-0.95, -0.95, 1.9, 1.9);
          c.fillStyle = t[2]; c.fillRect(-0.85, -0.85, 0.85, 0.85); c.fillRect(0, 0, 0.85, 0.85);
          c.fillStyle = "#15161C"; c.fillRect(0, -0.85, 0.85, 0.85); c.fillRect(-0.85, 0, 0.85, 0.85);
        },
      },
    },
    effects: {
      slipstream: {
        tones: [K.TONES.white, K.TONES.red, K.TONES.gold],
        still: 1700,
        layers: [
          ...K.depth({
            count: 30,
            shape: "dash",
            size: [0.08, 0.14],
            path: (t, seed) => ({ x: 1.25 - t * 1.6, y: seed }),
            life: 0.26,
            fade: K.soft,
            colours: [0, 0, 1, 2],
          }, 1, 0.4),
          {
            count: 9,
            shape: "check",
            size: [0.016, 0.024],
            path: (t, seed) => ({ x: 1.1 - t * 1.3, y: seed + Math.sin(t * 5 + seed * 9) * 0.05, angle: t * 6 + seed * 6, squash: 0.3 + 0.7 * Math.abs(Math.cos(t * 9 + seed * 5)) }),
            life: 0.55,
            fade: K.soft,
            colours: [0],
          },
        ],
      },
    },
  })],
  ["orbit", (K) => ({
    shapes: {
      rocket: {
        reach: [0.8, 1.7],
        body: 0.4,
        draw(c, t) {
          // flame
          c.beginPath(); c.moveTo(-0.3, 0.75); c.quadraticCurveTo(0, 1.9, 0.3, 0.75); c.closePath();
          c.fillStyle = K.along(c, [0, 0.7], [0, 1.6], [[0, "#FFF0BE"], [0.4, "#FFC84A"], [1, K.fade("#FF6A2B", 0)]]); c.fill();
          // fins
          K.shape(c, [[-0.38, 0.2], [-0.75, 0.85], [-0.38, 0.72]]); K.solid(c, t[0], t[1], 0.06);
          K.shape(c, [[0.38, 0.2], [0.75, 0.85], [0.38, 0.72]]); K.solid(c, t[0], t[1], 0.06);
          // body
          c.beginPath(); c.moveTo(0, -1.5); c.bezierCurveTo(0.55, -0.9, 0.45, 0.2, 0.38, 0.78); c.lineTo(-0.38, 0.78); c.bezierCurveTo(-0.45, 0.2, -0.55, -0.9, 0, -1.5); c.closePath();
          K.solid(c, K.along(c, [-0.5, 0], [0.5, 0], [[0, "#FFFFFF"], [1, "#B8C0D4"]]), "#2B3044", 0.07);
          c.beginPath(); c.moveTo(0, -1.5); c.bezierCurveTo(0.3, -1.2, 0.4, -0.95, 0.42, -0.8); c.lineTo(-0.42, -0.8); c.bezierCurveTo(-0.4, -0.95, -0.3, -1.2, 0, -1.5); c.closePath();
          K.solid(c, t[0], t[1], 0.06);
          c.beginPath(); c.arc(0, -0.25, 0.2, 0, K.TAU); K.solid(c, "#6FB4F2", "#2B3044", 0.07);
        },
      },
      puff: {
        reach: [1, 1],
        body: 0.2,
        draw(c, t) { K.halo(c, 1, t[2], 0.5); },
      },
      glintdot: {
        reach: [1, 1],
        body: 0.2,
        draw(c, t) {
          c.beginPath(); c.moveTo(0, -1); c.quadraticCurveTo(0.12, -0.12, 1, 0); c.quadraticCurveTo(0.12, 0.12, 0, 1); c.quadraticCurveTo(-0.12, 0.12, -1, 0); c.quadraticCurveTo(-0.12, -0.12, 0, -1);
          K.solid(c, t[2], t[0], 0.05);
        },
      },
    },
    effects: {
      liftoff: {
        tones: [K.TONES.red, K.TONES.violet, K.TONES.white],
        still: 1700,
        layers: [
          {
            count: 22,
            shape: "puff",
            size: [0.03, 0.06],
            path: (t, seed) => ({ x: seed, y: 1.04 - t * 0.35, grow: 0.5 + t }),
            life: 0.45,
            alpha: 0.4,
            fade: K.glow,
            colours: [2],
          },
          {
            count: 7,
            shape: "rocket",
            size: [0.042, 0.06],
            path: (t, seed) => ({ x: 0.1 + seed * 0.8 + Math.sin(t * 5 + seed * 9) * 0.015, y: 1.15 - (t * 0.6 + t * t * 0.75), angle: Math.sin(t * 5 + seed * 9) * 0.07 }),
            life: 0.6,
            fade: K.soft,
            colours: [0, 1],
          },
          {
            count: 18,
            shape: "glintdot",
            size: [0.008, 0.016],
            path: (t, seed, index) => ({ x: seed, y: K.random(index, 5) * 0.9 }),
            life: 0.3,
            fade: K.glow,
            colours: [2, 1],
          },
        ],
      },
    },
  })],
  ["haunt", (K) => ({
    shapes: {
      ghost: {
        reach: [1, 1.2],
        body: 0.6,
        draw(c, t) {
          c.beginPath(); c.moveTo(-0.85, 1); c.lineTo(-0.85, -0.15); c.arc(0, -0.15, 0.85, Math.PI, 0); c.lineTo(0.85, 1);
          c.lineTo(0.57, 0.74); c.lineTo(0.28, 1); c.lineTo(0, 0.74); c.lineTo(-0.28, 1); c.lineTo(-0.57, 0.74); c.closePath();
          K.solid(c, K.along(c, [0, -1], [0, 1], [[0, "#FFFFFF"], [1, t[0]]]), t[1], 0.07);
          c.fillStyle = "#2A1B4A";
          for (const x of [-0.32, 0.32]) { c.beginPath(); c.ellipse(x, -0.2, 0.14, 0.2, 0, 0, K.TAU); c.fill(); }
          c.beginPath(); c.ellipse(0, 0.26, 0.12, 0.16, 0, 0, K.TAU); c.fill();
        },
      },
      bat: {
        reach: [1.1, 0.6],
        body: 0.4,
        draw(c, t) {
          const p = [[0, -0.07], [-0.07, -0.31], [-0.19, -0.36], [-0.21, -0.48], [-0.29, -0.14], [-0.6, -0.36], [-1, -0.14], [-0.74, 0.12], [-0.4, 0.14], [0, 0.29], [0.4, 0.14], [0.74, 0.12], [1, -0.14], [0.6, -0.36], [0.29, -0.14], [0.21, -0.48], [0.19, -0.36], [0.07, -0.31]];
          K.shape(c, p); K.solid(c, t[0], t[2], 0.05);
        },
      },
    },
    effects: {
      boo: {
        tones: [K.TONES.violet, ["#4A3A8A", "#170F2B", "#D9CDFF"]],
        still: 2000,
        layers: [
          {
            count: 8,
            shape: "ghost",
            size: [0.034, 0.052],
            path: (t, seed) => ({ x: seed + Math.sin(t * 5 + seed * 20) * 0.05, y: 1.1 - t * 1.1, angle: Math.sin(t * 5 + seed * 20 + 1.2) * 0.22 }),
            life: 0.85,
            fade: (t) => K.soft(t) * 0.9,
            colours: [0],
          },
          {
            count: 7,
            shape: "bat",
            size: [0.026, 0.04],
            path: (t, seed, index) => ({
              x: index % 2 ? -0.1 + t * 1.2 : 1.1 - t * 1.2,
              y: 0.06 + seed * 0.6 + Math.sin(t * 10 + seed * 7) * 0.03,
              squash: 0.45 + 0.55 * Math.abs(Math.cos(t * 44)),
              angle: Math.sin(t * 10 + seed * 7) * 0.2,
            }),
            life: 0.5,
            fade: K.soft,
            colours: [1],
          },
        ],
      },
    },
  })],
  ["neoncoast", (K) => ({
    shapes: {
      bill: {
        reach: [1.3, 0.7],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.roundRect(-1.25, -0.62, 2.5, 1.24, 0.1); K.solid(c, K.along(c, [0, -0.6], [0, 0.6], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), t[1], 0.07);
          c.strokeStyle = t[1]; c.lineWidth = 0.06; c.strokeRect(-1.05, -0.44, 2.1, 0.88);
          c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); K.solid(c, t[2], t[1], 0.06);
        },
      },
      neonbit: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.26, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "cash-rain": {
        tones: [K.TONES.green, K.TONES.mint, K.TONES.pink, K.TONES.aqua],
        still: 1900,
        layers: [
          ...K.depth({ count: 22, shape: "bill", size: [0.022, 0.034], path: K.fall(0.08, 0.05, 9, 2.4), life: 0.72, fade: K.soft, colours: [0, 1] }, 0.8, 0.4),
          ...K.depth({ count: 16, shape: "neonbit", size: [0.008, 0.014], path: K.rise(0.04), life: 0.7, fade: K.twinkle, colours: [2, 3] }),
        ],
      },
    },
  })],
  ["pirate", (K) => ({
    shapes: {
      doubloon: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.94, 0, K.TAU); K.solid(c, K.radial(c, 1.2, [[0, t[2]], [0.5, t[0]], [1, t[1]]], -0.3, -0.3), t[1], 0.09);
          c.beginPath(); c.arc(0, 0, 0.66, 0, K.TAU); c.lineWidth = 0.08; c.strokeStyle = t[1]; c.stroke();
          K.shape(c, [[0, -0.42], [0.36, 0], [0, 0.42], [-0.36, 0]]); c.fillStyle = t[1]; c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
        },
      },
      jewel: {
        reach: [0.8, 1],
        body: 0.6,
        draw(c, t) {
          K.shape(c, [[-0.45, -0.95], [0.45, -0.95], [0.8, -0.4], [0, 1], [-0.8, -0.4]]); K.solid(c, t[0], t[1], 0.08);
          K.shape(c, [[-0.45, -0.95], [0.45, -0.95], [0.3, -0.4], [-0.3, -0.4]]); c.fillStyle = t[2]; c.fill();
          c.strokeStyle = t[1]; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.8, -0.4); c.lineTo(0.8, -0.4); c.moveTo(-0.3, -0.4); c.lineTo(0, 1); c.lineTo(0.3, -0.4); c.stroke();
        },
      },
    },
    effects: {
      doubloons: {
        tones: [K.TONES.gold, K.TONES.red, K.TONES.mint],
        still: 1900,
        layers: [
          ...K.depth({ count: 20, shape: "doubloon", size: [0.018, 0.028], path: K.fall(0.04, 0, 12, 0), life: 0.62, fade: K.soft, colours: [0] }, 0.8, 0.4),
          { count: 6, shape: "jewel", size: [0.018, 0.026], path: K.fall(0.05, 0.03, 0, 1.5), life: 0.7, fade: K.soft, colours: [1, 2] },
        ],
      },
    },
  })],
  ["nightdrive", (K) => ({
    shapes: {
      trail: {
        reach: [2.2, 0.16],
        body: 0.5,
        draw(c, t) { c.fillStyle = K.along(c, [-2.2, 0], [2.2, 0], [[0, K.fade(t[0], 0)], [0.8, K.fade(t[0], 0.85)], [1, t[2]]]); c.beginPath(); c.ellipse(0, 0, 2.2, 0.13, 0, 0, K.TAU); c.fill(); },
      },
      bokehdot: { reach: [1, 1], body: 0.25, unit: 80, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.9, 0, K.TAU); c.fillStyle = K.radial(c, 0.9, [[0, K.fade(t[0], 0.3)], [0.85, K.fade(t[0], 0.45)], [1, K.fade(t[0], 0)]]); c.fill(); } },
    },
    effects: {
      "light-trails": {
        tones: [["#FF2A3A", "#8A0A14", "#FFD0D4"], K.TONES.white, K.TONES.gold],
        still: 1700,
        layers: [
          ...K.depth({ count: 10, shape: "bokehdot", size: [0.03, 0.06], path: (t, seed, index) => ({ x: seed, y: 0.1 + K.random(index, 5) * 0.8, grow: 0.8 + t * 0.3 }), life: 0.6, fade: K.glow, colours: [0, 2, 1] }, 0.9, 0.4),
          ...K.depth({ count: 20, shape: "trail", size: [0.06, 0.12], path: (t, seed, index) => ({ x: index % 2 ? -0.3 + t * 1.6 : 1.3 - t * 1.6, y: 0.1 + seed * 0.85, angle: index % 2 ? 0 : Math.PI }), life: 0.3, fade: K.soft, colours: [0, 1, 0] }, 1, 0.4),
        ],
      },
    },
  })],
  ["gamerroom", (K) => ({
    shapes: {
      keycap: {
        reach: [1, 1],
        body: 0.85,
        draw(c, t, frame) {
          c.beginPath(); c.roundRect(-0.92, -0.86, 1.84, 1.84, 0.26); K.solid(c, t[1], "#0A0B12", 0.08);
          c.beginPath(); c.roundRect(-0.72, -0.8, 1.44, 1.44, 0.2); c.fillStyle = K.along(c, [0, -0.8], [0, 0.64], [[0, t[2]], [1, t[0]]]); c.fill();
          c.fillStyle = "#0A0B12"; c.globalAlpha = 0.75; c.save(); c.translate(0, -0.08); c.rotate((frame % 4) * (K.TAU / 4)); c.beginPath(); c.moveTo(0, -0.34); c.lineTo(0.32, 0.22); c.lineTo(-0.32, 0.22); c.closePath(); c.fill(); c.restore(); c.globalAlpha = 1;
        },
      },
      pixelglow: { reach: [1, 1], body: 0.3, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.fillStyle = t[2]; c.fillRect(-0.28, -0.28, 0.56, 0.56); } },
    },
    effects: {
      "key-rain": {
        tones: [K.TONES.pink, K.TONES.violet, K.TONES.teal, K.TONES.gold, K.TONES.sky],
        still: 1900,
        layers: [
          ...K.depth({ count: 20, shape: "pixelglow", size: [0.008, 0.014], path: K.rise(0.03), life: 0.7, fade: K.twinkle, colours: [0, 1, 2, 3, 4] }),
          { count: 11, shape: "keycap", size: [0.028, 0.04], path: (t, seed, index) => ({ x: 0.06 + seed * 0.88, y: -0.1 + t * 1.2, angle: Math.sin(t * 5 + seed * 9) * 0.5, frame: index }), life: 0.8, fade: K.soft, colours: [0, 1, 2, 3, 4] },
        ],
      },
    },
  })],
  ["robot", (K) => ({
    shapes: {
      hexnut: {
        reach: [1, 1],
        body: 0.6,
        draw(c, t) {
          c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * K.TAU) / 6; i ? c.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92) : c.moveTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92); } c.closePath();
          K.solid(c, K.along(c, [-0.9, -0.9], [0.9, 0.9], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), "#10141E", 0.09);
          c.beginPath(); c.arc(0, 0, 0.4, 0, K.TAU); K.solid(c, "#10141E", t[1], 0.06);
        },
      },
      bolt: {
        reach: [0.5, 1.1],
        body: 0.6,
        draw(c, t) {
          c.beginPath(); c.roundRect(-0.2, -0.5, 0.4, 1.5, 0.08); K.solid(c, t[0], "#10141E", 0.07);
          c.strokeStyle = t[1]; c.lineWidth = 0.05; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(-0.2, -0.2 + i * 0.24); c.lineTo(0.2, -0.3 + i * 0.24); } c.stroke();
          c.beginPath(); c.roundRect(-0.46, -1, 0.92, 0.52, 0.1); K.solid(c, t[2], "#10141E", 0.07);
        },
      },
    },
    effects: {
      "nuts-bolts": {
        tones: [["#B9C2D0", "#5A6478", "#F1F5FB"], ["#D9A441", "#7A5206", "#FFE9A8"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 16, shape: "bolt", size: [0.016, 0.026], path: K.fall(0.04, 0.02, 0, 4), life: 0.62, fade: K.soft, colours: [0, 1] }, 0.8, 0.4),
          { count: 12, shape: "hexnut", size: [0.018, 0.028], path: K.fall(0.05, 0.03, 9, 2), life: 0.72, fade: K.soft, colours: [0, 1] },
        ],
      },
    },
  })],
  ["ufo", (K) => ({
    shapes: {
      minisaucer: {
        reach: [1.1, 0.8],
        body: 0.5,
        draw(c, t) {
          c.beginPath(); c.moveTo(-0.5, -0.12); c.bezierCurveTo(-0.5, -0.75, 0.5, -0.75, 0.5, -0.12); c.closePath(); K.solid(c, K.along(c, [0, -0.7], [0, -0.1], [[0, "#E6FDFF"], [1, "#5BE0E6"]]), "#0E1A2E", 0.06);
          c.beginPath(); c.ellipse(0, 0.05, 1, 0.3, 0, 0, K.TAU); K.solid(c, K.along(c, [0, -0.25], [0, 0.35], [[0, "#F1F5FB"], [1, "#6A7690"]]), "#0E1A2E", 0.07);
          for (const x of [-0.6, -0.2, 0.2, 0.6]) { c.beginPath(); c.arc(x, 0.12, 0.08, 0, K.TAU); c.fillStyle = t[2]; c.fill(); }
          K.shape(c, [[-0.4, 0.3], [0.4, 0.3], [0.7, 0.75], [-0.7, 0.75]]); c.fillStyle = K.along(c, [0, 0.3], [0, 0.75], [[0, K.fade(t[0], 0.5)], [1, K.fade(t[0], 0)]]); c.fill();
        },
      },
      greendot: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.28, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      saucers: {
        tones: [["#3FD68A", "#1E8A5A", "#B6FFD0"], K.TONES.gold],
        still: 1900,
        layers: [
          ...K.depth({ count: 24, shape: "greendot", size: [0.006, 0.012], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5) }), life: 0.3, fade: K.glow, colours: [0] }),
          { count: 6, shape: "minisaucer", size: [0.04, 0.056], path: (t, seed, index) => ({ x: index % 2 ? -0.1 + t * 1.2 : 1.1 - t * 1.2, y: 0.12 + seed * 0.66 + Math.sin(t * 12 + seed * 9) * 0.05, angle: Math.sin(t * 12 + seed * 9) * 0.18 }), life: 0.6, fade: K.soft, colours: [0, 1] },
        ],
      },
    },
  })],
  ["pixelquest", (K) => {
    const gem = [".ooooo.", "ollgggo", "olggggo", ".oggdo.", "..ogo..", "...o..."];
    const potion = ["..ooo..", "..oko..", "..ogo..", ".oogoo.", "ogggggo", "oglgggo", "oggggdo", ".ogddo.", "..ooo.."];
    const sword = ["...o...", "..oso..", "..oso..", "..oso..", "..oso..", "..oso..", "ooosooo", "oyyyyyo", "ooobooo", "..obo..", "..obo..", "..oro..", "...o..."];
    const plus = [".w.", "www", ".w."];
    return {
      shapes: {
        pxgem: { reach: [1, 0.9], body: 0.6, draw: (c, t) => K.px(c, gem, { o: "#14101E", l: t[2], g: t[0], d: t[1] }) },
        pxpotion: { reach: [0.8, 1], body: 0.6, draw: (c, t) => K.px(c, potion, { o: "#14101E", k: "#B98A45", g: t[0], l: t[2], d: t[1] }) },
        pxsword: { reach: [0.6, 1], body: 0.4, draw: (c, t) => K.px(c, sword, { o: "#14101E", s: "#DCE6F5", y: "#FFD23F", b: "#8A5A2A", r: t[0] }) },
        pxspark: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, plus, { w: t[2] }) },
      },
      effects: {
        "loot-drop": {
          tones: [K.TONES.mint, K.TONES.pink, K.TONES.sky, K.TONES.gold],
          still: 1500,
          layers: [
            { count: 5, shape: "pxsword", size: [0.05, 0.07], path: (t, seed) => ({ x: 0.08 + seed * 0.84, y: -0.1 + Math.round(t * 26) / 26 * 1.2, angle: Math.PI }), life: 0.7, fade: K.soft, colours: [1] },
            { count: 12, shape: "pxgem", size: [0.026, 0.038], path: (t, seed, index) => ({ x: seed, y: Math.min(1, -0.06 + t * t * 1.6) - (t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.08 : 0) }), life: 0.6, fade: K.soft, colours: [0, 1, 2] },
            { count: 6, shape: "pxpotion", size: [0.03, 0.042], path: (t, seed) => ({ x: seed, y: 1.08 - Math.round(t * 30) / 30 * 1.16 }), life: 0.85, fade: K.soft, colours: [1, 2] },
            { count: 14, shape: "pxspark", size: [0.012, 0.02], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5), grow: t < 0.5 ? 1 : 1.6 }), life: 0.22, fade: K.glow, colours: [3, 0] },
          ],
        },
      },
    };
  }],
  ["pixelspace", (K) => {
    const ship = ["....w....", "...wcw...", "...wcw...", "..wwcww..", ".rwwwwwr.", "rrwwwwwrr", "rr.www.rr", "r..f.f..r", "...y.y..."];
    const rock = [".ooo..", "osssoo", "ossdso", "osdsso", ".osso.", "..oo.."];
    const plus = [".w.", "www", ".w."];
    return {
      shapes: {
        pxship: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, ship, { w: "#EAF0FF", c: t[0], r: "#FF4D7A", f: "#FF8A2A", y: "#FFE36B" }) },
        pxrock: { reach: [1, 1], body: 0.6, draw: (c, t) => K.px(c, rock, { o: "#0A0A22", s: "#8A8FB0", d: "#5A5F80" }) },
        pxbolt: { reach: [0.2, 1], body: 0.9, draw: (c, t) => { c.fillStyle = t[2]; c.fillRect(-0.18, -1, 0.36, 2); c.fillStyle = t[0]; c.fillRect(-0.18, 0.2, 0.36, 0.8); } },
        pxstar: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, plus, { w: t[2] }) },
      },
      effects: {
        "laser-run": {
          tones: [K.TONES.aqua, K.TONES.gold, K.TONES.violet],
          still: 1500,
          layers: [
            { count: 26, shape: "pxstar", size: [0.008, 0.016], path: (t, seed, index) => ({ x: seed, y: (K.random(index, 5) + t * 0.5) % 1 }), life: 0.6, fade: K.soft, colours: [0, 2] },
            { count: 7, shape: "pxrock", size: [0.026, 0.044], path: (t, seed, index) => ({ x: seed, y: -0.1 + Math.round(t * 30) / 30 * 1.2, angle: Math.round(t * 8) * (Math.PI / 4) }), life: 0.85, fade: K.soft, colours: [0] },
            { count: 14, shape: "pxbolt", size: [0.014, 0.02], path: (t, seed, index) => ({ x: [0.2, 0.5, 0.8][index % 3] + (K.random(index, 2) - 0.5) * 0.02, y: 0.86 - t * 0.9 }), life: 0.3, fade: K.pop, colours: [1] },
            { count: 3, shape: "pxship", size: [0.05, 0.05], path: (t, seed, index) => ({ x: [0.2, 0.5, 0.8][index] + Math.round(Math.sin(t * 9 + index * 2) * 4) / 4 * 0.03, y: 1.1 - Math.min(1, t * 4) * 0.2 + Math.max(0, t - 0.8) * -6 }), life: 0.95, start: (index) => 0.02 + index * 0.02, fade: K.pop, colours: [0] },
          ],
        },
      },
    };
  }],
  ["pixelpets", (K) => {
    const cat = ["oo.....oo", "oco...oco", "occooocco", "occccccco", "ockccckco", "occcpccco", ".occccco.", "..ooooo.."];
    const chick = ["..ooo..", ".oyyyo.", "oykyyyo", "oyyyynn", "oyyyyyo", ".oyyyo.", "..n.n.."];
    const paw = [".p.p.p.", ".p.p.p.", ".......", "..ppp..", ".ppppp.", ".pp.pp."];
    const heart = [".oo.oo.", "ohhohho", "ohhhhho", ".ohhho.", "..oho..", "...o..."];
    const hop = (t, seed, index) => ({ x: -0.1 + ((seed + t * 0.5) % 1) * 1.2, y: 0.9 - K.random(index, 6) * 0.1 - Math.abs(Math.sin(t * 16 + seed * 9)) * 0.07 });
    return {
      shapes: {
        pxcat: { reach: [1, 0.9], body: 0.6, draw: (c, t) => K.px(c, cat, { o: "#3A2A4A", c: t[0], k: "#3A2A4A", p: "#FF7A9C" }) },
        pxchick: { reach: [1, 1], body: 0.6, draw: (c, t) => K.px(c, chick, { o: "#3A2A4A", y: "#FFE36B", k: "#3A2A4A", n: "#FF8A2A" }) },
        pxpaw: { reach: [1, 0.9], body: 0.4, draw: (c, t) => K.px(c, paw, { p: t[0] }) },
        pxlove: { reach: [1, 0.9], body: 0.5, draw: (c, t) => K.px(c, heart, { o: t[1], h: t[0] }) },
      },
      effects: {
        "paw-hop": {
          tones: [K.TONES.pink, K.TONES.amber, K.TONES.bone],
          still: 1500,
          layers: [
            { count: 14, shape: "pxpaw", size: [0.018, 0.026], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5) * 0.8, angle: (K.random(index, 7) - 0.5) * 0.8 }), life: 0.3, fade: K.glow, colours: [0, 2] },
            { count: 8, shape: "pxlove", size: [0.02, 0.03], path: (t, seed) => ({ x: seed, y: 0.8 - Math.round(t * 24) / 24 * 0.8 }), life: 0.7, fade: K.soft, colours: [0] },
            { count: 4, shape: "pxcat", size: [0.05, 0.06], path: hop, life: 0.95, fade: K.soft, colours: [1, 2] },
            { count: 4, shape: "pxchick", size: [0.036, 0.042], path: hop, life: 0.95, fade: K.soft, colours: [0] },
          ],
        },
      },
    };
  }],
  ["pixelfood", (K) => {
    const burger = ["..oooooo..", ".onnnnnno.", "onnwnnwnno", "oggggggggo", "orrrrrrrro", "obbbbbbbbo", "onnnnnnnno", ".oooooooo."];
    const pizza = ["ooooooooo", "onnnnnnno", ".oyryyyo.", ".oyyyryo.", "..oyryo..", "..oyyyo..", "...oyo...", "....o...."];
    const donut = ["..oooo..", ".oppppo.", "opwppypo", "oppooppo", "oppooppo", "opbppwpo", ".oddddo.", "..oooo.."];
    const dot = ["ww", "ww"];
    const step = (t, seed, index) => ({ x: seed, y: -0.1 + Math.round(t * 28) / 28 * 1.2, angle: Math.round(t * 6 + index) * (Math.PI / 2) * (index % 3 === 0 ? 1 : 0) });
    return {
      shapes: {
        pxburger: { reach: [1, 0.8], body: 0.7, draw: (c) => K.px(c, burger, { o: "#2A1420", n: "#F0A858", w: "#FFF3D0", g: "#6BD06B", r: "#FF4D4D", b: "#8A4A2A" }) },
        pxpizza: { reach: [1, 0.9], body: 0.5, draw: (c) => K.px(c, pizza, { o: "#2A1420", n: "#E0A050", y: "#FFD23F", r: "#E0303A" }) },
        pxdonut: { reach: [1, 1], body: 0.6, draw: (c, t) => K.px(c, donut, { o: "#2A1420", p: t[0], w: "#FFFFFF", y: "#FFE36B", b: "#6CC8FF", d: "#E0A050" }) },
        pxcrumb: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "snack-rain": {
          tones: [K.TONES.pink, K.TONES.gold, K.TONES.sky],
          still: 1500,
          layers: [
            { count: 24, shape: "pxcrumb", size: [0.005, 0.008], path: (t, seed, index) => ({ x: seed, y: -0.05 + Math.round(t * 30) / 30 * 1.1 }), life: 0.6, fade: K.soft, colours: [0, 1, 2] },
            { count: 6, shape: "pxburger", size: [0.04, 0.052], path: step, life: 0.8, fade: K.soft, colours: [0] },
            { count: 6, shape: "pxpizza", size: [0.036, 0.048], path: step, life: 0.85, fade: K.soft, colours: [0] },
            { count: 7, shape: "pxdonut", size: [0.032, 0.044], path: step, life: 0.75, fade: K.soft, colours: [0, 2] },
          ],
        },
      },
    };
  }],
  ["pixelsea", (K) => {
    const fish = ["..oooo...", ".offlfo.o", "ofkffffoo", "offfffffo", ".offffo.o", "..oooo..."];
    const jelly = [".ooooo.", "opplppo", "opppppo", "ooooooo", ".p.p.p.", "p.p.p..", ".p.p.p."];
    const bubble = [".ww.", "w..w", "w..w", ".ww."];
    return {
      shapes: {
        pxfish: { reach: [1, 0.7], body: 0.6, draw: (c, t) => K.px(c, fish, { o: "#0A1E3A", f: t[0], l: t[2], k: "#0A1E3A" }) },
        pxjelly: { reach: [0.9, 1], body: 0.5, draw: (c, t) => K.px(c, jelly, { o: "#0A1E3A", p: t[0], l: t[2] }) },
        pxbubble: { reach: [1, 1], body: 0.3, draw: (c, t) => K.px(c, bubble, { w: t[2] }) },
      },
      effects: {
        "reef-swim": {
          tones: [K.TONES.amber, K.TONES.gold, K.TONES.pink, K.TONES.violet, K.TONES.sky],
          still: 1500,
          layers: [
            { count: 22, shape: "pxbubble", size: [0.008, 0.018], path: (t, seed, index) => ({ x: seed + Math.round(Math.sin(t * 8 + index) * 2) * 0.008, y: 1.05 - Math.round(t * 30) / 30 * 1.15 }), life: 0.7, fade: K.soft, colours: [4] },
            { count: 4, shape: "pxjelly", size: [0.034, 0.05], path: (t, seed, index) => ({ x: seed, y: 0.9 - t * 0.7 - Math.round(Math.abs(Math.sin(t * 10 + index)) * 3) * 0.012 }), life: 0.9, fade: K.soft, colours: [3] },
            { count: 9, shape: "pxfish", size: [0.034, 0.05], path: (t, seed, index) => ({ x: 1.15 - Math.round(t * 34) / 34 * 1.3, y: 0.1 + K.random(index, 4) * 0.75 + Math.round(Math.sin(t * 9 + seed * 7) * 2) * 0.008 }), life: 0.8, fade: K.soft, colours: [0, 1, 2] },
          ],
        },
      },
    };
  }],
  ["pixeldino", (K) => {
    const dino = ["........ooo.", ".......oggko", ".......ogggo", ".......ogo..", "..oooooogo..", ".oggggggggo.", "ogggggggggo.", "o.ogo..ogo..", "..ooo..ooo.."];
    const egg = ["..oo..", ".owwo.", "owwgwo", "owgwwo", "owwwwo", ".owwo.", "..oo.."];
    const bone = [".w....w.", "wwwwwwww", "wwwwwwww", ".w....w."];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        pxdino: { reach: [1, 0.8], body: 0.5, draw: (c, t) => K.px(c, dino, { o: "#1E1A14", g: t[0], k: "#1E1A14" }) },
        pxegg: { reach: [0.9, 1], body: 0.7, draw: (c, t) => K.px(c, egg, { o: "#1E1A14", w: "#FFF6E0", g: t[0] }) },
        pxbone: { reach: [1, 0.5], body: 0.6, draw: (c, t) => K.px(c, bone, { w: t[2] }) },
        pxash: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "dino-dash": {
          tones: [K.TONES.green, K.TONES.pink, K.TONES.sky, K.TONES.ember, K.TONES.bone],
          still: 1500,
          layers: [
            { count: 20, shape: "pxash", size: [0.005, 0.008], path: (t, seed, index) => ({ x: seed, y: 1 - Math.round(t * 30) / 30 * 1.1 }), life: 0.6, fade: K.soft, colours: [3, 3, 4] },
            { count: 6, shape: "pxbone", size: [0.022, 0.03], path: (t, seed, index) => ({ x: seed, y: -0.08 + Math.round(t * 26) / 26 * 1.16, angle: Math.round(t * 6 + index) * (Math.PI / 4) }), life: 0.8, fade: K.soft, colours: [4] },
            { count: 8, shape: "pxegg", size: [0.026, 0.036], path: (t, seed, index) => ({ x: seed, y: Math.min(0.96, -0.06 + t * t * 1.5) - (t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.07 : 0), angle: Math.round(Math.sin(t * 14 + index)) * 0.14 }), life: 0.6, fade: K.soft, colours: [0, 1, 2] },
            { count: 4, shape: "pxdino", size: [0.06, 0.07], path: (t, seed, index) => ({ x: -0.15 + ((seed + t * 0.6) % 1) * 1.3, y: 0.9 - K.random(index, 6) * 0.06 - Math.abs(Math.sin(t * 18 + seed * 9)) * 0.05 }), life: 0.95, fade: K.soft, colours: [0, 1, 2] },
          ],
        },
      },
    };
  }],
  ["pixelcity", (K) => {
    const carRows = ["...ooooo..", "..obbobbo.", "orrrrrrrro", "yrrrrrrrrd", "orrrrrrrro", ".kk....kk."];
    const win = ["ww", "ww", "ww"];
    const lanes = [0.2, 0.34, 0.48, 0.62, 0.76, 0.9];
    return {
      shapes: {
        pxcar: { reach: [1, 0.6], body: 0.7, draw: (c, t) => K.px(c, carRows, { o: "#0E0A24", b: "#8AD8FF", w: "#DFF4FF", r: t[0], y: "#FFE36B", d: "#FF4D5A", k: "#2A2A3A" }) },
        pxlight: { reach: [0.7, 1], body: 1, draw: (c, t) => K.px(c, win, { w: t[0] }) },
        pxlane: { reach: [1, 0.12], body: 1, draw: (c, t) => { c.fillStyle = t[0]; c.fillRect(-1, -0.1, 2, 0.2); } },
      },
      effects: {
        "night-traffic": {
          tones: [K.TONES.gold, K.TONES.aqua, K.TONES.pink, K.TONES.green, K.TONES.amber],
          still: 1500,
          layers: [
            { count: 30, shape: "pxlight", size: [0.006, 0.01], path: (t, seed, index) => ({ x: Math.round(seed * 30) / 30, y: Math.round(K.random(index, 5) * 40) / 40 }), life: 0.35, fade: K.glow, colours: [0, 0, 1] },
            { count: 18, shape: "pxlane", size: [0.018, 0.018], path: (t, seed, index) => ({ x: ((index % 6) / 6 + t * 0.4) % 1, y: lanes[index % 6] + 0.07 }), life: 0.9, alpha: 0.5, fade: K.soft, colours: [0] },
            { count: 10, shape: "pxcar", size: [0.045, 0.06], path: (t, seed, index) => { const lane = index % 6; const right = true; const p = Math.round(t * 40) / 40; return { x: right ? -0.15 + p * 1.3 : 1.15 - p * 1.3, y: lanes[lane] }; }, life: 0.7, fade: K.soft, colours: [2, 3, 4, 1] },
          ],
        },
      },
    };
  }],
  ["pixelcoast", (K) => {
    const car = ["......oooooo......", ".....obbbbobo.....", "..oorrrrrrrrrrrro.", ".orrrrrrrrrrrrrryo", "drrsssssssssssssro", ".ooKKKoooooooKKKo.", "...kgk.......kgk.."];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        pxcar: { reach: [1, 0.4], body: 0.7, draw: (c, t) => K.px(c, car, { o: "#120A1E", b: "#8AD8FF", r: t[0], s: t[2], y: "#FFF3A0", d: "#FF3A3A", K: "#3A3A4A", k: "#1A1A24", g: "#C9CED8" }) },
        pxglow: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "coast-cruise": {
          tones: [K.TONES.pink, K.TONES.aqua, K.TONES.amber],
          still: 1500,
          layers: [
            { count: 26, shape: "pxglow", size: [0.006, 0.01], path: (t, seed, index) => ({ x: (seed + t * 0.3) % 1, y: Math.round(K.random(index, 5) * 30) / 30 * 0.7 }), life: 0.5, fade: K.glow, colours: [0, 1, 2] },
            { count: 6, shape: "pxcar", size: [0.07, 0.08], path: (t, seed, index) => { const lane = [0.62, 0.74, 0.86][index % 3]; const p = Math.round(t * 40) / 40; return { x: index % 2 ? 1.2 - p * 1.4 : -0.2 + p * 1.4, y: lane, squash: index % 2 ? -1 : 1 }; }, life: 0.6, start: (index) => 0.02 + index * 0.06, fade: K.soft, colours: [0, 1, 2] },
          ],
        },
      },
    };
  }],
  ["pixelrace", (K) => {
    const car = ["......oooooo......", ".....obbbbobo.....", "..oorrrrrrrrrrrro.", ".orrrrrrrrrrrrrryo", "drrsssssssssssssro", ".ooKKKoooooooKKKo.", "...kgk.......kgk.."];
    const flag = ["kwkwkw", "wkwkwk", "kwkwkw", "wkwkwk"];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        racecar: { reach: [1, 0.4], body: 0.7, draw: (c, t) => K.px(c, car, { o: "#120A1E", b: "#8AD8FF", r: t[0], s: t[2], y: "#FFF3A0", d: "#FF3A3A", K: "#3A3A4A", k: "#1A1A24", g: "#C9CED8" }) },
        checker: { reach: [1, 0.7], body: 1, draw: (c) => K.px(c, flag, { k: "#1A1A24", w: "#FFFFFF" }) },
        confetti: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "photo-finish": {
          tones: [K.TONES.red, K.TONES.sky, K.TONES.gold, K.TONES.green],
          still: 1500,
          layers: [
            ...K.depth({ count: 8, shape: "checker", size: [0.026, 0.04], path: K.fall(0.06, 0.04, 3), life: 0.8, fade: K.soft, colours: [0] }),
            { count: 30, shape: "confetti", size: [0.006, 0.01], path: (t, seed) => ({ x: seed, y: -0.05 + Math.round(t * 30) / 30 * 1.1 }), life: 0.6, fade: K.soft, colours: [0, 1, 2, 3] },
            { count: 4, shape: "racecar", size: [0.08, 0.09], path: (t, seed, index) => ({ x: -0.25 + Math.round(t * 40) / 40 * (1.5 + index * 0.06), y: 0.58 + index * 0.1 }), life: 0.55, start: (index) => 0.04 + index * 0.02, fade: K.soft, colours: [0, 1, 2, 3] },
          ],
        },
      },
    };
  }],
  ["pixelhall", (K) => {
    const button = [".ooo.", "ollco", "occco", "occco", ".ooo."];
    const plus = [".w.", "www", ".w."];
    return {
      shapes: {
        pxbutton: { reach: [1, 1], body: 0.8, draw: (c, t) => K.px(c, button, { o: "#120A1E", l: "#FFFFFF", c: t[0] }) },
        pxspark: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, plus, { w: t[2] }) },
      },
      effects: {
        "button-mash": {
          tones: [K.TONES.red, K.TONES.gold, K.TONES.green, K.TONES.sky, K.TONES.violet],
          still: 1400,
          layers: [
            { count: 30, shape: "pxbutton", size: [0.022, 0.036], path: (t, seed, index) => ({ x: Math.round(seed * 8) / 8 + 0.06, y: 0.12 + Math.round(K.random(index, 5) * 6) / 6 * 0.76, grow: t < 0.15 ? 1.25 : 1 }), life: 0.45, fade: K.pop, colours: [0, 1, 2, 3, 4] },
            { count: 20, shape: "pxspark", size: [0.01, 0.02], path: (t, seed, index) => ({ x: seed, y: K.random(index, 6), grow: t < 0.5 ? 1 : 1.6 }), life: 0.22, fade: K.glow, colours: [1, 3] },
          ],
        },
      },
    };
  }],
  ["pixeldrift", (K) => {
    const smoke = ["..www...", ".wwwwww.", "wwwwwwww", "wwwwwwww", ".wwwwww.", "...ww..."];
    const car = ["......oooooo......", ".....obbbbobo.....", "..oorrrrrrrrrrrro.", ".orrrrrrrrrrrrrryo", "drrsssssssssssssro", ".ooKKKoooooooKKKo.", "...kgk.......kgk.."];
    return {
      shapes: {
        puff: { reach: [1, 0.75], body: 0.7, draw: (c, t) => K.px(c, smoke, { w: t[2] }) },
        driftcar: { reach: [1, 0.4], body: 0.7, draw: (c, t) => K.px(c, car, { o: "#120A1E", b: "#8AD8FF", r: t[0], s: "#1A1A24", y: "#FFF3A0", d: "#FF3A3A", K: "#3A3A4A", k: "#1A1A24", g: "#C9CED8" }) },
      },
      effects: {
        "tyre-smoke": {
          tones: [K.TONES.amber, K.TONES.white],
          still: 1500,
          layers: [
            ...K.depth({ count: 18, shape: "puff", size: [0.03, 0.06], path: (t, seed, index) => ({ x: seed, y: 0.92 - t * 0.5 - K.random(index, 3) * 0.1, grow: 0.6 + t * 0.8 }), life: 0.7, fade: K.soft, colours: [1] }),
            { count: 3, shape: "driftcar", size: [0.09, 0.1], path: (t, seed, index) => ({ x: -0.25 + Math.round(t * 40) / 40 * 1.5, y: 0.78 - index * 0.14, angle: -0.12 + Math.sin(t * 6 + index) * 0.06 }), life: 0.6, start: (index) => 0.04 + index * 0.1, fade: K.soft, colours: [0] },
          ],
        },
      },
    };
  }],
  ["pixelball", (K) => {
    const ball = ["..oooo..", ".owkkwo.", "owwkkwwo", "okwwwwko", "okwwwwko", "owwkkwwo", ".owkkwo.", "..oooo.."];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        pxball: { reach: [1, 1], body: 0.8, draw: (c) => K.px(c, ball, { o: "#120A1E", w: "#FFFFFF", k: "#1A1A24" }) },
        pxconfetti: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "goal-bounce": {
          tones: [K.TONES.white, K.TONES.sky, K.TONES.gold, K.TONES.green],
          still: 1500,
          layers: [
            { count: 32, shape: "pxconfetti", size: [0.006, 0.01], path: (t, seed) => ({ x: seed, y: -0.05 + Math.round(t * 30) / 30 * 1.1 }), life: 0.6, fade: K.soft, colours: [0, 1, 2, 3] },
            { count: 6, shape: "pxball", size: [0.034, 0.05], path: (t, seed, index) => ({ x: seed, y: 0.92 - Math.abs(Math.sin(t * Math.PI * 3 + index)) * (0.5 - t * 0.3), angle: Math.round(t * 8) * (Math.PI / 4) }), life: 0.8, fade: K.soft, colours: [0] },
          ],
        },
      },
    };
  }],
  ["pixelwoods", (K) => {
    const plus = [".w.", "www", ".w."];
    const pine = ["....g....", "...ggg...", "..lgggg..", "...ggg...", "..ggggg..", ".lgggggg.", "..ggggg..", ".ggggggg.", "glggggggg", "....t....", "....t...."];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        firefly: { reach: [1, 1], body: 0.3, draw: (c, t) => { K.halo(c, 1, t[0], 0.5); c.save(); c.scale(0.5, 0.5); K.px(c, plus, { w: t[2] }); c.restore(); } },
        pxpine: { reach: [0.85, 1], body: 0.5, draw: (c, t) => K.px(c, pine, { g: t[0], l: t[2], t: "#6A4020" }) },
        ember: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "firefly-dance": {
          tones: [K.TONES.lime, K.TONES.green, K.TONES.amber],
          still: 1700,
          layers: [
            { count: 7, shape: "pxpine", size: [0.07, 0.11], path: (t, seed, index) => ({ x: 0.06 + (index / 6) * 0.88, y: 0.9 - K.random(index, 3) * 0.04 }), life: 0.96, start: () => 0.01, alpha: 0.55, fade: K.soft, colours: [1] },
            { count: 16, shape: "ember", size: [0.005, 0.008], path: (t, seed, index) => ({ x: 0.5 + (seed - 0.5) * 0.3 + Math.round(Math.sin(t * 9 + index) * 3) * 0.006, y: 0.86 - Math.round(t * 24) / 24 * 0.5 }), life: 0.5, fade: K.soft, colours: [2] },
            { count: 26, shape: "firefly", size: [0.016, 0.026], path: (t, seed, index) => ({ x: seed + Math.round(Math.sin(t * 5 + index) * 4) * 0.008, y: 0.1 + K.random(index, 5) * 0.66 + Math.round(Math.cos(t * 4 + seed * 9) * 3) * 0.008 }), life: 0.5, fade: K.twinkle, colours: [0] },
          ],
        },
      },
    };
  }],
  ["pixelwinter", (K) => {
    const flake = ["w.w.w", ".www.", "wwwww", ".www.", "w.w.w"];
    const dot = ["ww", "ww"];
    const gift = ["..y.y..", "...y...", "rrryrrr", "rrryrrr", "yyyyyyy", "rrryrrr", "rrryrrr"];
    const step = (t, seed, index) => ({ x: seed + Math.round(Math.sin(t * 6 + index) * 3) * 0.008, y: -0.06 + Math.round(t * 32) / 32 * 1.14 });
    return {
      shapes: {
        pxflake: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, flake, { w: t[2] }) },
        pxsnow: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[2] }) },
        pxgift: { reach: [1, 1], body: 0.8, draw: (c, t) => K.px(c, gift, { y: "#FFE36B", r: t[0] }) },
      },
      effects: {
        "pixel-snowfall": {
          tones: [K.TONES.white, K.TONES.sky, K.TONES.red],
          still: 1700,
          layers: [
            ...K.depth({ count: 40, shape: "pxsnow", size: [0.005, 0.009], path: step, life: 0.7, fade: K.soft, colours: [0] }),
            { count: 12, shape: "pxflake", size: [0.018, 0.03], path: step, life: 0.85, fade: K.soft, colours: [0, 1] },
            { count: 4, shape: "pxgift", size: [0.03, 0.04], path: (t, seed) => ({ x: seed, y: Math.min(0.95, -0.06 + t * t * 1.5) - (t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.06 : 0) }), life: 0.6, fade: K.soft, colours: [2] },
          ],
        },
      },
    };
  }],
  ["pixelbeats", (K) => {
    const notes = ["..yyyyy", "..y...y", "..y...y", "..y...y", ".yy..yy", "yyy.yyy", ".y...y."];
    const tape = ["ooooooooooooo", "opppppppppppo", "opwwwwwwwwwpo", "opwkkwwwkkwpo", "opwkkwwwkkwpo", "opwwwwwwwwwpo", "oppdddddddppo", "ooooooooooooo"];
    const dot = ["ww", "ww"];
    return {
      shapes: {
        pxnotes: { reach: [1, 1], body: 0.4, draw: (c, t) => K.px(c, notes, { y: t[0] }) },
        pxtape: { reach: [1, 0.62], body: 0.8, draw: (c, t) => K.px(c, tape, { o: "#160A2A", p: t[0], w: "#FFF3D0", k: "#2A1A3A", d: t[1] }) },
        pxbeat: { reach: [1, 1], body: 1, draw: (c, t) => K.px(c, dot, { w: t[0] }) },
      },
      effects: {
        "pixel-notes": {
          tones: [K.TONES.pink, K.TONES.gold, K.TONES.sky, K.TONES.green],
          still: 1600,
          layers: [
            // an equaliser along the bottom: columns of squares that rise and fall in steps
            { count: 60, shape: "pxbeat", size: [0.012, 0.012], path: (t, seed, index) => { const column = index % 12; const level = Math.floor(index / 12); const height = Math.round((0.5 + 0.5 * Math.sin(t * 14 + column * 1.7)) * 5); return { x: 0.06 + column * 0.08, y: 0.96 - level * 0.035, grow: level < height ? 1 : 0.001 }; }, life: 0.96, start: () => 0.01, alpha: 0.7, fade: K.soft, colours: [3, 3, 1, 1, 0] },
            { count: 12, shape: "pxnotes", size: [0.03, 0.045], path: (t, seed, index) => ({ x: seed + Math.round(Math.sin(t * 6 + index) * 3) * 0.01, y: 0.86 - Math.round(t * 26) / 26 * 0.9 }), life: 0.75, fade: K.soft, colours: [1, 2, 0] },
            { count: 3, shape: "pxtape", size: [0.06, 0.07], path: (t, seed, index) => ({ x: 0.2 + index * 0.3, y: -0.08 + Math.round(t * 28) / 28 * 0.6, angle: Math.round(Math.sin(t * 5 + index) * 2) * 0.1 }), life: 0.8, fade: K.soft, colours: [0, 2] },
          ],
        },
      },
    };
  }],
  ["pixelpocket", (K) => {
    const up = ["..w..", ".www.", "wwwww", "..w..", "..w.."];
    const cart = ["ooooooo", "occccco", "owwwwwo", "owwwwwo", "owwwwwo", "occccco", "occccco", "ogggggo"];
    const plus = [".w.", "www", ".w."];
    return {
      shapes: {
        pxup: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, up, { w: t[0] }) },
        pxcart: { reach: [0.9, 1], body: 0.8, draw: (c, t) => K.px(c, cart, { o: "#0E1A2A", c: t[0], w: "#FFFFFF", k: "#16263A", g: "#FFD23F" }) },
        pxshine: { reach: [1, 1], body: 0.5, draw: (c, t) => K.px(c, plus, { w: t[2] }) },
      },
      effects: {
        "power-up": {
          tones: [K.TONES.green, K.TONES.gold, K.TONES.pink, K.TONES.sky],
          still: 1500,
          layers: [
            { count: 18, shape: "pxup", size: [0.014, 0.026], path: (t, seed) => ({ x: seed, y: 1.06 - Math.round(t * 28) / 28 * 1.16 }), life: 0.6, fade: K.soft, colours: [0, 1] },
            { count: 7, shape: "pxcart", size: [0.03, 0.044], path: (t, seed, index) => ({ x: seed, y: Math.min(0.95, -0.06 + t * t * 1.5) - (t > 0.82 ? Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.07 : 0), angle: Math.round(Math.sin(t * 9 + index)) * 0.15 }), life: 0.6, fade: K.soft, colours: [2, 3, 1, 0] },
            { count: 16, shape: "pxshine", size: [0.012, 0.02], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5), grow: t < 0.5 ? 1 : 1.6 }), life: 0.22, fade: K.glow, colours: [1, 0] },
          ],
        },
      },
    };
  }],
  ["ninja", (K) => ({
    shapes: {
      throwblade: {
        reach: [1, 1],
        body: 0.35,
        draw(c, t) {
          K.shape(c, [[0, -1], [0.26, -0.26], [1, 0], [0.26, 0.26], [0, 1], [-0.26, 0.26], [-1, 0], [-0.26, -0.26]]);
          K.solid(c, K.along(c, [-1, -1], [1, 1], [[0, "#F1F5FB"], [0.5, "#B9C2D0"], [1, "#5A6478"]]), "#0A0B12", 0.08);
          c.beginPath(); c.arc(0, 0, 0.2, 0, K.TAU); c.fillStyle = "#0A0B12"; c.fill();
        },
      },
      smokepuff: { reach: [1, 1], body: 0.15, draw(c, t) { K.halo(c, 1, t[2], 0.5); } },
    },
    effects: {
      "blade-flight": {
        tones: [K.TONES.white, ["#5A5E78", "#2A2D42", "#8A8FA8"]],
        still: 1700,
        layers: [
          { count: 12, shape: "smokepuff", size: [0.04, 0.08], path: (t, seed) => ({ x: seed, y: 1 - t * 0.3, grow: 0.6 + t }), life: 0.5, alpha: 0.4, fade: K.glow, colours: [1] },
          { count: 9, shape: "throwblade", size: [0.022, 0.034], path: (t, seed, index) => ({ x: index % 2 ? -0.1 + t * 1.2 : 1.1 - t * 1.2, y: seed * 0.8 + 0.05 + t * 0.14, angle: t * 26 + seed * 6 }), life: 0.36, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["sham", (K) => ({
    shapes: {
      jasmine: {
        reach: [1, 1],
        body: 0.5,
        draw(c, t) {
          for (let i = 0; i < 5; i++) { c.save(); c.rotate((i * K.TAU) / 5); c.beginPath(); c.ellipse(0, -0.52, 0.27, 0.48, 0, 0, K.TAU); K.solid(c, K.along(c, [0, -1], [0, 0], [[0, "#FFFFFF"], [1, t[0]]]), t[1], 0.05); c.restore(); }
          c.beginPath(); c.arc(0, 0, 0.2, 0, K.TAU); K.solid(c, "#FFD54A", "#8A6508", 0.06);
        },
      },
      jleaf: {
        reach: [0.6, 1],
        body: 0.6,
        draw(c, t) { c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.6, -0.4, 0.6, 0.4, 0, 1); c.bezierCurveTo(-0.6, 0.4, -0.6, -0.4, 0, -1); K.solid(c, t[0], t[1], 0.08); c.strokeStyle = t[2]; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0, -0.8); c.lineTo(0, 0.8); c.stroke(); },
      },
    },
    effects: {
      "jasmine-fall": {
        tones: [["#EEF2FA", "#8A93A8", "#FFFFFF"], K.TONES.green],
        still: 1900,
        layers: [
          ...K.depth({ count: 18, shape: "jasmine", size: [0.024, 0.036], path: K.fall(0.07, 0.06, 0, 2.4), life: 0.8, fade: K.soft, colours: [0] }, 0.8, 0.4),
          { count: 8, shape: "jleaf", size: [0.014, 0.022], path: K.fall(0.08, 0.05, 7), life: 0.75, fade: K.soft, colours: [1] },
        ],
      },
    },
  })],
  ["levant", (K) => ({
    shapes: {
      rosehead: {
        reach: [1, 1],
        body: 0.7,
        draw(c, t) {
          const ringOf = (count, dist, rx, ry, turn, paint) => { for (let i = 0; i < count; i++) { c.save(); c.rotate(turn + (i * K.TAU) / count); c.beginPath(); c.ellipse(0, -dist, rx, ry, 0, 0, K.TAU); K.solid(c, paint, t[1], 0.06); c.restore(); } };
          ringOf(5, 0.56, 0.5, 0.42, 0, t[0]);
          ringOf(5, 0.33, 0.42, 0.34, K.TAU / 10, K.radial(c, 0.9, [[0, t[2]], [1, t[0]]]));
          ringOf(3, 0.14, 0.28, 0.22, 0.4, t[2]);
          c.beginPath(); c.arc(0, 0, 0.14, 0, K.TAU); c.fillStyle = t[1]; c.fill();
        },
      },
      rosepetal: {
        reach: [0.7, 1],
        body: 0.6,
        draw(c, t) { c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.9, -0.5, 0.6, 0.6, 0, 1); c.bezierCurveTo(-0.5, 0.5, -0.7, -0.4, 0, -1); K.solid(c, K.along(c, [0, -1], [0, 1], [[0, t[2]], [1, t[0]]]), t[1], 0.07); },
      },
    },
    effects: {
      "rose-fall": {
        tones: [["#E8366A", "#8A0E36", "#FF9DBB"], K.TONES.rose],
        still: 1900,
        layers: [
          ...K.depth({ count: 22, shape: "rosepetal", size: [0.016, 0.026], path: K.fall(0.08, 0.08, 9), life: 0.78, fade: K.soft, colours: [0, 1] }, 0.8, 0.4),
          { count: 7, shape: "rosehead", size: [0.026, 0.036], path: K.fall(0.05, 0.03, 0, 1.6), life: 0.8, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["quds", (K) => ({
    shapes: {
      oleaf: {
        reach: [0.5, 1.1],
        body: 0.6,
        draw(c, t) { c.beginPath(); c.moveTo(0, -1.05); c.bezierCurveTo(0.5, -0.4, 0.5, 0.4, 0, 1.05); c.bezierCurveTo(-0.5, 0.4, -0.5, -0.4, 0, -1.05); K.solid(c, K.along(c, [-0.4, 0], [0.4, 0], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), t[1], 0.07); },
      },
      olive: { reach: [0.8, 1], body: 0.7, draw(c, t) { c.beginPath(); c.ellipse(0, 0, 0.66, 0.9, 0, 0, K.TAU); K.solid(c, K.radial(c, 1.1, [[0, t[2]], [0.5, t[0]], [1, t[1]]], -0.25, -0.3), t[1], 0.08); } },
    },
    effects: {
      "olive-rain": {
        tones: [K.TONES.green, ["#9DB77C", "#3E6A2C", "#E6F0D4"], ["#4A3F7A", "#1A1430", "#A99AD8"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 22, shape: "oleaf", size: [0.018, 0.03], path: K.fall(0.08, 0.08, 8), life: 0.78, fade: K.soft, colours: [0, 1] }, 0.8, 0.4),
          { count: 7, shape: "olive", size: [0.012, 0.017], path: K.fall(0.03, 0.02, 0, 1), life: 0.6, fade: K.soft, colours: [2] },
        ],
      },
    },
  })],
  ["desert", (K) => ({
    shapes: {
      grain: {
        reach: [1.6, 0.6],
        body: 0.5,
        draw(c, t) {
          c.fillStyle = K.along(c, [-1.6, 0], [1.6, 0], [[0, K.fade(t[0], 0)], [0.7, t[0]], [1, t[2]]]);
          c.beginPath(); c.ellipse(0, 0, 1.6, 0.42, 0, 0, K.TAU); c.fill();
        },
      },
      crescentlet: {
        reach: [1.1, 1.1],
        body: 0.3,
        draw(c, t) {
          K.halo(c, 1.1, t[2], 0.3);
          c.beginPath(); c.arc(0, 0, 0.8, 0.5, K.TAU - 0.9); c.arc(0.32, -0.12, 0.62, K.TAU - 1.25, 0.86, true); c.closePath();
          K.solid(c, t[2], t[1], 0.06);
        },
      },
    },
    effects: {
      "sand-wind": {
        tones: [K.TONES.sand, K.TONES.amber, K.TONES.moon],
        still: 1900,
        layers: [
          ...K.depth({
            count: 46,
            shape: "grain",
            size: [0.008, 0.016],
            path: (t, seed) => ({ x: -0.12 + t * 1.24, y: seed + Math.sin(t * 7 + seed * 30) * 0.05 + t * 0.08, angle: Math.cos(t * 7 + seed * 30) * 0.3 }),
            life: 0.5,
            fade: K.soft,
            colours: [0, 0, 1],
          }, 1, 0.4),
          {
            count: 5,
            shape: "crescentlet",
            size: [0.028, 0.04],
            path: (t, seed, index) => ({ x: 0.12 + index * 0.19, y: 0.16 + K.random(index, 5) * 0.5 - t * 0.06, angle: -0.3 + Math.sin(t * 3 + seed * 9) * 0.1 }),
            life: 0.7,
            fade: K.twinkle,
            colours: [2],
          },
        ],
      },
    },
  })],
  ["fanous", (K) => ({
    shapes: {
      fanous: {
        reach: [1.3, 3],
        body: 0.12,
        draw(c, t) {
          K.halo(c, 1.3, "#FFE3A0", 0.4);
          c.strokeStyle = t[1]; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0, -0.95); c.lineTo(0, -3); c.stroke();
          const gold = K.along(c, [0, -1], [0, 1], [[0, "#FFE9A8"], [1, "#A9730F"]]);
          c.beginPath(); c.moveTo(-0.42, -0.6); c.bezierCurveTo(-0.42, -1, 0.42, -1, 0.42, -0.6); c.closePath(); K.solid(c, gold, "#2A1608", 0.06);
          K.shape(c, [[-0.42, -0.6], [-0.62, 0], [-0.42, 0.66], [0.42, 0.66], [0.62, 0], [0.42, -0.6]]);
          K.solid(c, K.radial(c, 0.8, [[0, "#FFF3C4"], [0.6, t[0]], [1, t[1]]]), "#2A1608", 0.06);
          c.strokeStyle = "#E8B84A"; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.16, -0.6); c.lineTo(-0.16, 0.66); c.moveTo(0.16, -0.6); c.lineTo(0.16, 0.66); c.moveTo(-0.6, 0); c.lineTo(0.6, 0); c.stroke();
          K.shape(c, [[-0.42, 0.66], [0.42, 0.66], [0.42, 0.86], [0.18, 0.86], [0, 1.15], [-0.18, 0.86], [-0.42, 0.86]]); K.solid(c, gold, "#2A1608", 0.06);
        },
      },
      glim: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[2], 0.9); c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "fanous-glow": {
        tones: [K.TONES.pink, K.TONES.teal, K.TONES.gold],
        still: 2000,
        layers: [
          {
            count: 6,
            shape: "fanous",
            size: [0.034, 0.046],
            path: (t, seed, index) => {
              const down = 1 - (1 - Math.min(1, t * 3.2)) ** 3;
              return { x: 0.09 + index * 0.164, y: -0.12 + down * (0.2 + K.random(index, 5) * 0.26), angle: Math.sin(t * 10 + index) * 0.16 * (1 - t) };
            },
            life: 0.92,
            start: (index) => 0.02 + ((index * 3) % 6) * 0.03,
            fade: K.soft,
            colours: [0, 1, 2],
          },
          ...K.depth({
            count: 18,
            shape: "glim",
            size: [0.008, 0.014],
            path: K.rise(0.04),
            life: 0.7,
            fade: K.twinkle,
            colours: [2],
          }),
        ],
      },
    },
  })],
  ["majlis", (K) => ({
    shapes: {
      steam: {
        reach: [0.7, 1.3],
        body: 0.2,
        draw(c, t) {
          c.lineCap = "round"; c.lineWidth = 0.3;
          c.strokeStyle = K.along(c, [0, 1.2], [0, -1.2], [[0, K.fade(t[2], 0)], [0.4, K.fade(t[2], 0.7)], [1, K.fade(t[2], 0)]]);
          c.beginPath(); c.moveTo(0, 1.2); c.bezierCurveTo(-0.7, 0.5, 0.7, -0.1, 0, -0.5); c.bezierCurveTo(-0.4, -0.8, 0.2, -1, 0, -1.2); c.stroke();
        },
      },
      bean: {
        reach: [0.8, 1.05],
        body: 0.7,
        draw(c, t) {
          c.beginPath(); c.ellipse(0, 0, 0.7, 1, 0, 0, K.TAU);
          K.solid(c, K.radial(c, 1.2, [[0, t[2]], [0.5, t[0]], [1, t[1]]], -0.25, -0.35), t[1], 0.08);
          c.strokeStyle = t[1]; c.lineWidth = 0.1; c.lineCap = "round"; c.beginPath(); c.moveTo(0.05, -0.8); c.bezierCurveTo(-0.3, -0.3, 0.3, 0.3, -0.05, 0.8); c.stroke();
        },
      },
      pod: {
        reach: [0.6, 1.1],
        body: 0.6,
        draw(c, t) {
          c.beginPath(); c.moveTo(0, -1.05); c.bezierCurveTo(0.7, -0.4, 0.6, 0.6, 0, 1.05); c.bezierCurveTo(-0.6, 0.6, -0.7, -0.4, 0, -1.05); c.closePath();
          K.solid(c, t[0], t[1], 0.08);
          c.strokeStyle = t[2]; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0, -0.8); c.lineTo(0, 0.8); c.stroke();
        },
      },
    },
    effects: {
      qahwa: {
        tones: [["#8A5A32", "#3A2010", "#C89B6A"], K.TONES.green, ["#F4EAD5", "#8A7B6E", "#FFFFFF"]],
        still: 1900,
        layers: [
          {
            count: 9,
            shape: "steam",
            size: [0.05, 0.08],
            path: (t, seed) => ({ x: seed + Math.sin(t * 4 + seed * 20) * 0.03, y: 1.02 - t * 0.9, grow: 0.6 + t * 0.8 }),
            life: 0.8,
            alpha: 0.7,
            fade: K.glow,
            colours: [2],
          },
          ...K.depth({
            count: 14,
            shape: "bean",
            size: [0.014, 0.022],
            path: K.fall(0.04, 0, 6),
            life: 0.7,
            fade: K.soft,
            colours: [0],
          }, 0.7, 0.4),
          {
            count: 6,
            shape: "pod",
            size: [0.014, 0.02],
            path: K.fall(0.05, 0.04, 5),
            life: 0.75,
            fade: K.soft,
            colours: [1],
          },
        ],
      },
    },
  })],
  ["frost", (K) => ({
    shapes: {
      crystal: {
        reach: [1.05, 1.05],
        body: 0.3,
        draw(c, t) {
          c.lineCap = "round";
          for (const [width, colour] of [[0.2, t[1]], [0.1, t[2]]]) {
            c.lineWidth = width; c.strokeStyle = colour; c.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = (i * K.TAU) / 6, x = Math.cos(a), y = Math.sin(a);
              c.moveTo(0, 0); c.lineTo(x * 0.95, y * 0.95);
              for (const k of [0.45, 0.7]) for (const s of [-1, 1]) { c.moveTo(x * k, y * k); c.lineTo(x * k + Math.cos(a + s * 1.05) * 0.26, y * k + Math.sin(a + s * 1.05) * 0.26); }
            }
            c.stroke();
          }
        },
      },
      snowdot: { reach: [1, 1], body: 0.5, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.8, 0, K.TAU); K.solid(c, K.radial(c, 0.9, [[0, t[2]], [1, t[0]]], -0.2, -0.2), t[1], 0.12); } },
      gust: {
        reach: [2, 0.3],
        body: 0.3,
        draw(c, t) { c.fillStyle = K.along(c, [-2, 0], [2, 0], [[0, K.fade(t[2], 0)], [0.5, K.fade(t[2], 0.55)], [1, K.fade(t[2], 0)]]); c.beginPath(); c.ellipse(0, 0, 2, 0.22, 0, 0, K.TAU); c.fill(); },
      },
    },
    effects: {
      blizzard: {
        tones: [K.TONES.white, K.TONES.sky],
        still: 1900,
        layers: [
          {
            count: 12,
            shape: "gust",
            size: [0.07, 0.12],
            path: (t, seed) => ({ x: -0.2 + t * 1.4, y: seed + t * 0.12, angle: 0.09 }),
            life: 0.4,
            alpha: 0.3,
            fade: K.glow,
            colours: [0],
          },
          ...K.depth({
            count: 30,
            shape: "snowdot",
            size: [0.007, 0.012],
            path: (t, seed) => ({ x: seed * 1.3 - 0.3 + t * 0.4, y: -0.08 + t * 1.16 }),
            life: 0.55,
            fade: K.soft,
            colours: [0],
          }),
          {
            count: 9,
            shape: "crystal",
            size: [0.03, 0.048],
            path: (t, seed) => ({ x: seed * 1.2 - 0.2 + t * 0.25 + Math.sin(t * 5 + seed * 20) * 0.03, y: -0.1 + t * 1.2, angle: t * 2 + seed * 6 }),
            life: 0.78,
            fade: K.soft,
            colours: [0, 1],
          },
        ],
      },
    },
  })],
  ["tide", (K) => ({
    shapes: {
      fishlet: {
        reach: [1.3, 0.7],
        body: 0.6,
        draw(c, t) {
          K.shape(c, [[0.55, 0], [1.25, -0.55], [1.25, 0.55]]); K.solid(c, t[0], t[1], 0.07);
          c.beginPath(); c.ellipse(-0.1, 0, 0.9, 0.52, 0, 0, K.TAU);
          K.solid(c, K.along(c, [0, -0.5], [0, 0.5], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), t[1], 0.07);
          c.beginPath(); c.arc(-0.6, -0.1, 0.1, 0, K.TAU); c.fillStyle = "#0B2A4A"; c.fill();
        },
      },
      bub: {
        reach: [1, 1],
        body: 0.15,
        draw(c, t) { c.beginPath(); c.arc(0, 0, 0.85, 0, K.TAU); c.lineWidth = 0.14; c.strokeStyle = K.fade(t[2], 0.9); c.stroke(); c.beginPath(); c.arc(-0.3, -0.3, 0.18, 0, K.TAU); c.fillStyle = t[2]; c.fill(); },
      },
    },
    effects: {
      school: {
        tones: [K.TONES.ember, K.TONES.gold, K.TONES.aqua],
        still: 1800,
        layers: [
          ...K.depth({
            count: 12,
            shape: "bub",
            size: [0.012, 0.024],
            path: K.rise(0.03),
            life: 0.8,
            fade: K.soft,
            colours: [2],
          }, 1, 0.4),
          {
            count: 26,
            shape: "fishlet",
            size: [0.018, 0.028],
            path: (t, seed, index) => {
              const lag = K.random(index, 4) * 0.22;
              const u = t - lag * 0.4;
              const wave = Math.sin(u * 7 + 1);
              return { x: 1.2 - t * 1.5 + lag, y: 0.42 + wave * 0.16 + (K.random(index, 5) - 0.5) * 0.24, angle: -Math.cos(u * 7 + 1) * 0.35 };
            },
            life: 0.82,
            start: (index) => 0.03 + K.random(index, 6) * 0.1,
            fade: K.soft,
            colours: [0, 0, 1],
          },
        ],
      },
    },
  })],
  ["blaze", (K) => ({
    shapes: {
      flame: {
        reach: [0.8, 1.3],
        body: 0.5,
        draw(c, t) {
          const tongue = (s) => { c.beginPath(); c.moveTo(0, -1.25 * s); c.bezierCurveTo(0.2 * s, -0.6 * s, 0.75 * s, -0.1 * s, 0.6 * s, 0.6 * s); c.bezierCurveTo(0.5 * s, 1.1 * s, -0.5 * s, 1.1 * s, -0.6 * s, 0.6 * s); c.bezierCurveTo(-0.75 * s, 0.1 * s, -0.3 * s, -0.3 * s, 0, -1.25 * s); c.closePath(); };
          tongue(1); c.fillStyle = K.along(c, [0, -1.2], [0, 1], [[0, K.fade(t[1], 0.2)], [0.5, t[0]], [1, t[0]]]); c.fill();
          c.translate(0, 0.3); tongue(0.6); c.fillStyle = K.along(c, [0, -0.7], [0, 0.6], [[0, t[0]], [1, t[2]]]); c.fill();
        },
      },
      cinder: { reach: [1, 1], body: 0.35, draw(c, t) { K.halo(c, 1, t[0], 0.6); K.shape(c, [[0, -0.45], [0.45, 0], [0, 0.45], [-0.45, 0]]); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      wildfire: {
        tones: [K.TONES.ember, K.TONES.amber, K.TONES.gold],
        still: 1900,
        layers: [
          {
            count: 22,
            shape: "flame",
            size: [0.045, 0.075],
            path: (t, seed) => ({ x: seed, y: 1.03 - t * 0.2, grow: 0.5 + Math.sin(Math.PI * t) * 0.7, angle: Math.sin(t * 8 + seed * 30) * 0.22 }),
            life: 0.34,
            alpha: 0.9,
            fade: K.glow,
            colours: [0, 1],
          },
          {
            count: 14,
            shape: "flame",
            size: [0.024, 0.04],
            path: (t, seed) => ({ x: seed, y: 0.94 - t * 0.3, grow: 1 - t * 0.6, angle: Math.sin(t * 9 + seed * 30) * 0.3 }),
            life: 0.3,
            fade: K.glow,
            colours: [1, 2],
          },
          ...K.depth({
            count: 22,
            shape: "cinder",
            size: [0.008, 0.014],
            path: (t, seed) => ({ x: seed + Math.sin(t * 6 + seed * 20) * 0.05, y: 0.98 - t * 0.95 }),
            life: 0.6,
            fade: K.twinkle,
            colours: [1, 2, 0],
          }),
        ],
      },
    },
  })],
  ["garden", (K) => ({
    shapes: {
      daisy: {
        reach: [1, 1],
        body: 0.55,
        draw(c, t) {
          for (let i = 0; i < 8; i++) { c.save(); c.rotate((i * K.TAU) / 8); c.beginPath(); c.ellipse(0, -0.58, 0.24, 0.42, 0, 0, K.TAU); K.solid(c, t[2], t[1], 0.05); c.restore(); }
          c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); K.solid(c, "#FFD54A", "#8A6508", 0.07);
        },
      },
      beelet: {
        reach: [1.1, 1],
        body: 0.5,
        draw(c, t) {
          for (const [x, r] of [[-0.3, -0.4], [0.35, 0.4]]) { c.save(); c.translate(x, -0.55); c.rotate(r); c.beginPath(); c.ellipse(0, 0, 0.42, 0.28, 0, 0, K.TAU); K.solid(c, "#FFFFFFD0", "#5A6A8A", 0.05); c.restore(); }
          c.beginPath(); c.ellipse(0, 0.1, 0.8, 0.52, 0, 0, K.TAU); K.solid(c, "#FFD54A", "#2A1608", 0.08);
          c.fillStyle = "#2A1608"; c.fillRect(-0.3, -0.38, 0.2, 0.96); c.fillRect(0.18, -0.34, 0.2, 0.88);
        },
      },
      pollen: { reach: [1, 1], body: 0.3, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "spring-day": {
        tones: [K.TONES.gold, ["#FFFFFF", "#7A86A8", "#FFFFFF"], K.TONES.rose],
        still: 1900,
        layers: [
          ...K.depth({
            count: 14,
            shape: "daisy",
            size: [0.022, 0.034],
            path: K.fall(0.06, 0.05, 0, 2.2),
            life: 0.8,
            fade: K.soft,
            colours: [1, 1, 2],
          }, 0.8, 0.4),
          {
            count: 4,
            shape: "beelet",
            size: [0.026, 0.034],
            path: (t, seed) => ({ x: 0.2 + seed * 0.6 + Math.cos(t * 7 + seed * 9) * 0.14, y: 0.2 + seed * 0.5 + Math.sin(t * 14 + seed * 9) * 0.07 - t * 0.1, angle: Math.sin(t * 14 + seed * 9) * 0.3 }),
            life: 0.85,
            fade: K.soft,
            colours: [0],
          },
          ...K.depth({
            count: 16,
            shape: "pollen",
            size: [0.006, 0.011],
            path: K.rise(0.05),
            life: 0.7,
            fade: K.twinkle,
            colours: [0],
          }),
        ],
      },
    },
  })],
  ["storm", (K) => ({
    shapes: {
      brolly: {
        reach: [1.1, 1.4],
        body: 0.3,
        draw(c, t) {
          c.lineCap = "round"; c.strokeStyle = "#C4CEE2"; c.lineWidth = 0.09;
          c.beginPath(); c.moveTo(0, -0.5); c.lineTo(0, 1); c.arc(0.16, 1, 0.16, Math.PI, 0, true); c.stroke();
          c.beginPath(); c.moveTo(-1, -0.2); c.bezierCurveTo(-1, -1.35, 1, -1.35, 1, -0.2);
          for (let i = 0; i < 4; i++) { const x = 1 - i * 0.5; c.quadraticCurveTo(x - 0.25, -0.5, x - 0.5, -0.2); }
          c.closePath(); K.solid(c, K.along(c, [0, -1.1], [0, -0.2], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), t[1], 0.07);
        },
      },
      drizzle: {
        reach: [0.12, 1],
        body: 0.5,
        draw(c, t) { c.fillStyle = K.along(c, [0, -1], [0, 1], [[0, K.fade(t[0], 0)], [1, K.fade(t[2], 0.9)]]); c.beginPath(); c.ellipse(0, 0, 0.09, 1, 0, 0, K.TAU); c.fill(); },
      },
    },
    effects: {
      umbrellas: {
        tones: [K.TONES.gold, K.TONES.red, K.TONES.teal, K.TONES.sky],
        still: 1900,
        layers: [
          ...K.depth({
            count: 26,
            shape: "drizzle",
            size: [0.022, 0.034],
            path: (t, seed) => ({ x: seed * 1.2 - t * 0.14, y: -0.08 + t * 1.2, angle: 0.12 }),
            life: 0.34,
            fade: K.soft,
            colours: [3],
          }, 1, 0.3),
          {
            count: 7,
            shape: "brolly",
            size: [0.038, 0.052],
            path: (t, seed) => ({ x: 0.1 + seed * 0.8 + Math.sin(t * 5 + seed * 20) * 0.06, y: -0.12 + t * 1.2, angle: Math.cos(t * 5 + seed * 20) * 0.22 }),
            life: 0.9,
            fade: K.soft,
            colours: [0, 1, 2],
          },
        ],
      },
    },
  })],
  ["bamboo", (K) => ({
    shapes: {
      slimleaf: {
        reach: [1.1, 0.4],
        body: 0.6,
        draw(c, t) { c.beginPath(); c.moveTo(-1, 0); c.bezierCurveTo(-0.6, -0.4, 0.2, -0.45, 1, -0.05); c.bezierCurveTo(0.2, 0.3, -0.5, 0.3, -1, 0); K.solid(c, K.along(c, [0, -0.4], [0, 0.3], [[0, t[2]], [1, t[0]]]), t[1], 0.06); },
      },
      mist: { reach: [1.6, 0.6], wide: true, body: 0.1, unit: 80, draw(c, t) { c.scale(1.6, 0.6); K.halo(c, 1, t[2], 0.5); } },
    },
    effects: {
      "bamboo-fall": {
        tones: [K.TONES.green, ["#6FB04A", "#2E5E22", "#D6F5B0"], K.TONES.white],
        still: 1900,
        layers: [
          { count: 4, shape: "mist", size: [0.22, 0.3], path: (t, seed, index) => ({ x: -0.1 + t * 0.5 + index * 0.25, y: 0.2 + index * 0.2 }), life: 0.95, start: (index) => 0.01 + index * 0.02, alpha: 0.14, fade: K.glow, colours: [2] },
          ...K.depth({ count: 24, shape: "slimleaf", size: [0.022, 0.036], path: (t, seed) => ({ x: seed + t * 0.1 + Math.sin(t * 6 + seed * 20) * 0.07, y: -0.08 + t * 1.16, angle: 0.6 + Math.sin(t * 6 + seed * 20) * 0.9 }), life: 0.8, fade: K.soft, colours: [0, 1] }, 0.8, 0.4),
        ],
      },
    },
  })],
  ["camping", (K) => ({
    shapes: {
      fleck: { reach: [1, 1], body: 0.3, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
      smoke: { reach: [1, 1], wide: true, body: 0.1, unit: 80, draw(c, t) { K.halo(c, 1, t[2], 0.45); } },
    },
    effects: {
      "camp-embers": {
        tones: [K.TONES.ember, K.TONES.gold, ["#8A93A8", "#3A4058", "#C9D1E3"]],
        still: 1900,
        layers: [
          { count: 5, shape: "smoke", size: [0.1, 0.16], path: (t, seed, index) => ({ x: 0.5 + Math.sin(t * 3 + index) * 0.08 + (seed - 0.5) * 0.1, y: 0.9 - t * 0.7, grow: 0.6 + t }), life: 0.8, alpha: 0.3, fade: K.glow, colours: [2] },
          ...K.depth({ count: 34, shape: "fleck", size: [0.007, 0.013], path: (t, seed, index) => ({ x: 0.5 + (seed - 0.5) * (0.12 + t * 0.9) + Math.sin(t * 8 + seed * 30) * 0.03, y: 1.02 - t * (0.6 + K.random(index, 4) * 0.5) }), life: 0.62, fade: K.twinkle, colours: [0, 1] }),
        ],
      },
    },
  })],
  ["summer", (K) => ({
    shapes: {
      slice: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.94, 0, K.TAU); K.solid(c, t[0], t[1], 0.09);
          c.beginPath(); c.arc(0, 0, 0.8, 0, K.TAU); c.fillStyle = "#FFF3D6"; c.fill();
          for (let i = 0; i < 8; i++) { const a = (i * K.TAU) / 8; c.beginPath(); c.moveTo(Math.cos(a + 0.08) * 0.12, Math.sin(a + 0.08) * 0.12); c.arc(0, 0, 0.72, a + 0.08, a + K.TAU / 8 - 0.08); c.closePath(); c.fillStyle = t[2]; c.fill(); }
        },
      },
      juice: { reach: [0.7, 1], body: 0.5, draw(c, t) { c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.2, -0.3, 0.65, 0.1, 0.65, 0.45); c.arc(0, 0.45, 0.65, 0, Math.PI); c.bezierCurveTo(-0.65, 0.1, -0.2, -0.3, 0, -1); K.solid(c, K.along(c, [0, -1], [0, 1], [[0, t[2]], [1, t[0]]]), t[1], 0.08); } },
    },
    effects: {
      "citrus-splash": {
        tones: [["#F28A1E", "#8A4A06", "#FFB84A"], ["#FFD23F", "#8A6A06", "#FFEE8A"], ["#8CD36A", "#2F7A3C", "#C6F09A"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 16, shape: "juice", size: [0.008, 0.014], path: K.fall(0.02, 0, 0, 0), life: 0.45, fade: K.soft, colours: [0, 1] }),
          { count: 10, shape: "slice", size: [0.03, 0.044], path: K.fall(0.06, 0.03, 0, 2.6), life: 0.8, fade: K.soft, colours: [0, 1, 2] },
        ],
      },
    },
  })],
  ["lavender", (K) => ({
    shapes: {
      lsprig: {
        reach: [0.6, 1.2],
        body: 0.35,
        draw(c, t) {
          c.strokeStyle = "#3F7A5A"; c.lineWidth = 0.09; c.lineCap = "round"; c.beginPath(); c.moveTo(0, 1.1); c.quadraticCurveTo(0.1, 0.3, 0, -0.3); c.stroke();
          for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(i === 6 ? 0 : i % 2 ? 0.16 : -0.16, 0.2 - i * 0.2, 0.15, 0.19, 0, 0, K.TAU); K.solid(c, i % 2 ? t[2] : t[0], t[1], 0.05); }
        },
      },
      bud: { reach: [0.8, 1], body: 0.7, draw(c, t) { c.beginPath(); c.ellipse(0, 0, 0.62, 0.86, 0, 0, K.TAU); K.solid(c, K.radial(c, 1, [[0, t[2]], [1, t[0]]], -0.2, -0.3), t[1], 0.1); } },
    },
    effects: {
      "lavender-drift": {
        tones: [K.TONES.violet, ["#8E6BE0", "#3A2A7A", "#C9B6FF"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 26, shape: "bud", size: [0.006, 0.011], path: (t, seed) => ({ x: -0.1 + t * 1.2, y: seed + Math.sin(t * 6 + seed * 30) * 0.05, angle: t * 4 }), life: 0.6, fade: K.soft, colours: [0, 1] }),
          { count: 10, shape: "lsprig", size: [0.03, 0.044], path: (t, seed) => ({ x: seed + t * 0.14 + Math.sin(t * 5 + seed * 20) * 0.05, y: -0.1 + t * 1.2, angle: 0.5 + Math.sin(t * 5 + seed * 20) * 0.8 }), life: 0.85, fade: K.soft, colours: [0, 1] },
        ],
      },
    },
  })],
  ["jelly", (K) => ({
    shapes: {
      jellyfish: {
        reach: [1, 2],
        body: 0.25,
        draw(c, t) {
          K.halo(c, 1, t[0], 0.3);
          c.lineCap = "round"; c.lineWidth = 0.07; c.strokeStyle = K.fade(t[2], 0.85);
          for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x - 0.2, 0.5, x + 0.2, 0.9, x, 1.3); c.bezierCurveTo(x - 0.15, 1.6, x + 0.15, 1.75, x, 1.9); c.stroke(); }
          c.beginPath(); c.moveTo(-0.8, 0); c.bezierCurveTo(-0.8, -1.15, 0.8, -1.15, 0.8, 0); c.quadraticCurveTo(0.5, 0.2, 0.3, 0); c.quadraticCurveTo(0, 0.2, -0.3, 0); c.quadraticCurveTo(-0.5, 0.2, -0.8, 0); c.closePath();
          K.solid(c, K.along(c, [0, -0.9], [0, 0.1], [[0, K.fade(t[2], 0.95)], [1, K.fade(t[0], 0.8)]]), t[2], 0.05);
        },
      },
      plankton: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.28, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "jelly-rise": {
        tones: [K.TONES.pink, K.TONES.violet, K.TONES.aqua],
        still: 2000,
        layers: [
          ...K.depth({ count: 26, shape: "plankton", size: [0.006, 0.012], path: K.rise(0.05), life: 0.75, fade: K.twinkle, colours: [2, 1, 0] }),
          { count: 8, shape: "jellyfish", size: [0.034, 0.05], path: (t, seed) => ({ x: 0.08 + seed * 0.84 + Math.sin(t * 4 + seed * 20) * 0.04, y: 1.05 - t * 1.15 - Math.sin(t * 22 + seed * 9) * 0.012, squash: 0.86 + 0.14 * Math.sin(t * 22 + seed * 9), angle: Math.sin(t * 4 + seed * 20) * 0.2 }), life: 0.9, fade: K.soft, colours: [0, 1, 2] },
        ],
      },
    },
  })],
  ["jungle", (K) => ({
    shapes: {
      cutleaf: {
        reach: [1, 1.1],
        body: 0.5,
        draw(c, t) {
          c.scale(0.085, 0.085); c.translate(0, 12);
          const p = new Path2D("M0 0C-9 -3 -12.5 -12 -8 -21L-6 -17.5L-4.5 -22.5C-3 -24.5 3 -24.5 4.5 -22.5L6 -17.5L8 -21C12.5 -12 9 -3 0 0ZM-5.5 -9a1.6 2.4 20 1 0 0.1 0ZM5.5 -9a1.6 2.4 -20 1 0 0.1 0ZM-3.6 -15a1.3 2 15 1 0 0.1 0ZM3.6 -15a1.3 2 -15 1 0 0.1 0Z");
          c.fillStyle = K.along(c, [0, -24], [0, 0], [[0, t[2]], [0.5, t[0]], [1, t[1]]]); c.fill(p, "evenodd"); c.lineWidth = 0.8; c.lineJoin = "round"; c.strokeStyle = t[1]; c.stroke(p);
        },
      },
      bloom5: {
        reach: [1, 1],
        body: 0.6,
        draw(c, t) {
          for (let i = 0; i < 5; i++) { c.save(); c.rotate((i * K.TAU) / 5); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-0.5, -0.2, -0.65, -0.7, -0.3, -0.96); c.bezierCurveTo(-0.1, -1.06, 0.1, -1.06, 0.3, -0.96); c.bezierCurveTo(0.65, -0.7, 0.5, -0.2, 0, 0); K.solid(c, K.radial(c, 1, [[0, t[1]], [0.4, t[0]], [1, t[2]]]), t[1], 0.06); c.restore(); }
          c.beginPath(); c.arc(0, 0, 0.16, 0, K.TAU); c.fillStyle = "#FFD23F"; c.fill();
        },
      },
    },
    effects: {
      "tropic-fall": {
        tones: [K.TONES.green, ["#FF4F7A", "#A80E3A", "#FFB3C6"], ["#FFB03A", "#A85A06", "#FFE0A8"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 16, shape: "cutleaf", size: [0.026, 0.04], path: K.fall(0.1, 0.06, 7, 2), life: 0.82, fade: K.soft, colours: [0] }, 0.8, 0.4),
          { count: 8, shape: "bloom5", size: [0.026, 0.036], path: K.fall(0.06, 0.03, 0, 2.2), life: 0.8, fade: K.soft, colours: [1, 2] },
        ],
      },
    },
  })],
  ["alpine", (K) => ({
    shapes: {
      edelweiss: {
        reach: [1, 1],
        body: 0.5,
        draw(c, t) {
          for (let i = 0; i < 9; i++) { c.save(); c.rotate((i * K.TAU) / 9); c.beginPath(); c.moveTo(0, -0.18); c.bezierCurveTo(0.22, -0.42, 0.2, -0.78, 0, -1); c.bezierCurveTo(-0.2, -0.78, -0.22, -0.42, 0, -0.18); K.solid(c, "#FFFFFF", t[1], 0.05); c.restore(); }
          for (const [x, y] of [[0, 0], [0.18, 0.07], [-0.17, 0.1], [0.04, -0.19], [-0.07, 0.2]]) { c.beginPath(); c.arc(x, y, 0.13, 0, K.TAU); K.solid(c, "#E8D36A", "#8A7A1E", 0.04); }
        },
      },
      flakelet: { reach: [1, 1], body: 0.5, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.8, 0, K.TAU); K.solid(c, "#FFFFFF", t[1], 0.1); } },
    },
    effects: {
      "edelweiss-drift": {
        tones: [K.TONES.white],
        still: 1900,
        layers: [
          ...K.depth({ count: 30, shape: "flakelet", size: [0.006, 0.011], path: K.fall(0.03), life: 0.7, fade: K.soft, colours: [0] }),
          { count: 9, shape: "edelweiss", size: [0.028, 0.04], path: K.fall(0.06, 0.04, 0, 1.6), life: 0.85, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["sky", (K) => ({
    shapes: {
      airballoon: {
        reach: [0.8, 1.3],
        body: 0.5,
        draw(c, t) {
          c.strokeStyle = "#5A4A3A"; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.3, 0.5); c.lineTo(-0.14, 0.92); c.moveTo(0.3, 0.5); c.lineTo(0.14, 0.92); c.stroke();
          c.beginPath(); c.roundRect(-0.18, 0.88, 0.36, 0.26, 0.05); K.solid(c, "#B8834E", "#3A2414", 0.05);
          c.beginPath(); c.moveTo(0, -1.15); c.bezierCurveTo(0.6, -1.15, 0.72, -0.5, 0.72, -0.3); c.bezierCurveTo(0.72, 0.1, 0.4, 0.34, 0.32, 0.5); c.lineTo(-0.32, 0.5); c.bezierCurveTo(-0.4, 0.34, -0.72, 0.1, -0.72, -0.3); c.bezierCurveTo(-0.72, -0.5, -0.6, -1.15, 0, -1.15); c.closePath(); K.solid(c, t[0], t[1], 0.06);
          c.beginPath(); c.moveTo(0, -1.15); c.bezierCurveTo(0.22, -1.15, 0.3, -0.5, 0.3, -0.3); c.bezierCurveTo(0.3, 0.1, 0.18, 0.34, 0.14, 0.5); c.lineTo(-0.14, 0.5); c.bezierCurveTo(-0.18, 0.34, -0.3, 0.1, -0.3, -0.3); c.bezierCurveTo(-0.3, -0.5, -0.22, -1.15, 0, -1.15); c.fillStyle = t[2]; c.fill();
        },
      },
      cloudlet: { reach: [1.4, 0.8], wide: true, body: 0.3, unit: 60, draw(c, t) { c.fillStyle = K.fade("#FFFFFF", 0.8); for (const [x, y, r] of [[-0.6, 0.15, 0.45], [0, -0.15, 0.6], [0.6, 0.12, 0.48]]) { c.beginPath(); c.arc(x, y, r, 0, K.TAU); c.fill(); } c.fillRect(-0.75, 0.15, 1.5, 0.42); } },
    },
    effects: {
      "balloon-rise": {
        tones: [["#FF5A6E", "#8A1830", "#FFD23F"], ["#5B7BFF", "#2A3A9A", "#FFFFFF"], ["#4BC88A", "#1E6A46", "#FFE066"], ["#FF9A3C", "#8A4A06", "#FFFFFF"]],
        still: 2000,
        layers: [
          { count: 5, shape: "cloudlet", size: [0.07, 0.11], path: (t, seed, index) => ({ x: -0.2 + t * 0.5 + index * 0.24, y: 0.1 + K.random(index, 5) * 0.7 }), life: 0.95, start: (index) => 0.01 + index * 0.02, alpha: 0.4, fade: K.glow, colours: [0] },
          { count: 8, shape: "airballoon", size: [0.036, 0.054], path: (t, seed) => ({ x: 0.08 + seed * 0.84 + Math.sin(t * 3 + seed * 20) * 0.04, y: 1.15 - t * 1.25, angle: Math.sin(t * 3 + seed * 20) * 0.08 }), life: 0.9, fade: K.soft, colours: [0, 1, 2, 3] },
        ],
      },
    },
  })],
  ["football", (K) => ({
    shapes: {
      fball: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.94, 0, K.TAU); K.solid(c, K.radial(c, 1.2, [[0, "#FFFFFF"], [0.6, "#EEF2FA"], [1, "#B7C0D4"]], -0.3, -0.3), "#12141F", 0.1);
          const five = (x, y, r, turn) => { c.beginPath(); for (let i = 0; i < 5; i++) { const a = turn + (i * K.TAU) / 5 - K.TAU / 4; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fillStyle = "#12141F"; c.fill(); };
          five(0, 0, 0.38, 0);
          c.save(); c.beginPath(); c.arc(0, 0, 0.9, 0, K.TAU); c.clip();
          for (let i = 0; i < 5; i++) { const a = (i * K.TAU) / 5 - K.TAU / 4 + K.TAU / 10; five(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.3, a + K.TAU / 4); const b = (i * K.TAU) / 5 - K.TAU / 4; c.strokeStyle = "#12141F"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(Math.cos(b) * 0.38, Math.sin(b) * 0.38); c.lineTo(Math.cos(b) * 0.9, Math.sin(b) * 0.9); c.stroke(); }
          c.restore();
        },
      },
      turf: { reach: [0.4, 1], body: 0.5, draw(c, t) { K.shape(c, [[-0.35, 1], [0.1, -1], [0.35, 1]]); K.solid(c, t[0], t[1], 0.08); } },
    },
    effects: {
      kickoff: {
        tones: [K.TONES.white, K.TONES.green, K.TONES.mint],
        still: 1500,
        layers: [
          ...K.depth({ count: 20, shape: "turf", size: [0.01, 0.017], path: (t, seed, index) => ({ x: seed + (K.random(index, 4) - 0.5) * 0.1 * t, y: 1.04 - Math.sin(Math.PI * t) * (0.15 + K.random(index, 5) * 0.3), angle: t * 6 + seed * 6 }), life: 0.4, fade: K.soft, colours: [1, 2] }),
          { count: 7, shape: "fball", size: [0.03, 0.044], path: (t, seed, index) => ({ x: seed + (K.random(index, 4) - 0.5) * 0.3 * t, y: 1.08 - Math.abs(Math.sin(Math.PI * t * 1.5)) * (0.5 + K.random(index, 5) * 0.4) * (1 - t * 0.4), angle: t * 9 + seed * 6 }), life: 0.8, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["music", (K) => ({
    shapes: {
      note8: {
        reach: [1.1, 1.5],
        body: 0.3,
        draw(c, t) {
          c.scale(0.14, 0.14); c.translate(-3, 6);
          const p = new Path2D("M2.6 -1V-13.5L10 -15.5V-12L4.2 -10.5V0.5C4.2 3 1.8 4.2 -0.4 3.6C-2.4 3 -3 1 -1.6 -0.4C-0.4 -1.6 1.4 -1.8 2.6 -1Z");
          c.fillStyle = K.along(c, [0, -15], [0, 4], [[0, t[2]], [1, t[0]]]); c.fill(p); c.lineWidth = 0.5; c.lineJoin = "round"; c.strokeStyle = t[1]; c.stroke(p);
        },
      },
      beat: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.7); c.beginPath(); c.arc(0, 0, 0.26, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      melody: {
        tones: [K.TONES.pink, K.TONES.violet, K.TONES.aqua, K.TONES.gold],
        still: 1900,
        layers: [
          ...K.depth({ count: 16, shape: "note8", size: [0.026, 0.04], path: (t, seed) => ({ x: seed + Math.sin(t * 6 + seed * 20) * 0.06, y: 1.1 - t * 1.2, angle: Math.sin(t * 6 + seed * 20) * 0.3 }), life: 0.8, fade: K.soft, colours: [0, 1, 2, 3] }, 0.8, 0.4),
          ...K.depth({ count: 16, shape: "beat", size: [0.007, 0.012], path: K.rise(0.04), life: 0.7, fade: K.twinkle, colours: [3, 0] }),
        ],
      },
    },
  })],
  ["cute", (K) => ({
    shapes: {
      sprinkle: { reach: [1, 0.45], body: 0.8, draw(c, t) { c.beginPath(); c.roundRect(-0.95, -0.38, 1.9, 0.76, 0.38); K.solid(c, K.along(c, [0, -0.4], [0, 0.4], [[0, t[2]], [0.5, t[0]], [1, t[1]]]), t[1], 0.08); } },
      pawprint: {
        reach: [1, 1],
        body: 0.5,
        draw(c, t) {
          c.fillStyle = t[0]; c.strokeStyle = t[1]; c.lineWidth = 0.06;
          c.beginPath(); c.ellipse(0, 0.32, 0.56, 0.45, 0, 0, K.TAU); c.fill(); c.stroke();
          for (const [x, y] of [[-0.6, -0.3], [-0.2, -0.62], [0.2, -0.62], [0.6, -0.3]]) { c.beginPath(); c.arc(x, y, 0.24, 0, K.TAU); c.fill(); c.stroke(); }
        },
      },
    },
    effects: {
      "sugar-rush": {
        tones: [K.TONES.pink, K.TONES.gold, K.TONES.aqua, K.TONES.violet, K.TONES.green, ["#FF9DB8", "#C8507A", "#FFE3EC"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 30, shape: "sprinkle", size: [0.012, 0.02], path: K.fall(0.05, 0.02, 0, 5), life: 0.6, fade: K.soft, colours: [0, 1, 2, 3, 4] }, 0.8, 0.4),
          { count: 6, shape: "pawprint", size: [0.026, 0.036], path: (t, seed) => ({ x: 0.1 + seed * 0.8 + Math.sin(t * 5 + seed * 20) * 0.04, y: 1.08 - t * 1.16, angle: Math.sin(t * 6 + seed * 9) * 0.3 }), life: 0.85, fade: K.soft, colours: [5] },
        ],
      },
    },
  })],
  ["chess", (K) => {
    const draw = (d) => (c, t) => { c.scale(0.085, 0.085); c.translate(0, 10); const p = new Path2D(d); c.fillStyle = K.along(c, [-5, 0], [5, 0], [[0, t[2]], [0.5, t[0]], [1, t[1]]]); c.fill(p); c.lineWidth = 0.9; c.lineJoin = "round"; c.strokeStyle = t[1] === "#120E0C" ? "#C9B58A" : "#5A4A2A"; c.stroke(p); };
    return {
      shapes: {
        cpawn: { reach: [0.6, 1.1], body: 0.5, draw: draw("M-5 0H5V-2H3.6C3 -5 2 -7.5 1.6 -9.5H2.8V-11H1.4A3.4 3.4 0 1 0 -1.4 -11H-2.8V-9.5H-1.6C-2 -7.5 -3 -5 -3.6 -2H-5Z") },
        crook: { reach: [0.6, 1.1], body: 0.6, draw: draw("M-5.5 0H5.5V-2.2H4.2L3.4 -12H4.8V-17H2.8V-15H1.2V-17H-1.2V-15H-2.8V-17H-4.8V-12H-3.4L-4.2 -2.2H-5.5Z") },
        csquare: { reach: [1, 1], body: 0.9, draw(c, t) { c.fillStyle = t[0]; c.fillRect(-0.9, -0.9, 1.8, 1.8); c.lineWidth = 0.1; c.strokeStyle = t[1]; c.strokeRect(-0.9, -0.9, 1.8, 1.8); } },
      },
      effects: {
        gambit: {
          tones: [["#F1E6C8", "#C9B58A", "#FFFDF2"], ["#2A2420", "#120E0C", "#5A5048"], K.TONES.gold],
          still: 1900,
          layers: [
            ...K.depth({ count: 14, shape: "csquare", size: [0.01, 0.016], path: K.fall(0.04, 0, 8), life: 0.6, fade: K.soft, colours: [0, 1, 2] }),
            { count: 9, shape: "cpawn", size: [0.03, 0.042], path: (t, seed) => ({ x: 0.06 + seed * 0.88, y: -0.1 + t * 1.2, angle: Math.sin(t * 5 + seed * 9) * 0.5 }), life: 0.8, fade: K.soft, colours: [0, 1] },
            { count: 5, shape: "crook", size: [0.03, 0.042], path: (t, seed) => ({ x: 0.1 + seed * 0.8, y: -0.1 + t * 1.2, angle: Math.cos(t * 5 + seed * 9) * 0.5 }), life: 0.85, fade: K.soft, colours: [1, 0] },
          ],
        },
      },
    };
  }],
  ["tabletop", (K) => {
    const pips = [[[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]];
    return {
      shapes: {
        dice: {
          reach: [1, 1],
          body: 0.9,
          draw(c, t, frame) {
            c.beginPath(); c.roundRect(-0.92, -0.92, 1.84, 1.84, 0.4); K.solid(c, K.along(c, [-0.9, -0.9], [0.9, 0.9], [[0, "#FFFFFF"], [0.6, "#F1EDE2"], [1, "#CFC8B8"]]), "#1A1414", 0.1);
            c.fillStyle = "#1A1414"; for (const [x, y] of pips[frame % 6]) { c.beginPath(); c.arc(x * 0.46, y * 0.46, 0.17, 0, K.TAU); c.fill(); }
          },
        },
        chip: {
          reach: [1, 1],
          body: 0.8,
          draw(c, t) {
            c.beginPath(); c.arc(0, 0, 0.92, 0, K.TAU); K.solid(c, t[0], t[1], 0.09);
            c.setLineDash([0.36, 0.36]); c.lineWidth = 0.24; c.strokeStyle = "#FFFFFF"; c.beginPath(); c.arc(0, 0, 0.78, 0, K.TAU); c.stroke(); c.setLineDash([]);
            c.beginPath(); c.arc(0, 0, 0.42, 0, K.TAU); c.lineWidth = 0.07; c.strokeStyle = t[2]; c.stroke();
          },
        },
      },
      effects: {
        "lucky-roll": {
          tones: [K.TONES.red, ["#2A6AD9", "#12306A", "#BFD4FF"], ["#2A2420", "#0A0806", "#8A8078"]],
          still: 1700,
          layers: [
            ...K.depth({ count: 14, shape: "chip", size: [0.016, 0.024], path: K.fall(0.04, 0, 10, 0), life: 0.62, fade: K.soft, colours: [0, 1, 2] }, 0.8, 0.4),
            { count: 8, shape: "dice", size: [0.03, 0.042], path: (t, seed, index) => ({ x: seed + (K.random(index, 4) - 0.5) * 0.3 * t, y: 1.08 - Math.abs(Math.sin(Math.PI * t * 1.5)) * (0.55 + K.random(index, 5) * 0.4) * (1 - t * 0.4), angle: t * 8 + seed * 6, frame: index }), life: 0.8, fade: K.soft, colours: [0] },
          ],
        },
      },
    };
  }],
  ["hoops", (K) => ({
    shapes: {
      bball: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.94, 0, K.TAU); K.solid(c, K.radial(c, 1.3, [[0, t[2]], [0.5, t[0]], [1, t[1]]], -0.3, -0.3), "#1A0E08", 0.1);
          c.save(); c.beginPath(); c.arc(0, 0, 0.9, 0, K.TAU); c.clip(); c.strokeStyle = "#1A0E08"; c.lineWidth = 0.09;
          c.beginPath(); c.moveTo(-1, 0); c.lineTo(1, 0); c.moveTo(0, -1); c.lineTo(0, 1); c.moveTo(-0.7, -0.7); c.bezierCurveTo(-0.3, -0.3, -0.3, 0.3, -0.7, 0.7); c.moveTo(0.7, -0.7); c.bezierCurveTo(0.3, -0.3, 0.3, 0.3, 0.7, 0.7); c.stroke(); c.restore();
        },
      },
      dustpuff: { reach: [1, 1], body: 0.15, draw(c, t) { K.halo(c, 1, t[2], 0.5); } },
    },
    effects: {
      swish: {
        tones: [["#F27A1E", "#B84A0C", "#FFB066"], ["#F4E3C8", "#A8906A", "#FFF6E6"]],
        still: 1500,
        layers: [
          { count: 12, shape: "dustpuff", size: [0.02, 0.04], path: (t, seed) => ({ x: seed, y: 1.02 - t * 0.12, grow: 0.5 + t }), life: 0.3, alpha: 0.4, fade: K.glow, colours: [1] },
          { count: 8, shape: "bball", size: [0.032, 0.046], path: (t, seed, index) => ({ x: seed + (K.random(index, 4) - 0.5) * 0.3 * t, y: 1.08 - Math.abs(Math.sin(Math.PI * t * 1.5)) * (0.55 + K.random(index, 5) * 0.4) * (1 - t * 0.4), angle: t * 8 + seed * 6 }), life: 0.8, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["retro", (K) => ({
    shapes: {
      tapelet: {
        reach: [1.1, 0.75],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.roundRect(-1, -0.64, 2, 1.28, 0.12); K.solid(c, "#3A3028", "#1A120C", 0.07);
          c.fillStyle = "#F6ECD6"; c.fillRect(-0.84, -0.5, 1.68, 0.72); c.fillStyle = t[0]; c.fillRect(-0.84, -0.5, 1.68, 0.14); c.fillStyle = t[2]; c.fillRect(-0.84, -0.36, 1.68, 0.1);
          c.beginPath(); c.roundRect(-0.5, -0.16, 1, 0.32, 0.16); c.fillStyle = "#2A2420"; c.fill();
          for (const x of [-0.28, 0.28]) { c.beginPath(); c.arc(x, 0, 0.11, 0, K.TAU); c.fillStyle = "#F6ECD6"; c.fill(); }
        },
      },
      playtri: { reach: [1, 1], body: 0.4, draw(c, t) { for (const x of [-0.5, 0.35]) { K.shape(c, [[x + 0.55, -0.7], [x - 0.35, 0], [x + 0.55, 0.7]]); K.solid(c, t[0], t[1], 0.1); } } },
    },
    effects: {
      rewind: {
        tones: [["#F27A1E", "#8A3A08", "#FFD23F"], ["#2FB8A6", "#0E5E57", "#C8F5EE"], K.TONES.gold],
        still: 1900,
        layers: [
          ...K.depth({ count: 14, shape: "playtri", size: [0.012, 0.02], path: (t, seed) => ({ x: 1.1 - t * 1.3, y: seed }), life: 0.5, fade: K.soft, colours: [2, 0, 1] }),
          { count: 8, shape: "tapelet", size: [0.034, 0.048], path: (t, seed) => ({ x: 0.08 + seed * 0.84 + Math.sin(t * 5 + seed * 20) * 0.04, y: -0.1 + t * 1.2, angle: Math.sin(t * 5 + seed * 20) * 0.5 }), life: 0.85, fade: K.soft, colours: [0, 1] },
        ],
      },
    },
  })],
  ["party", (K) => ({
    shapes: {
      giftbox: {
        reach: [1, 1.2],
        body: 0.7,
        draw(c, t) {
          c.beginPath(); c.roundRect(-0.85, -0.5, 1.7, 1.45, 0.1); K.solid(c, K.along(c, [0, -0.5], [0, 0.95], [[0, t[2]], [0.4, t[0]], [1, t[1]]]), t[1], 0.08);
          c.beginPath(); c.roundRect(-0.95, -0.72, 1.9, 0.44, 0.08); K.solid(c, t[0], t[1], 0.08);
          c.fillStyle = "#FFD23F"; c.fillRect(-0.16, -0.72, 0.32, 1.67); c.fillRect(-0.85, 0.12, 1.7, 0.22);
          c.strokeStyle = "#A9660A"; c.lineWidth = 0.07; c.fillStyle = "#FFD23F";
          for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, -0.72); c.bezierCurveTo(s * 0.3, -1.25, s * 0.85, -1.2, s * 0.8, -0.85); c.bezierCurveTo(s * 0.6, -0.6, s * 0.25, -0.62, 0, -0.72); c.fill(); c.stroke(); }
        },
      },
      bulb: { reach: [1, 1], body: 0.3, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.34, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "gift-drop": {
        tones: [K.TONES.red, K.TONES.teal, K.TONES.violet, K.TONES.sky, K.TONES.gold],
        still: 1900,
        layers: [
          ...K.depth({ count: 22, shape: "bulb", size: [0.008, 0.014], path: (t, seed, index) => ({ x: seed, y: K.random(index, 5) }), life: 0.3, fade: K.glow, colours: [0, 4, 1, 3, 2] }),
          { count: 9, shape: "giftbox", size: [0.028, 0.04], path: (t, seed) => ({ x: 0.06 + seed * 0.88 + Math.sin(t * 5 + seed * 20) * 0.04, y: -0.12 + t * 1.22, angle: Math.sin(t * 5 + seed * 20) * 0.35 }), life: 0.8, fade: K.soft, colours: [0, 1, 2, 3] },
        ],
      },
    },
  })],
  ["science", (K) => ({
    shapes: {
      molecule: {
        reach: [1.1, 1.1],
        body: 0.25,
        draw(c, t) {
          const pts = []; for (let i = 0; i < 6; i++) { const a = (i * K.TAU) / 6; pts.push([Math.cos(a) * 0.75, Math.sin(a) * 0.75]); }
          c.strokeStyle = t[2]; c.lineWidth = 0.09; K.shape(c, pts); c.stroke();
          pts.forEach(([x, y], i) => { c.beginPath(); c.arc(x, y, i % 2 ? 0.17 : 0.24, 0, K.TAU); K.solid(c, i % 2 ? t[2] : t[0], t[1], 0.06); });
        },
      },
      fizz: { reach: [1, 1], body: 0.15, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.85, 0, K.TAU); c.lineWidth = 0.14; c.strokeStyle = K.fade(t[2], 0.9); c.stroke(); c.beginPath(); c.arc(-0.3, -0.3, 0.18, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      molecules: {
        tones: [K.TONES.aqua, K.TONES.violet, K.TONES.lime],
        still: 1900,
        layers: [
          ...K.depth({ count: 18, shape: "fizz", size: [0.008, 0.018], path: K.rise(0.03), life: 0.7, fade: K.soft, colours: [0] }, 1, 0.4),
          { count: 10, shape: "molecule", size: [0.03, 0.046], path: (t, seed) => ({ x: seed + Math.sin(t * 4 + seed * 20) * 0.04, y: 1.1 - t * 1.2, angle: t * 1.6 + seed * 6 }), life: 0.85, fade: K.soft, colours: [0, 1, 2] },
        ],
      },
    },
  })],
  ["books", (K) => ({
    shapes: {
      sheet: {
        reach: [0.8, 1.05],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.moveTo(-0.7, -1); c.lineTo(0.42, -1); c.lineTo(0.7, -0.72); c.lineTo(0.7, 1); c.lineTo(-0.7, 1); c.closePath(); K.solid(c, K.along(c, [-0.7, -1], [0.7, 1], [[0, "#FFFFFF"], [1, t[0]]]), t[1], 0.06);
          K.shape(c, [[0.42, -1], [0.7, -0.72], [0.42, -0.72]]); c.fillStyle = t[1]; c.globalAlpha = 0.5; c.fill(); c.globalAlpha = 1;
          c.strokeStyle = t[1]; c.lineWidth = 0.05; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(-0.46, -0.5 + i * 0.3); c.lineTo(i === 4 ? 0.1 : 0.46, -0.5 + i * 0.3); } c.stroke();
        },
      },
      marker: { reach: [0.4, 1], body: 0.7, draw(c, t) { K.shape(c, [[-0.32, -1], [0.32, -1], [0.32, 1], [0, 0.66], [-0.32, 1]]); K.solid(c, t[0], t[1], 0.08); } },
    },
    effects: {
      "loose-pages": {
        tones: [["#F1E6C8", "#8A7A5A", "#FFFDF6"], K.TONES.red, K.TONES.gold],
        still: 1900,
        layers: [
          ...K.depth({ count: 16, shape: "sheet", size: [0.022, 0.034], path: K.fall(0.1, 0.08, 6, 2), life: 0.8, fade: K.soft, colours: [0] }, 0.8, 0.4),
          { count: 6, shape: "marker", size: [0.016, 0.024], path: K.fall(0.05, 0.03, 0, 1.2), life: 0.75, fade: K.soft, colours: [1, 2] },
        ],
      },
    },
  })],
  ["icecream", (K) => ({
    shapes: {
      scoop: {
        reach: [1, 1],
        body: 0.8,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.9, 0, K.TAU); K.solid(c, K.radial(c, 1.3, [[0, t[2]], [0.55, t[0]], [1, t[1]]], -0.3, -0.3), t[1], 0.08);
          c.beginPath(); c.arc(-0.3, -0.32, 0.18, 0, K.TAU); c.fillStyle = "#FFFFFFB0"; c.fill();
          c.fillStyle = t[1]; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(0, 0.62, 0.86, 0.26, 0, 0, K.TAU); c.fill(); c.globalAlpha = 1;
        },
      },
      cherrydrop: {
        reach: [1, 1.2],
        body: 0.5,
        draw(c, t) {
          c.strokeStyle = "#3F7A3A"; c.lineWidth = 0.12; c.lineCap = "round"; c.beginPath(); c.moveTo(0, -0.1); c.quadraticCurveTo(0.2, -0.9, 0.8, -1.05); c.stroke();
          c.beginPath(); c.arc(0, 0.3, 0.62, 0, K.TAU); K.solid(c, K.radial(c, 0.9, [[0, "#FF8A96"], [0.6, "#E0263E"], [1, "#A00E24"]], -0.2, 0.1), "#6A0A1C", 0.08);
        },
      },
      sprink: { reach: [1, 0.45], body: 0.8, draw(c, t) { c.beginPath(); c.roundRect(-0.95, -0.38, 1.9, 0.76, 0.38); K.solid(c, t[0], t[1], 0.08); } },
    },
    effects: {
      "sweet-scoops": {
        tones: [["#FF8FB8", "#B8306A", "#FFD6E6"], ["#8FE0C0", "#2F8A66", "#E2FBF2"], ["#FFE9B0", "#B89A4A", "#FFFBEA"], K.TONES.sky, K.TONES.violet],
        still: 1900,
        layers: [
          ...K.depth({ count: 22, shape: "sprink", size: [0.01, 0.017], path: K.fall(0.05, 0.02, 0, 5), life: 0.6, fade: K.soft, colours: [0, 3, 4, 1] }),
          { count: 9, shape: "scoop", size: [0.03, 0.042], path: K.fall(0.04, 0.02, 0, 1), life: 0.8, fade: K.soft, colours: [0, 1, 2] },
          { count: 4, shape: "cherrydrop", size: [0.022, 0.03], path: K.fall(0.03, 0, 0, 0.8), life: 0.7, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["camera", (K) => ({
    shapes: {
      instant: {
        reach: [0.9, 1.05],
        body: 0.85,
        draw(c, t, frame) {
          c.beginPath(); c.roundRect(-0.84, -1, 1.68, 2, 0.08); K.solid(c, "#FFFDF6", "#8A8070", 0.06);
          const sky = [t[0], t[2]][frame % 2];
          c.fillStyle = sky; c.fillRect(-0.67, -0.83, 1.34, 1.22);
          K.shape(c, [[-0.67, 0.39], [-0.2, -0.16], [0.16, 0.17], [0.42, -0.06], [0.67, 0.39]]); c.fillStyle = t[1]; c.fill();
          c.beginPath(); c.arc(0.36, -0.52, 0.16, 0, K.TAU); c.fillStyle = "#FFF6C8"; c.fill();
        },
      },
      filmbit: { reach: [1, 0.6], body: 0.8, draw(c, t) { c.fillStyle = "#1C1612"; c.fillRect(-1, -0.56, 2, 1.12); c.fillStyle = t[0]; c.fillRect(-0.8, -0.26, 1.6, 0.52); c.fillStyle = "#F4F6FF"; for (const x of [-0.7, -0.2, 0.3]) { c.fillRect(x, -0.5, 0.26, 0.16); c.fillRect(x, 0.34, 0.26, 0.16); } } },
    },
    effects: {
      snapshots: {
        tones: [["#8ECBFF", "#3F9A56", "#FFB86A"], ["#FFB86A", "#8A3A5A", "#C9B6FF"], ["#C97A3A", "#5A3A1E", "#F2B87A"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 12, shape: "filmbit", size: [0.014, 0.022], path: K.fall(0.06, 0.03, 7, 2), life: 0.66, fade: K.soft, colours: [2] }),
          { count: 9, shape: "instant", size: [0.034, 0.048], path: (t, seed, index) => ({ x: 0.06 + seed * 0.88 + Math.sin(t * 5 + seed * 20) * 0.05, y: -0.12 + t * 1.22, angle: Math.sin(t * 5 + seed * 20) * 0.45, frame: index }), life: 0.82, fade: K.soft, colours: [0, 1] },
        ],
      },
    },
  })],
  ["timepiece", (K) => ({
    shapes: {
      cogwheel: {
        reach: [1.1, 1.1],
        body: 0.5,
        draw(c, t) {
          for (let i = 0; i < 10; i++) { c.save(); c.rotate((i * K.TAU) / 10); c.beginPath(); c.rect(-0.12, -1.06, 0.24, 0.3); K.solid(c, t[0], "#2A1A08", 0.06); c.restore(); }
          c.beginPath(); c.arc(0, 0, 0.84, 0, K.TAU); K.solid(c, K.radial(c, 1.1, [[0, t[2]], [0.6, t[0]], [1, t[1]]], -0.25, -0.25), "#2A1A08", 0.08);
          c.beginPath(); c.arc(0, 0, 0.56, 0, K.TAU); c.lineWidth = 0.05; c.strokeStyle = "#2A1A08"; c.stroke();
          c.beginPath(); c.arc(0, 0, 0.18, 0, K.TAU); c.fillStyle = "#2A1A08"; c.fill();
        },
      },
      tick: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.7); c.beginPath(); c.arc(0, 0, 0.28, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "clockwork-fall": {
        tones: [K.TONES.gold, ["#B9C2D0", "#5A6478", "#F1F5FB"], ["#B8862E", "#5A3A0E", "#F2C86A"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 20, shape: "tick", size: [0.006, 0.011], path: K.rise(0.03), life: 0.7, fade: K.twinkle, colours: [0] }),
          { count: 11, shape: "cogwheel", size: [0.022, 0.04], path: (t, seed, index) => ({ x: 0.06 + seed * 0.88, y: -0.1 + t * 1.2, angle: (index % 2 ? 1 : -1) * t * 6 + seed * 6 }), life: 0.82, fade: K.soft, colours: [0, 1, 2] },
        ],
      },
    },
  })],
  ["critters", (K) => ({
    shapes: {
      carrot: {
        reach: [0.6, 1.3],
        body: 0.5,
        draw(c, t) {
          K.shape(c, [[-0.2, -0.75], [-0.42, -1.25], [-0.02, -0.9]]); K.solid(c, "#4CAF6D", "#12382B", 0.06); K.shape(c, [[0.2, -0.75], [0.42, -1.25], [0.02, -0.9]]); K.solid(c, "#4CAF6D", "#12382B", 0.06);
          K.shape(c, [[-0.46, -0.8], [0.46, -0.8], [0, 1.2]]); K.solid(c, K.along(c, [0, -0.8], [0, 1.2], [[0, "#FFB03A"], [1, "#E0621A"]]), "#8A3A08", 0.08);
        },
      },
      berry: { reach: [1, 1], body: 0.7, draw(c, t) { c.beginPath(); c.arc(0, 0.1, 0.8, 0, K.TAU); K.solid(c, K.radial(c, 1.1, [[0, t[2]], [0.5, t[0]], [1, t[1]]], -0.25, -0.2), t[1], 0.09); K.shape(c, [[-0.3, -0.7], [0, -1], [0.3, -0.7], [0, -0.5]]); c.fillStyle = "#4CAF6D"; c.fill(); } },
      honeydrop: { reach: [0.7, 1], body: 0.6, draw(c, t) { c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.2, -0.3, 0.65, 0.1, 0.65, 0.45); c.arc(0, 0.45, 0.65, 0, Math.PI); c.bezierCurveTo(-0.65, 0.1, -0.2, -0.3, 0, -1); K.solid(c, K.along(c, [0, -1], [0, 1], [[0, "#FFE08A"], [1, "#F29A0E"]]), "#8A5206", 0.08); } },
    },
    effects: {
      "snack-fall": {
        tones: [["#E5484D", "#8C1D22", "#FFB0B4"], ["#7A5CFF", "#3A2A9A", "#C9B6FF"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 12, shape: "honeydrop", size: [0.01, 0.017], path: K.fall(0.02, 0, 0, 0), life: 0.5, fade: K.soft, colours: [0] }),
          { count: 9, shape: "berry", size: [0.016, 0.024], path: K.fall(0.05, 0.02, 0, 2), life: 0.7, fade: K.soft, colours: [0, 1] },
          { count: 7, shape: "carrot", size: [0.026, 0.036], path: K.fall(0.06, 0.03, 0, 2.4), life: 0.8, fade: K.soft, colours: [0] },
        ],
      },
    },
  })],
  ["fireworks", (K) => {
    const centres = [[0.3, 0.3, 0.06], [0.7, 0.24, 0.28], [0.5, 0.5, 0.5], [0.22, 0.6, 0.62]];
    return {
      shapes: {
        ember: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[0], 0.8); c.beginPath(); c.arc(0, 0, 0.3, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
        streak: { reach: [0.2, 1], body: 0.5, draw(c, t) { c.fillStyle = K.along(c, [0, -1], [0, 1], [[0, K.fade(t[2], 0.95)], [1, K.fade(t[0], 0)]]); c.beginPath(); c.ellipse(0, 0, 0.16, 1, 0, 0, K.TAU); c.fill(); } },
      },
      effects: {
        "sky-bursts": {
          tones: [K.TONES.pink, K.TONES.sky, K.TONES.gold, K.TONES.mint],
          still: 1500,
          // each burst opens slowly from its centre, then drifts down as it fades
          layers: centres.flatMap(([cx, cy, start], which) => [
            {
              count: 22,
              shape: "ember",
              size: [0.012, 0.02],
              path: (t, seed, index) => { const a = (index / 22) * K.TAU; const out = 1 - (1 - t) ** 2.4; const r = 0.19 * out * (0.7 + K.random(index, 4) * 0.5); return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82 + t * t * 0.07 }; },
              life: 0.34,
              start: () => start,
              fade: (t) => Math.min(1, t / 0.25, (1 - t) / 0.5),
              colours: [which % 4],
            },
            {
              count: 12,
              shape: "streak",
              size: [0.022, 0.034],
              path: (t, seed, index) => { const a = (index / 12) * K.TAU + 0.26; const out = 1 - (1 - t) ** 2.4; const r = 0.13 * out; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.82 + t * t * 0.05, angle: a - Math.PI / 2 }; },
              life: 0.28,
              start: () => start + 0.01,
              fade: (t) => Math.min(1, t / 0.25, (1 - t) / 0.5) * 0.8,
              colours: [which % 4],
            },
          ]),
        },
      },
    };
  }],
  ["pastel", (K) => ({
    shapes: {
      bokeh: {
        reach: [1, 1],
        body: 0.3,
        unit: 96,
        draw(c, t) {
          c.beginPath(); c.arc(0, 0, 0.9, 0, K.TAU);
          c.fillStyle = K.radial(c, 0.9, [[0, K.fade(t[0], 0.35)], [0.8, K.fade(t[0], 0.5)], [1, K.fade(t[0], 0)]]); c.fill();
          c.beginPath(); c.arc(0, 0, 0.74, 0, K.TAU); c.lineWidth = 0.05; c.strokeStyle = K.fade(t[2], 0.7); c.stroke();
        },
      },
      speck: { reach: [1, 1], body: 0.4, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.6, 0, K.TAU); c.fillStyle = t[2]; c.fill(); } },
    },
    effects: {
      "soft-orbs": {
        tones: [["#FFB8A3", "#C97A66", "#FFE3DA"], ["#C9B6FF", "#7A66C9", "#EDE6FF"], ["#A8F0D8", "#4FA88A", "#E2FBF2"], ["#A9D6FF", "#5A8FC9", "#E3F2FF"]],
        still: 2000,
        layers: [
          ...K.depth({
            count: 12,
            shape: "bokeh",
            size: [0.04, 0.075],
            path: (t, seed) => ({ x: seed + Math.sin(t * 3 + seed * 20) * 0.05, y: 1.1 - t * 1.2, grow: 0.8 + t * 0.4 }),
            life: 0.95,
            fade: K.glow,
            colours: [0, 1, 2, 3],
          }, 0.9, 0.4),
          {
            count: 20,
            shape: "speck",
            size: [0.004, 0.008],
            path: K.rise(0.03),
            life: 0.8,
            fade: K.twinkle,
            colours: [0, 1, 2, 3],
          },
        ],
      },
    },
  })],
  ["glass", (K) => ({
    shapes: {
      lightpane: {
        reach: [0.7, 1.1],
        body: 0.5,
        draw(c, t) { K.shape(c, [[0, -1.05], [0.62, 0], [0, 1.05], [-0.62, 0]]); c.fillStyle = K.along(c, [-0.6, -1], [0.6, 1], [[0, K.fade(t[2], 0.85)], [1, K.fade(t[0], 0.6)]]); c.fill(); c.lineWidth = 0.07; c.strokeStyle = K.fade(t[1], 0.8); c.stroke(); },
      },
      dustmote: { reach: [1, 1], body: 0.25, draw(c, t) { K.halo(c, 1, t[2], 0.7); c.beginPath(); c.arc(0, 0, 0.26, 0, K.TAU); c.fillStyle = "#FFFFFF"; c.fill(); } },
    },
    effects: {
      "glass-light": {
        tones: [["#C8102E", "#6A0A1C", "#FF7A8A"], ["#1E5AD9", "#0E2A7A", "#7FB8FF"], ["#E8A20E", "#8A5E06", "#FFE08A"], ["#12964A", "#0A4A26", "#7FE6A8"], ["#6A3AD0", "#3A1A8A", "#C99BFF"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 20, shape: "dustmote", size: [0.005, 0.01], path: K.rise(0.04), life: 0.75, fade: K.twinkle, colours: [2, 1] }),
          ...K.depth({ count: 16, shape: "lightpane", size: [0.02, 0.034], path: (t, seed) => ({ x: seed + t * 0.16, y: -0.1 + t * 1.2, angle: 0.4 + Math.sin(t * 3 + seed * 9) * 0.3 }), life: 0.85, alpha: 0.75, fade: K.soft, colours: [0, 1, 2, 3, 4] }, 0.8, 0.4),
        ],
      },
    },
  })],
  ["origami", (K) => ({
    shapes: {
      pcrane: {
        reach: [1.1, 0.9],
        body: 0.4,
        draw(c, t) {
          c.scale(0.07, 0.07);
          const part = (pts, fill) => { K.shape(c, pts); c.fillStyle = fill; c.fill(); c.lineWidth = 0.7; c.lineJoin = "round"; c.strokeStyle = t[1]; c.stroke(); };
          part([[-10, 2], [-15, -5], [-6, 1]], t[0]); part([[-2, 0], [-8, -12], [3, -3]], t[0]); part([[-10, 2], [-2, 0], [3, -3], [8, 3], [0, 5]], t[2]); part([[-2, 0], [6, -11], [3, -3]], "#FFFFFF"); part([[6, 1.5], [12, -6], [14.6, -5], [12.6, -4.4], [8, 3]], "#FFFFFF");
        },
      },
      scrap: { reach: [1, 1], body: 0.5, draw(c, t) { K.shape(c, [[-0.9, 0.7], [0.1, -0.9], [0.9, 0.5]]); K.solid(c, t[2], t[1], 0.1); K.shape(c, [[-0.9, 0.7], [0.1, -0.9], [0, 0.2]]); c.fillStyle = t[0]; c.fill(); } },
    },
    effects: {
      "crane-flight": {
        tones: [["#FF9DB8", "#8A4A6A", "#FFD6E4"], ["#8EC0F5", "#3A5A8A", "#D6E8FF"], ["#FFD24A", "#8A6A1A", "#FFF0B8"], ["#7FD6A8", "#2A6A4A", "#C8F5DC"]],
        still: 1900,
        layers: [
          ...K.depth({ count: 14, shape: "scrap", size: [0.01, 0.017], path: K.fall(0.07, 0.05, 7), life: 0.7, fade: K.soft, colours: [0, 1, 2, 3] }),
          { count: 9, shape: "pcrane", size: [0.04, 0.058], path: (t, seed, index) => ({ x: -0.15 + t * 1.3, y: 0.1 + seed * 0.72 - t * 0.12 + Math.sin(t * 8 + seed * 9) * 0.03, angle: -0.16 + Math.sin(t * 8 + seed * 9) * 0.12, squash: 1 }), life: 0.7, fade: K.soft, colours: [0, 1, 2, 3] },
        ],
      },
    },
  })],
  ["pulse", (K) => ({
    shapes: {
      padplus: {
        reach: [1, 1],
        body: 0.5,
        draw(c, t) {
          K.shape(c, [[-0.3, -0.9], [0.3, -0.9], [0.3, -0.3], [0.9, -0.3], [0.9, 0.3], [0.3, 0.3], [0.3, 0.9], [-0.3, 0.9], [-0.3, 0.3], [-0.9, 0.3], [-0.9, -0.3], [-0.3, -0.3]]);
          K.solid(c, t[0], t[1], 0.12);
        },
      },
      paddot: { reach: [1, 1], body: 0.6, draw(c, t) { c.beginPath(); c.arc(0, 0, 0.8, 0, K.TAU); K.solid(c, K.radial(c, 1, [[0, t[2]], [0.6, t[0]], [1, t[1]]], -0.25, -0.25), t[1], 0.1); } },
      beatring: {
        reach: [1.05, 1.05],
        wide: true,
        body: 0.05,
        unit: 160,
        draw(c, t) { c.beginPath(); c.arc(0, 0, 0.96, 0, K.TAU); c.lineWidth = 0.035; c.strokeStyle = K.fade(t[0], 0.9); c.stroke(); },
      },
    },
    effects: {
      "pulse-beat": {
        tones: [K.TONES.action, K.TONES.white, K.TONES.pink],
        still: 1400,
        layers: [
          {
            count: 4,
            shape: "beatring",
            size: [0.3, 0.3],
            path: (t) => ({ x: 0.5, y: 0.4, grow: 0.12 + t * 1.2 }),
            life: 0.36,
            start: (index) => 0.04 + Math.floor(index / 2) * 0.42 + (index % 2) * 0.09,
            fade: (t) => Math.sin(Math.PI * t) * 0.7,
            colours: [0, 2],
          },
          ...K.depth({
            count: 12,
            shape: "padplus",
            size: [0.012, 0.02],
            path: K.rise(0.03, 0.5),
            life: 0.7,
            fade: K.soft,
            colours: [0, 1],
          }),
          ...K.depth({
            count: 12,
            shape: "paddot",
            size: [0.008, 0.014],
            path: K.rise(0.04),
            life: 0.75,
            fade: K.soft,
            colours: [2, 0, 1],
          }),
        ],
      },
    },
  })],
  ["starling", (K) => {
    const centre = (u) => [0.5 + 0.36 * Math.sin(u * 5.2 + 0.4), 0.42 + 0.22 * Math.sin(u * 9.5)];
    return {
      shapes: {
        wingbird: {
          reach: [1.05, 0.5],
          body: 0.4,
          draw(c, t) {
            c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-0.29, -0.37, -0.71, -0.43, -1, -0.23); c.bezierCurveTo(-0.71, -0.2, -0.51, -0.06, -0.34, 0.17); c.lineTo(0, 0.37); c.lineTo(0.34, 0.17);
            c.bezierCurveTo(0.51, -0.06, 0.71, -0.2, 1, -0.23); c.bezierCurveTo(0.71, -0.43, 0.29, -0.37, 0, 0); c.closePath();
            K.solid(c, t[0], t[1], 0.07);
          },
        },
      },
      effects: {
        "flock-sweep": {
          tones: [K.TONES.violet, K.TONES.teal, K.TONES.rose],
          still: 2000,
          layers: [
            {
              count: 80,
              shape: "wingbird",
              size: [0.016, 0.027],
              path: (t, seed, index) => {
                const u = t + K.random(index, 4) * 0.1;
                const [x, y] = centre(u);
                const [x2, y2] = centre(u + 0.01);
                const wide = 0.15 + 0.09 * Math.sin(u * 7);
                return {
                  x: x + (K.random(index, 5) - 0.5) * wide * 2,
                  y: y + (K.random(index, 6) - 0.5) * wide * 2.2,
                  angle: Math.atan2((y2 - y) * 1.3, x2 - x) + Math.PI / 2,
                  squash: 0.5 + 0.5 * Math.abs(Math.cos(t * 50 + index)),
                };
              },
              life: 0.96,
              start: () => 0.02,
              fade: K.soft,
              colours: [0, 1, 0, 2],
            },
          ],
        },
      },
    };
  }],
];
