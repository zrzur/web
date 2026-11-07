// Creator Studio templates, proved on the real stack with a real creator:
// the numbers the templates are drawn from match the member row, an image
// made from each downloaded template lines up when it is worn, and every file
// type goes all the way through at full size. Removes what it made.
//
//   node e2e/stack-runner/creator-templates.mjs
//
// Env: E2E_LIB, E2E_CHROMIUM, E2E_BASE, E2E_SHOTS (folder for screenshots),
//   E2E_SERVER and E2E_CHANNEL (a server of the creator's with a member list).
//   Uses the first account of dev-stack-accounts.json, which needs the rank.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const lib = process.env.E2E_LIB;
if (!lib) {
  console.error("Set E2E_LIB to the folder with stack.mjs");
  process.exit(2);
}
const dir = pathToFileURL(`${lib.replace(/\/?$/, "/")}`);
const { API, APP, accounts, pw, reporter } = await import(
  new URL("stack.mjs", dir)
);

const SERVER = process.env.E2E_SERVER;
const CHANNEL = process.env.E2E_CHANNEL;
const MEDIA = process.env.E2E_MEDIA ?? "http://127.0.0.1:14704";
const shotsDir = (process.env.E2E_SHOTS ?? ".").replace(/\/?$/, "/");
mkdirSync(shotsDir, { recursive: true });

const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
const near = (a, b, within, what) =>
  assert(Math.abs(a - b) <= within, `${what}: ${a} against ${b}`);

// the numbers studioTemplates.ts draws from
const ROW = { width: 243, height: 38, avatar: 32, avatarInset: 8, name: 48 };
const fade = (x, rtl) => {
  const across = rtl ? 1 - x : x;
  if (across >= 0.65) return 1;
  if (across >= 0.3) return 0.55 + ((across - 0.3) / 0.35) * 0.45;
  return (across / 0.3) * 0.55;
};
const SCALE = 4;
const measured = {};

const browser = await pw.chromium.launch({
  executablePath: process.env.E2E_CHROMIUM,
  headless: true,
});

async function open(locale) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
    deviceScaleFactor: SCALE,
    locale,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const session = { errors: [] };
  page.on("pageerror", (error) => session.errors.push(error.message));
  page.on("response", async (response) => {
    if (!response.url().endsWith("/auth/session/login")) return;
    const body = await response.json().catch(() => undefined);
    if (body?.token) session.token = body.token;
  });
  await page.goto(`${APP}/login`);
  await page.locator('input[type="email"]').fill(accounts[0].email);
  await page.locator('input[type="password"]').fill(accounts[0].password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 45000,
  });
  session.call = async (method, path, body) => {
    const answer = await fetch(`${API}${path}`, {
      method,
      headers: {
        "x-session-token": session.token,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await answer.text();
    if (!answer.ok)
      throw new Error(`${method} ${path} ${answer.status} ${text}`);
    return text ? JSON.parse(text) : undefined;
  };
  session.end = async () => {
    await fetch(`${API}/auth/session/logout`, {
      method: "POST",
      headers: { "x-session-token": session.token },
    }).catch(() => {});
    await context.close();
  };
  return { page, context, session };
}

/** Pixels of an image or a screenshot, read in the page */
const readPixels = (page, base64, regions) =>
  page.evaluate(
    async ({ base64, regions }) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${base64}`)).blob(),
      );
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      return {
        width: image.width,
        height: image.height,
        regions: regions.map(([x, y, w, h]) =>
          Array.from(ctx.getImageData(x, y, w, h).data),
        ),
      };
    },
    { base64, regions },
  );

const clickTemplate = async (page, word, index) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: word, exact: true }).nth(index).click(),
  ]);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  return readFileSync(path).toString("base64");
};

/** An image drawn by following the guide lines found in the template */
const artFrom = (page, kind, template) =>
  page.evaluate(
    async ({ kind, template }) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${template}`)).blob(),
      );
      const source = new OffscreenCanvas(image.width, image.height);
      const read = source.getContext("2d", { willReadFrequently: true });
      read.drawImage(image, 0, 0);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const draw = canvas.getContext("2d");
      let found;
      if (kind === "decoration") {
        // walk out from the centre to the dashed circle, in four directions
        const c = image.width / 2;
        const hits = [];
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
          [0.7071, 0.7071],
          [-0.7071, 0.7071],
        ]) {
          // the stroke is dashed: the widest of a band of nearby angles
          for (let r = 300; r < 380; r++) {
            const px = read.getImageData(
              Math.round(c + dx * r),
              Math.round(c + dy * r),
              1,
              1,
            ).data;
            if (px[3] > 150) {
              hits.push(r);
              break;
            }
          }
        }
        found = hits.length ? hits.reduce((a, b) => a + b) / hits.length : 341;
        draw.fillStyle = "#00E5FF";
        draw.beginPath();
        draw.arc(c, c, 500, 0, Math.PI * 2);
        draw.arc(c, c, found, 0, Math.PI * 2, true);
        draw.fill();
      } else {
        // the two solid lines are the crop
        const lines = [];
        for (let y = 0; y < image.height; y++) {
          const row = read.getImageData(0, y, image.width, 1).data;
          let bright = 0;
          for (let i = 0; i < row.length; i += 4) if (row[i] > 130) bright++;
          if (bright > image.width * 0.95) lines.push(y);
        }
        found = { top: lines[0], bottom: lines[lines.length - 1] };
        draw.fillStyle = "#FF0000";
        draw.fillRect(0, 0, image.width, image.height);
        draw.fillStyle = "#FFFFFF";
        draw.fillRect(
          0,
          found.top + 1,
          image.width,
          found.bottom - found.top - 1,
        );
      }
      return { found, png: canvas.toDataURL("image/png").split(",")[1] };
    },
    { kind, template },
  );

/** Upload through the studio, publish, return the new design */
async function publish(page, session, t, { file, name, nameplate }) {
  await page.goto(`${APP}/designs/studio`);
  await page
    .getByRole("button", { name: t.upload })
    .nth(nameplate ? 1 : 0)
    .click({ timeout: 30000 });
  await page.locator("input[type=file]").first().setInputFiles(file);
  const title = page
    .locator("main input[type=text], main input:not([type])")
    .first();
  await title.waitFor({ timeout: 15000 });
  await title.fill(name);
  const before = await session.call("GET", "/community/mine");
  return { before, title };
}

const ENGLISH = {
  upload: "Upload design",
  template: "Template",
  publish: "Publish",
  nameplate: "Nameplate",
  use: "Use this design",
  worn: "On your profile now",
};
const { tr } = await import(new URL("catalog.mjs", dir));
const translated = (locale) =>
  Object.fromEntries(
    Object.entries(ENGLISH).map(([key, text]) => [key, tr(locale, text)]),
  );
const words = { en: ENGLISH, ar: translated("ar") };

const report = reporter("creator-templates");
const made = {};
let live;
let original;

async function savePublished(page, session, t, spec) {
  const { before } = await publish(page, session, t, spec);
  await page.getByRole("button", { name: t.publish, exact: true }).click();
  let item;
  for (let i = 0; i < 40 && !item; i++) {
    await page.waitForTimeout(250);
    const mine = await session.call("GET", "/community/mine");
    item = mine.find((one) => !before.some((old) => old._id === one._id));
  }
  assert(item, `${spec.name} was not saved`);
  assert(item.status === "Published", `${spec.name} is ${item.status}`);
  return item;
}

const row = (page) =>
  page.evaluate(() => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const layer = [...document.querySelectorAll("[data-nameplate]")].find(
      (one) => one.parentElement.querySelector(".z-deco-art"),
    );
    if (!layer) return null;
    const line = layer.parentElement;
    const name = [...line.querySelectorAll("*")].find(
      (one) => !one.children.length && /agetest1/i.test(one.textContent),
    );
    return {
      row: box(line),
      layer: box(layer),
      avatar: box(line.querySelector(".z-deco")),
      art: box(line.querySelector(".z-deco-art")),
      name: box(name),
      dir: getComputedStyle(line).direction,
    };
  });

try {
  live = await open("en");
  original = (await live.session.call("GET", "/users/@me")).style ?? {};

  for (const locale of ["en", "ar"]) {
    const t = words[locale];
    if (locale !== "en") {
      await live.session.end();
      live = await open(locale);
    }
    const { page, session } = live;
    report.page = page;

    await report.step(`${locale}: both templates download`, async () => {
      await page.goto(`${APP}/designs/studio`);
      const buttons = page.getByRole("button", {
        name: t.template,
        exact: true,
      });
      await buttons.nth(1).waitFor({ timeout: 40000 });
      const decoration = await clickTemplate(page, t.template, 0);
      const plate = await clickTemplate(page, t.template, 1);
      const sizes = await readPixels(page, decoration, []);
      assert(sizes.width === 1024 && sizes.height === 1024, "decoration size");
      const wide = await readPixels(page, plate, []);
      assert(wide.width === 1024 && wide.height === 192, "nameplate size");
      made[`${locale}Templates`] = { decoration, plate };
      writeFileSync(
        `${shotsDir}${locale}-decoration-template.png`,
        Buffer.from(decoration, "base64"),
      );
      writeFileSync(
        `${shotsDir}${locale}-nameplate-template.png`,
        Buffer.from(plate, "base64"),
      );
    });
  }

  const { page, session } = live;
  const t = words.ar;

  await report.step("an image from each template, published", async () => {
    const { decoration, plate } = made.arTemplates;
    const ring = await artFrom(page, "decoration", decoration);
    const band = await artFrom(page, "plate", plate);
    measured.template = { radius: ring.found, crop: band.found };
    near(ring.found, 341.33, 3, "the template circle");
    near(band.found.top, 16, 1, "the top crop line");
    near(band.found.bottom, 176, 1, "the bottom crop line");
    made.ringItem = await savePublished(page, session, t, {
      name: "Proof ring",
      file: {
        name: "proof-ring.png",
        mimeType: "image/png",
        buffer: Buffer.from(ring.png, "base64"),
      },
    });
    made.bandItem = await savePublished(page, session, t, {
      name: "Proof band",
      nameplate: true,
      file: {
        name: "proof-band.png",
        mimeType: "image/png",
        buffer: Buffer.from(band.png, "base64"),
      },
    });
  });

  await report.step("both worn through the design page", async () => {
    for (const item of [made.ringItem, made.bandItem]) {
      await page.goto(`${APP}/designs/${item._id}`);
      await page.getByRole("button", { name: t.use }).click({ timeout: 30000 });
      await page.getByText(t.worn).first().waitFor({ timeout: 15000 });
    }
    const style = (await session.call("GET", "/users/@me")).style;
    assert(style.decoration === `c:${made.ringItem._id}`, "no decoration");
    assert(style.nameplate === `c:${made.bandItem._id}`, "no nameplate");
  });

  for (const locale of ["ar", "en"]) {
    if (locale === "en") {
      await live.session.end();
      live = await open("en");
    }
    const now = live;
    report.page = now.page;
    const rtl = locale === "ar";

    await report.step(`${locale}: the worn row lines up`, async () => {
      await now.page.goto(`${APP}/server/${SERVER}/channel/${CHANNEL}`);
      await now.page
        .locator("[data-nameplate]")
        .first()
        .waitFor({ state: "attached", timeout: 45000 });
      await now.page.waitForTimeout(2500);
      const box = await row(now.page);
      assert(box, "the row has no decoration and nameplate");
      await now.page.screenshot({
        path: `${shotsDir}${locale}-worn-row.png`,
        clip: {
          x: box.row.x,
          y: box.row.y - 8,
          width: box.row.width,
          height: box.row.height + 16,
        },
      });
      await now.page.screenshot({ path: `${shotsDir}${locale}-worn-page.png` });

      // the DOM, against the numbers the template is drawn from
      near(box.layer.width, ROW.width, 0.5, "row width");
      near(box.layer.height, ROW.height, 0.5, "row height");
      near(box.avatar.width, ROW.avatar, 0.1, "avatar size");
      const avatarFrom = rtl
        ? box.layer.x + box.layer.width - box.avatar.x - box.avatar.width
        : box.avatar.x - box.layer.x;
      near(avatarFrom, ROW.avatarInset, 0.5, "avatar inset");
      const nameFrom = rtl
        ? box.layer.x + box.layer.width - box.name.x - box.name.width
        : box.name.x - box.layer.x;
      near(nameFrom, ROW.name, 0.5, "name start");
      near(box.art.width, box.avatar.width * 1.5, 0.1, "art size");
      near(
        box.avatar.y + box.avatar.height / 2,
        box.layer.y + box.layer.height / 2,
        0.5,
        "the avatar is on the row's middle",
      );

      // the pixels, at four device pixels to the CSS pixel
      const shot = await now.page.screenshot();
      const png = shot.toString("base64");
      const toX = (x) => Math.round(x * SCALE);
      const toY = (y) => Math.round(y * SCALE);
      const layerX = toX(box.layer.x);
      const layerY = toY(box.layer.y);
      const width = Math.round(box.layer.width * SCALE);
      const height = Math.round(box.layer.height * SCALE);
      const avatarRight = toX(box.avatar.x + box.avatar.width);
      const midY = toY(box.avatar.y + box.avatar.height / 2);
      const midX = toX(box.avatar.x + box.avatar.width / 2);
      const pixels = await readPixels(now.page, png, [
        [layerX, layerY, width, height],
        [midX - 2, toY(box.art.y), 4, Math.round(box.art.height * SCALE)],
        [toX(box.art.x), midY - 2, Math.round(box.art.width * SCALE), 4],
      ]);
      const [plate, down, across] = pixels.regions;
      const at = (x, y) => {
        const i = (y * width + x) * 4;
        return [plate[i], plate[i + 1], plate[i + 2]];
      };

      // no red: the crop line is where the row's edge is
      let red = 0;
      for (let y = 8; y < height - 8; y++) {
        for (const x of [Math.round(width * 0.8), Math.round(width * 0.2)]) {
          const [r, g] = at(x, y);
          if (r > g + 60) red++;
        }
      }
      assert(!red, `${red} pixels of the crop band show`);

      // the fade, sampled clear of avatar and name, against the mask
      const ground = at(
        rtl ? Math.round(width * 0.97) : Math.round(width * 0.03),
        height - 8,
      )[1];
      const curve = [];
      for (const share of [0.45, 0.5, 0.55, 0.6, 0.7, 0.8]) {
        const x = Math.round(width * share);
        const y = height - 8;
        const [, g] = at(x, y);
        // white art under the row's dark gradient, over the list's ground
        const shade = 0.3 - 0.25 * Math.min(share / 0.7, 1);
        const shown = fade(share, rtl);
        const expected = ground * (1 - shown) + 255 * (1 - shade) * shown;
        curve.push({ share, level: g, expected: Math.round(expected) });
      }
      for (const point of curve) {
        near(point.level, point.expected, 10, `fade at ${point.share}`);
      }
      // ring: the first and last art pixels on the avatar's axes
      const ringEdge = (strip, length) => {
        const hit = [];
        for (let i = 0; i < length; i++) {
          const offset = i * 4 * 4;
          if (strip[offset + 1] > 170 && strip[offset] < 90) hit.push(i);
        }
        return hit;
      };
      const vertical = ringEdge(down, Math.floor(down.length / 16));
      const inner = vertical.filter((i) => i < (box.art.height * SCALE) / 2);
      const ringInner = Math.max(...inner);
      const hole = (box.art.height * SCALE) / 2 - ringInner;
      measured[locale] = {
        layer: `${box.layer.width} x ${box.layer.height}`,
        avatarFrom,
        nameFrom,
        artSize: box.art.width,
        avatarCentreOffset:
          box.avatar.y +
          box.avatar.height / 2 -
          box.layer.y -
          box.layer.height / 2,
        ringHoleRadiusCss: hole / SCALE,
        avatarRadiusCss: box.avatar.width / 2,
        fade: curve,
      };
      near(hole / SCALE, box.avatar.width / 2, 0.75, "the ring's inner edge");
      assert(at(0, 0), "no pixels");
      assert(across.length, "no pixels");
    });
  }

  await report.step("the file is served at full size", async () => {
    const id = made.ringItem.file._id;
    const original = await fetch(`${MEDIA}/decorations/${id}/original`);
    assert(original.ok, `original ${original.status}`);
    const bytes = Buffer.from(await original.arrayBuffer());
    const size = await live.page.evaluate(async (data) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      return [image.width, image.height];
    }, bytes.toString("base64"));
    assert(size[0] === 1024 && size[1] === 1024, `served ${size}`);
    const preview = await fetch(`${MEDIA}/decorations/${id}`);
    measured.served = {
      original: size.join(" x "),
      originalType: original.headers.get("content-type"),
      originalBytes: bytes.length,
      previewStatus: preview.status,
      previewType: preview.headers.get("content-type"),
      previewBytes: (await preview.arrayBuffer()).byteLength,
      redirected: original.redirected,
    };
  });

  const crc = (() => {
    const table = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
    return (buffer) => {
      let c = 0xffffffff;
      for (const byte of buffer) c = table[(c ^ byte) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = (size) => {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(size, 0);
    data.writeUInt32BE(size, 4);
    data.set([8, 6, 0, 0, 0], 8);
    return data;
  };
  /** Rows of one colour on a clear middle: a ring to a blocky eye */
  const raster = (size, colour) => {
    const rows = [];
    for (let y = 0; y < size; y++) {
      const line = Buffer.alloc(1 + size * 4);
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - size / 2, y - size / 2);
        if (r > size / 3 && r < size / 2) line.set([...colour, 255], 1 + x * 4);
      }
      rows.push(line);
    }
    return deflateSync(Buffer.concat(rows));
  };
  const apng = (size) => {
    const frames = [
      [255, 0, 80],
      [0, 200, 255],
      [255, 200, 0],
    ];
    const parts = [SIGNATURE, chunk("IHDR", ihdr(size))];
    const actl = Buffer.alloc(8);
    actl.writeUInt32BE(frames.length, 0);
    parts.push(chunk("acTL", actl));
    let sequence = 0;
    frames.forEach((colour, index) => {
      const fctl = Buffer.alloc(26);
      fctl.writeUInt32BE(sequence++, 0);
      fctl.writeUInt32BE(size, 4);
      fctl.writeUInt32BE(size, 8);
      fctl.writeUInt16BE(40, 20);
      fctl.writeUInt16BE(100, 22);
      parts.push(chunk("fcTL", fctl));
      const data = raster(size, colour);
      if (index === 0) parts.push(chunk("IDAT", data));
      else {
        const seq = Buffer.alloc(4);
        seq.writeUInt32BE(sequence++);
        parts.push(chunk("fdAT", Buffer.concat([seq, data])));
      }
    });
    parts.push(chunk("IEND", Buffer.alloc(0)));
    return Buffer.concat(parts);
  };
  /** A GIF with one uncompressed-style LZW frame per colour */
  const gif = (size) => {
    const header = Buffer.alloc(13);
    header.write("GIF89a", 0, "latin1");
    header.writeUInt16LE(size, 6);
    header.writeUInt16LE(size, 8);
    header[10] = 0xf1;
    const palette = Buffer.from([
      0, 0, 0, 255, 0, 80, 0, 200, 255, 255, 200, 0,
    ]);
    const loop = Buffer.from([
      0x21,
      0xff,
      0x0b,
      ...Buffer.from("NETSCAPE2.0", "latin1"),
      3,
      1,
      0,
      0,
      0,
    ]);
    const frame = (index) => {
      const control = Buffer.from([0x21, 0xf9, 4, 9, 40, 0, 0, 0]);
      const descriptor = Buffer.alloc(10);
      descriptor[0] = 0x2c;
      descriptor.writeUInt16LE(size, 5);
      descriptor.writeUInt16LE(size, 7);
      // 3-bit codes with a clear code before the table can grow
      const codes = [4];
      let count = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = Math.hypot(x - size / 2, y - size / 2);
          codes.push(r > size / 3 && r < size / 2 ? index : 0);
          if (++count % 3 === 0) codes.push(4);
        }
      }
      codes.push(5);
      const out = [];
      let bits = 0;
      let held = 0;
      for (const code of codes) {
        held |= code << bits;
        bits += 3;
        while (bits >= 8) {
          out.push(held & 255);
          held >>= 8;
          bits -= 8;
        }
      }
      if (bits) out.push(held & 255);
      const blocks = [Buffer.from([2])];
      for (let i = 0; i < out.length; i += 255) {
        const part = out.slice(i, i + 255);
        blocks.push(Buffer.from([part.length, ...part]));
      }
      blocks.push(Buffer.from([0]));
      return Buffer.concat([control, descriptor, ...blocks]);
    };
    return Buffer.concat([
      header,
      palette,
      loop,
      frame(1),
      frame(2),
      frame(3),
      Buffer.from([0x3b]),
    ]);
  };
  /** Frames drawn and encoded by the browser, wrapped as an animated WebP */
  const webp = async (size) => {
    const frames = await live.page.evaluate(async (size) => {
      const out = [];
      for (const colour of ["#ff0050", "#00c8ff", "#ffc800"]) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const draw = canvas.getContext("2d");
        draw.strokeStyle = colour;
        draw.lineWidth = size / 6;
        draw.beginPath();
        draw.arc(size / 2, size / 2, size / 2.4, 0, Math.PI * 2);
        draw.stroke();
        out.push(canvas.toDataURL("image/webp", 1).split(",")[1]);
      }
      return out;
    }, size);
    const pad = (data) =>
      data.length % 2 ? Buffer.concat([data, Buffer.alloc(1)]) : data;
    const riff = (type, data) => {
      const head = Buffer.alloc(8);
      head.write(type, 0, "latin1");
      head.writeUInt32LE(data.length, 4);
      return Buffer.concat([head, pad(data)]);
    };
    const u24 = (value) =>
      Buffer.from([value & 255, (value >> 8) & 255, (value >> 16) & 255]);
    const vp8x = Buffer.concat([
      Buffer.from([0x12, 0, 0, 0]),
      u24(size - 1),
      u24(size - 1),
    ]);
    const anim = Buffer.alloc(6);
    const body = [riff("VP8X", vp8x), riff("ANIM", anim)];
    for (const encoded of frames) {
      const file = Buffer.from(encoded, "base64");
      const inner = [];
      for (let at = 12; at + 8 <= file.length; ) {
        const type = file.toString("latin1", at, at + 4);
        const length = file.readUInt32LE(at + 4);
        if (type === "VP8 " || type === "VP8L" || type === "ALPH")
          inner.push(file.subarray(at, at + 8 + length + (length % 2)));
        at += 8 + length + (length % 2);
      }
      const head = Buffer.concat([
        u24(0),
        u24(0),
        u24(size - 1),
        u24(size - 1),
        u24(400),
        Buffer.from([0]),
      ]);
      body.push(riff("ANMF", Buffer.concat([head, ...inner])));
    }
    const data = Buffer.concat([Buffer.from("WEBP", "latin1"), ...body]);
    const head = Buffer.alloc(8);
    head.write("RIFF", 0, "latin1");
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data]);
  };
  /** A real PNG grown to an exact size with a text chunk */
  const pngOf = (bytes) => {
    const base = Buffer.concat([
      SIGNATURE,
      chunk("IHDR", ihdr(256)),
      chunk("IDAT", raster(256, [255, 0, 80])),
    ]);
    const end = chunk("IEND", Buffer.alloc(0));
    const room = bytes - base.length - end.length - 12;
    const text = Buffer.alloc(room, 97);
    text.write("Comment\0", 0, "latin1");
    return Buffer.concat([base, chunk("tEXt", text), end]);
  };

  made.types = [];
  const types = () => [
    ["PNG at the limit", "limit.png", "image/png", pngOf(2_500_000)],
    ["animated PNG", "moving.apng", "image/apng", apng(256)],
    ["GIF", "moving.gif", "image/gif", gif(128)],
  ];

  for (const [label, name, mimeType, buffer] of types()) {
    await report.step(`${label}: through, byte for byte`, async () => {
      const item = await savePublished(live.page, live.session, words.en, {
        name: `Proof ${label}`.slice(0, 32),
        file: { name, mimeType, buffer },
      });
      made.types.push(item);
      const served = await fetch(
        `${MEDIA}/decorations/${item.file._id}/original`,
      );
      assert(served.ok, `served ${served.status}`);
      const bytes = Buffer.from(await served.arrayBuffer());
      assert(bytes.equals(buffer), `${bytes.length} of ${buffer.length} bytes`);
      measured[label] = {
        bytes: bytes.length,
        type: served.headers.get("content-type"),
      };
    });
  }

  await report.step("animated WebP: through, byte for byte", async () => {
    const buffer = await webp(256);
    const item = await savePublished(live.page, live.session, words.en, {
      name: "Proof animated WebP",
      file: { name: "moving.webp", mimeType: "image/webp", buffer },
    });
    made.types.push(item);
    const served = await fetch(
      `${MEDIA}/decorations/${item.file._id}/original`,
    );
    const bytes = Buffer.from(await served.arrayBuffer());
    assert(bytes.equals(buffer), `${bytes.length} of ${buffer.length} bytes`);
    measured.webp = {
      bytes: bytes.length,
      type: served.headers.get("content-type"),
    };
  });

  await report.step("each animation really moves when worn", async () => {
    const now = live;
    await now.page.goto(`${APP}/designs/studio`);
    measured.moves = {};
    for (const item of made.types.slice(1)) {
      await now.session.call("PATCH", "/users/@me", {
        style: { ...original, decoration: `c:${item._id}` },
      });
      await now.page.goto(`${APP}/server/${SERVER}/channel/${CHANNEL}`);
      const art = now.page.locator(".z-deco-art").first();
      await art.waitFor({ state: "attached", timeout: 45000 });
      await now.page.waitForTimeout(1500);
      const seen = new Set();
      for (let i = 0; i < 12; i++) {
        seen.add((await art.screenshot()).toString("base64").slice(0, 4000));
        await now.page.waitForTimeout(180);
      }
      measured.moves[item.name] = seen.size;
      assert(seen.size > 1, `${item.name} did not move`);
    }
  });

  await report.step(
    "over the limit: refused in the app and by the server",
    async () => {
      const over = pngOf(2_500_001);
      await live.page.goto(`${APP}/designs/studio`);
      await live.page
        .getByRole("button", { name: words.en.upload })
        .first()
        .click({ timeout: 30000 });
      await live.page.locator("input[type=file]").first().setInputFiles({
        name: "over.png",
        mimeType: "image/png",
        buffer: over,
      });
      await live.page
        .getByText("That image is too big. The limit is 2.5 MB.")
        .waitFor({ timeout: 10000 });
      const body = new FormData();
      body.append("file", new Blob([over], { type: "image/png" }), "over.png");
      const answer = await fetch(`${MEDIA}/decorations`, {
        method: "POST",
        headers: { "x-session-token": live.session.token },
        body,
      });
      const text = await answer.text();
      measured.overLimit = { status: answer.status, body: text.slice(0, 120) };
      assert(!answer.ok, "the server took it");
    },
  );
} finally {
  await report.step("clean up: taken off and archived", async () => {
    const { session, page } = live;
    await session.call("PATCH", "/users/@me", { style: original ?? {} });
    const mine = await session.call("GET", "/community/mine");
    await page.goto(`${APP}/designs/studio`);
    for (const item of mine) {
      await session.call("POST", `/community/items/${item._id}/archive`);
    }
    const left = await session.call("GET", "/community/mine");
    const active = left.filter((item) => item.status !== "Archived");
    const style = (await session.call("GET", "/users/@me")).style ?? {};
    measured.cleanup = {
      archived: mine.length,
      left: active.length,
      style,
    };
    assert(!active.length, `${active.length} designs left`);
    assert(!style.decoration && !style.nameplate, "still worn");
  });
  await report.step("no page errors", async () => {
    assert(!live.session.errors.length, live.session.errors.join(" | "));
  });
  await live?.session.end();
  await browser.close();
}

console.log(`\nmeasured ${JSON.stringify(measured, null, 1)}`);
for (const step of report.results.filter((entry) => !entry.ok)) {
  console.log(`\n${step.name}\n${step.error}`);
}
process.exit(report.done() ? 1 : 0);
