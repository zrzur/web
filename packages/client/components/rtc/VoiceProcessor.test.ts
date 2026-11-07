import { describe, expect, it, vi } from "vitest";

vi.mock("livekit-rnnoise-processor", () => ({
  RNNoiseNode: class {
    static loadModule = async () => undefined;
    kind = "rnnoise";
    links = new Set<unknown>();
    connect(node: unknown) {
      this.links.add(node);
    }
    disconnect() {
      this.links.clear();
    }
  },
}));
vi.mock("@revolt/common", () => ({
  CONFIGURATION: { RNNOISE_WORKLET_CDN_URL: "" },
}));

import { VoiceProcessor } from "./VoiceProcessor";

/** Audio nodes that remember what they are wired to */
function node(kind: string) {
  return {
    kind,
    links: new Set<{ kind: string }>(),
    gain: { value: 1 },
    frequency: { value: 0 },
    Q: { value: 0 },
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    type: "",
    stream: { getAudioTracks: () => [{ kind: "audio" }] },
    connect(other: { kind: string }) {
      this.links.add(other);
    },
    disconnect() {
      this.links.clear();
    },
  };
}

function setup(noiseSupression: "disabled" | "browser" | "enhanced") {
  const made: ReturnType<typeof node>[] = [];
  const make = (kind: string) => {
    const n = node(kind);
    made.push(n);
    return n;
  };
  const context = {
    createMediaStreamSource: () => make("source"),
    createGain: () => make("gain"),
    createBiquadFilter: () => make("highpass"),
    createDynamicsCompressor: () => make("compressor"),
    createMediaStreamDestination: () => make("destination"),
  };
  globalThis.MediaStream ??= class {
    constructor(public tracks: unknown[]) {}
  } as unknown as typeof MediaStream;
  const settings = { inputVolume: 1, noiseSupression };
  const processor = new VoiceProcessor(
    settings as unknown as ConstructorParameters<typeof VoiceProcessor>[0],
  );
  const source = () => made.filter((n) => n.kind === "source").at(-1)!;
  return { processor, settings, context, source };
}

const targets = (n: { links: Set<{ kind: string }> }) =>
  [...n.links].map((l) => l.kind).sort();

describe("VoiceProcessor wiring", () => {
  it("without Enhanced the microphone goes straight to the volume", async () => {
    const { processor, context, source } = setup("browser");
    await processor.restart({ track: {}, audioContext: context } as unknown as Parameters<
        typeof processor.restart
      >[0]);
    expect(targets(source())).toEqual(["gain"]);
  });

  it("switching to Enhanced mid-call routes only through the filter (no raw microphone)", async () => {
    const { processor, settings, context, source } = setup("browser");
    await processor.restart({ track: {}, audioContext: context } as unknown as Parameters<
        typeof processor.restart
      >[0]);
    settings.noiseSupression = "enhanced";
    (processor as unknown as { rebuild(): void }).rebuild();
    expect(targets(source())).toEqual(["highpass"]);
  });

  it("switching back from Enhanced goes straight to the volume again", async () => {
    const { processor, settings, context, source } = setup("enhanced");
    await processor.restart({ track: {}, audioContext: context } as unknown as Parameters<
        typeof processor.restart
      >[0]);
    expect(targets(source())).toEqual(["highpass"]);
    settings.noiseSupression = "disabled";
    (processor as unknown as { rebuild(): void }).rebuild();
    expect(targets(source())).toEqual(["gain"]);
  });

  it("a settings change after the call ended does nothing", async () => {
    const { processor, settings } = setup("browser");
    await processor.destroy();
    settings.noiseSupression = "enhanced";
    expect(() =>
      (processor as unknown as { rebuild(): void }).rebuild(),
    ).not.toThrow();
  });
});
