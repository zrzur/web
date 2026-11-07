import type { MessageEmbed } from "@zrzur/sdk/solid";
import { describe, expect, it } from "vitest";
import { isGif, isGifBox, isOnlyGifLink, isOnlyMediaLink } from "./gifs";
const website = (url: string, special = false) =>
  ({
    type: "Website",
    originalUrl: url,
    specialContent: special ? { type: "GIF" } : undefined,
    video: { url: "https://media2.giphy.com/media/Ab12/giphy.mp4" },
  }) as MessageEmbed;
const url = "https://giphy.com/gifs/cristiano-qu-pasiones-Ud69AbDhjgJeo";
describe("Known GIF link rendering", () => {
  it.each([
    url,
    "https://www.giphy.com/gifs/test-Ab12",
    "https://giphy.com/embed/Ab12",
    "https://tenor.com/view/happy-cat-gif-123",
    "https://gifbox.me/view/old-gif",
  ])("recognizes GIF page %s", (value) =>
    expect(isGif(website(value))).toBe(true),
  );
  it.each([
    "invalid",
    "javascript:alert(1)",
    "http://giphy.com/gifs/id",
    "https://giphy.com.evil.test/gifs/id",
    "https://evil.test/giphy.com/gifs/id",
    "https://giphy.com@evil.test/gifs/id",
    "https://user:password@giphy.com/gifs/id",
    "https://giphy.com/",
    "https://giphy.com/search/cats",
    "https://example.test/gif",
    "https://tenor.com/",
  ])("rejects unsupported URL even with GIF metadata: %s", (value) =>
    expect(isGif(website(value, true))).toBe(false),
  );
  it.each([
    "https://media2.giphy.com/media/Ab12/giphy.mp4",
    "https://i.giphy.com/Ab12.gif",
    "https://media.tenor.com/Ab12/tenor.webm",
  ])("recognizes direct provider media %s", (value) =>
    expect(isGif({ type: "Video", url: value } as MessageEmbed)).toBe(true),
  );
  it("does not classify arbitrary direct media as a provider GIF", () =>
    expect(
      isGif({
        type: "Image",
        url: "https://example.test/a.gif",
      } as MessageEmbed),
    ).toBe(false));
  it("hides only a single standalone GIF link, including surrounding whitespace", () => {
    expect(isOnlyGifLink(" \n" + url + "\n ", [website(url)])).toBe(true);
    expect(isOnlyGifLink("Look at this " + url, [website(url)])).toBe(false);
    expect(isOnlyGifLink(url + " https://example.test", [website(url)])).toBe(
      false,
    );
    expect(isOnlyGifLink(url, [])).toBe(false);
    expect(isOnlyGifLink(url, [website(url), website(url)])).toBe(false);
  });
  it("keeps malformed historical links from crashing rendering", () => {
    expect(isGifBox(website("broken"))).toBe(false);
    expect(isGifBox(website("https://gifbox.me/view/old"))).toBe(true);
  });
});

const media = (type: "Image" | "Video", url: string) =>
  ({ type, url, width: 200, height: 150 }) as unknown as MessageEmbed;
describe("Standalone media links", () => {
  const gif = "https://static.klipy.com/ii/abc/88/d8/i6sYb0EZ.gif";
  it("treats KLIPY media as GIFs", () => {
    expect(isGif(media("Image", gif))).toBe(true);
    expect(isGif(website("https://klipy.com/gifs/hello-123"))).toBe(true);
    expect(
      isGif(media("Image", "https://static.klipy.com.evil.test/a.gif")),
    ).toBe(false);
  });
  it("hides the text of a message that is only one image or video link", () => {
    expect(isOnlyMediaLink(gif, [media("Image", gif)])).toBe(true);
    expect(isOnlyMediaLink(" " + gif + "\n", [media("Image", gif)])).toBe(true);
    const video = "https://example.test/clip.mp4";
    expect(isOnlyMediaLink(video, [media("Video", video)])).toBe(true);
  });
  it("keeps the text when there is anything else", () => {
    expect(isOnlyMediaLink("look " + gif, [media("Image", gif)])).toBe(false);
    expect(
      isOnlyMediaLink(gif, [media("Image", gif), media("Image", gif)]),
    ).toBe(false);
    expect(isOnlyMediaLink(gif, [website(gif)])).toBe(false);
    expect(isOnlyMediaLink(gif, [])).toBe(false);
    // the embed must match the text exactly, and only safe https links count
    expect(
      isOnlyMediaLink(gif, [media("Image", "https://other.test/x.gif")]),
    ).toBe(false);
    const http = "http://example.test/a.png";
    expect(isOnlyMediaLink(http, [media("Image", http)])).toBe(false);
    const creds = "https://user:pw@example.test/a.png";
    expect(isOnlyMediaLink(creds, [media("Image", creds)])).toBe(false);
  });
});
