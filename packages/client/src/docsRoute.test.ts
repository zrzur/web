import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The developer docs must open without the chat client: no wait for the
 * gateway and no "connecting" screen, signed in or not (docs gap 1). So the
 * docs route sits next to the app's `Interface` route, never inside it, and
 * its page does not import the Interface.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(here, file), "utf8");

describe("developer docs route", () => {
  const index = read("index.tsx");
  const appRoutes = index.slice(
    index.indexOf("const appRoutes"),
    index.indexOf("const routes ="),
  );

  it("is matched before, and outside, the app interface", () => {
    const docs = appRoutes.indexOf('path="/developers/docs/*"');
    const app = appRoutes.indexOf("component={Interface}");
    expect(docs).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(-1);
    expect(docs).toBeLessThan(app);
    // a sibling: the docs route closes before the Interface route opens
    expect(appRoutes.slice(docs, app)).toMatch(
      /^path="\/developers\/docs\/\*" component=\{DevelopersDocs\} \/>\s*<Route path="\/" $/,
    );
  });

  it("loads the docs page lazily, in its own chunk", () => {
    expect(index).toMatch(
      /const DevelopersDocs = lazy\(\(\) =>\s*import\("\.\/interface\/DevelopersDocs"\)/,
    );
  });

  it("does not wait for the client in the docs page", () => {
    const page = read("interface/DevelopersDocs.tsx");
    expect(page).not.toMatch(/useClientLifecycle|loadedOnce|from "\.\.\/Interface"/);
  });
});
