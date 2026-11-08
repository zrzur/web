import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { builtInSlugs, isBuiltIn } from "./catalogue.mjs";
import {
  LANGUAGES,
  TOPICS,
  humanize,
  injectHead,
  pageMeta,
  roughCount,
  routeOf,
} from "./head.mjs";
import { designSvg, renderPng, serverSvg, siteSvg } from "./og.mjs";

/**
 * The public sites discover.zrzur.com and designs.zrzur.com: the web app's
 * build, with each page's own head (title, description, canonical, ar /
 * en / de links, preview image) filled in on the server, so search
 * engines and link previews (WhatsApp, X, Telegram) see the page without
 * running JavaScript. Also /sitemap.xml, /robots.txt and the preview
 * images under /og/.
 *
 * SITE           discover | designs
 * PUBLIC_ORIGIN  https://discover.zrzur.com
 * API_URL        https://api.zrzur.com
 * MEDIA_URL      https://cdn.zrzur.com (icons, banners, design art)
 * DIST           the web app build (default ../client/dist)
 * PORT           default 8080
 * INTERNAL_TOKEN shared secret sent to the API as X-Zrzur-Internal, so this
 *                server renders from its own rate-limit bucket (the API
 *                reads it from ZRZUR_INTERNAL_TOKEN). Optional.
 * PUBLIC_API_URL / PUBLIC_MEDIA_URL  the same two as the visitor's browser
 *                reaches them (for the page policy), when API_URL / MEDIA_URL
 *                are internal addresses
 * CONNECT_EXTRA  more origins the page may connect to (space separated)
 */

const env = process.env;
const SITE = env.SITE === "designs" ? "designs" : "discover";
const ORIGIN = (env.PUBLIC_ORIGIN ?? `https://${SITE}.zrzur.com`).replace(
  /\/+$/,
  "",
);
const API = (env.API_URL ?? "https://api.zrzur.com").replace(/\/+$/, "");
const MEDIA = (env.MEDIA_URL ?? "https://cdn.zrzur.com").replace(/\/+$/, "");
const DIST = resolve(
  env.DIST ?? fileURLToPath(new URL("../../client/dist", import.meta.url)),
);
const PORT = Number(env.PORT ?? 8080);

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

/**
 * The page policy (S-02). Scripts only from this site (the JSON-LD block is
 * data, not script); styles allow inline because the UI sets style
 * attributes; images from this site, the media origin, the link proxy and
 * data:/blob:; connections to the API, its events socket and the media
 * origin. No plugins, no framing, forms only to ourselves.
 */
export function contentSecurityPolicy() {
  // what the visitor's browser reaches; API_URL / MEDIA_URL may be internal
  const publicApi = (env.PUBLIC_API_URL ?? env.API_URL ?? "https://api.zrzur.com").replace(/\/+$/, "");
  const publicMedia = (env.PUBLIC_MEDIA_URL ?? env.MEDIA_URL ?? "https://cdn.zrzur.com").replace(/\/+$/, "");
  const api = new URL(publicApi);
  const events = `${api.protocol === "https:" ? "wss" : "ws"}://${api.host.replace(/^api\./, "ws.")}`;
  const extra = (env.CONNECT_EXTRA ?? "").split(/\s+/).filter(Boolean);
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${publicMedia} ${api.origin}`,
    `media-src 'self' blob: ${publicMedia}`,
    "font-src 'self' data:",
    `connect-src 'self' ${[api.origin, events, publicMedia, ...extra].join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": contentSecurityPolicy(),
  "Permissions-Policy": "interest-cohort=()",
};

/**
 * A small cache: API answers and images live a few minutes. Many requests
 * for the same missing key share one running call (no stampede on the API
 * or the image renderer); a failed call is not remembered.
 */
const cache = new Map();
const running = new Map();
async function cached(key, ttl, make) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (running.has(key)) return running.get(key);
  const work = (async () => {
    try {
      const value = await make();
      if (cache.size > 2000) cache.delete(cache.keys().next().value);
      cache.set(key, { value, until: Date.now() + ttl });
      return value;
    } finally {
      running.delete(key);
    }
  })();
  running.set(key, work);
  return work;
}

async function api(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/json",
      ...(env.ZRZUR_INTERNAL_TOKEN
        ? { "x-zrzur-internal": env.ZRZUR_INTERNAL_TOKEN } : {}),
    },
    signal: AbortSignal.timeout(4000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return response.json();
}

const fileUrl = (file) =>
  file ? `${MEDIA}/${file.tag}/${file._id}` : undefined;

/** An image as a data: URL, only PNG and JPEG (what the renderer reads) */
async function dataUrl(url) {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    // only the bare type goes into the data URL, never parameters
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!response.ok || !/^image\/(png|jpe?g)$/.test(type)) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 4_000_000) return undefined;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** What a page shows, from the API or the built-in list */
async function pageData(route) {
  if (route.kind === "server")
    return cached(`server:${route.slug.toLowerCase()}`, 120_000, () =>
      api(`/discover/servers/${encodeURIComponent(route.slug)}`),
    );
  if (route.kind === "design") {
    const { kind, id } = route.ref;
    if (kind !== "community")
      return isBuiltIn(kind, id) ? { kind, name: humanize(id) } : null;
    const details = await cached(`design:${id}`, 300_000, () =>
      api(`/community/items/${id}`),
    );
    return details
      ? {
          kind: details.item.kind === "Decoration" ? "decoration" : "nameplate",
          name: details.item.name,
          description: details.item.description,
          file: details.item.file,
        }
      : null;
  }
  return undefined;
}

let indexHtml;
const index = () =>
  (indexHtml ??= readFileSync(join(DIST, "index.html"), "utf8"));

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { "Content-Type": type, ...SECURITY, ...headers });
  res.end(body);
}

const OG_TEXT = {
  discover: {
    title: "اكتشف زرزور · Zrzur Discover",
    line: "Find your community — اعثر على مجتمعك",
  },
  designs: {
    title: "تصاميم زرزور · Zrzur Designs",
    line: "Style your profile — زيّن ملفك",
  },
};

/** "≈ 120 members · ≈ 40 online", in the server's own language */
export function countsLine(card) {
  const members = roughCount(card.member_count ?? 0);
  const online =
    card.online_count == null ? undefined : roughCount(card.online_count);
  const words = {
    ar: [`≈ ${members} عضو`, online && `≈ ${online} متصل`],
    de: [`≈ ${members} Mitglieder`, online && `≈ ${online} online`],
    en: [`≈ ${members} members`, online && `≈ ${online} online`],
  }[card.language] ?? [`≈ ${members} members`, online && `≈ ${online} online`];
  return words.filter(Boolean).join(" · ");
}

async function ogImage(path) {
  const [, , kind, file] = path.split("/");
  const slug = decodeURIComponent((file ?? "").replace(/\.png$/, ""));
  if (kind === "site.png")
    return cached(`og:site:${SITE}`, 86_400_000, () =>
      renderPng(siteSvg(OG_TEXT[SITE])),
    );
  if (kind === "server" && SITE === "discover") {
    const card = await pageData({ kind: "server", slug });
    if (!card) return null;
    return cached(
      `og:server:${card._id}:${card.name}:${card.icon?._id}:${card.banner?._id}`,
      600_000,
      async () =>
        renderPng(
          serverSvg(
            card,
            {
              counts: countsLine(card),
              brand: "Zrzur",
            },
            {
              icon: await dataUrl(fileUrl(card.icon)),
              banner: await dataUrl(fileUrl(card.banner)),
            },
          ),
        ),
    );
  }
  if (kind === "design" && SITE === "designs") {
    const route = routeOf("designs", `/${slug}`);
    if (route.kind !== "design") return null;
    const design = await pageData(route);
    if (!design) return null;
    return cached(`og:design:${slug}`, 600_000, async () =>
      renderPng(
        designSvg(
          { name: design.name, kindLabel: humanize(design.kind) },
          { brand: "Zrzur Designs" },
          { art: await dataUrl(fileUrl(design.file)) },
        ),
      ),
    );
  }
  return null;
}

async function sitemap() {
  const urls = ["/"];
  if (SITE === "discover") {
    urls.push(...Object.keys(TOPICS).map((t) => `/${t}`));
    urls.push(...LANGUAGES.map((l) => `/${l}`));
    for (let offset = 0; offset < 2000; offset += 100) {
      const page =
        (await api(`/discover/servers?limit=100&offset=${offset}`).catch(
          () => null,
        )) ?? [];
      urls.push(
        ...page.map((card) => `/${encodeURIComponent(card.link ?? card._id)}`),
      );
      if (page.length < 100) break;
    }
  } else {
    urls.push(...builtInSlugs().map((slug) => `/${slug}`));
    for (const kind of ["decorations", "nameplates"]) {
      const page = await api(`/community/${kind}?limit=100&sort=popular`).catch(
        () => null,
      );
      urls.push(...(page?.items ?? []).map((item) => `/${item._id}`));
    }
  }
  const entry = (path) => {
    const loc = `${ORIGIN}${path}`;
    const links = [...LANGUAGES, "x-default"]
      .map(
        (hl) =>
          `<xhtml:link rel="alternate" hreflang="${hl}" href="${hl === "x-default" ? loc : `${loc}?hl=${hl}`}"/>`,
      )
      .join("");
    return `<url><loc>${loc}</loc>${links}</url>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map(entry).join("\n")}\n</urlset>\n`;
}

/** A file from the build, never outside it */
export function staticFile(path) {
  // an encoded slash or backslash never names a real build file
  if (/%(2f|5c)/i.test(path)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.includes("\u0000") || decoded.includes("\\")) return null;
  const file = normalize(join(DIST, decoded));
  if (
    !file.startsWith(DIST + sep) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  )
    return null;
  return file;
}

export async function handle(req, res) {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;
  try {
    if (path === "/robots.txt")
      return send(
        res,
        200,
        TYPES[".txt"],
        `User-agent: *\nAllow: /\nDisallow: /login\nSitemap: ${ORIGIN}/sitemap.xml\n`,
      );
    if (path === "/sitemap.xml")
      return send(
        res,
        200,
        TYPES[".xml"],
        await cached(`sitemap:${SITE}`, 3_600_000, sitemap),
        {
          "Cache-Control": "public, max-age=3600",
        },
      );
    if (path.startsWith("/og/")) {
      const png = await ogImage(path);
      return png
        ? send(res, 200, "image/png", png, {
            "Cache-Control": "public, max-age=600",
          })
        : send(res, 404, TYPES[".txt"], "Not found");
    }
    if (extname(path)) {
      const file = staticFile(path);
      if (file)
        return send(
          res,
          200,
          TYPES[extname(file)] ?? "application/octet-stream",
          readFileSync(file),
          {
            // files Vite emitted live in assets/<release>/ (docker/inject.js),
            // whose name changes with every build or URL change
            "Cache-Control": /^\/assets\/[0-9a-f]{12}\//.test(path)
              ? "public, max-age=31536000, immutable"
              : path.startsWith("/assets/")
                ? "public, max-age=604800"
                : "public, max-age=3600",
          },
        );
    }

    const route = routeOf(SITE, path);
    const data = await pageData(route).catch(() => undefined);
    const meta = pageMeta({
      site: SITE,
      origin: ORIGIN,
      path,
      lang: url.searchParams.get("hl") ?? undefined,
      route,
      data,
    });
    // an API hiccup is not a missing page: serve it, the app retries
    const status =
      data === undefined && meta.status === 404 && route.kind !== "other"
        ? 200
        : meta.status;
    return send(res, status, TYPES[".html"], injectHead(index(), meta), {
      "Cache-Control": "public, max-age=60",
      "Content-Language": meta.lang,
    });
  } catch (error) {
    console.error(error);
    return send(res, 500, TYPES[".txt"], "Something went wrong");
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  createServer((req, res) => void handle(req, res)).listen(PORT, () =>
    console.log(`${SITE} pages on :${PORT} (${ORIGIN}, API ${API})`),
  );
}
