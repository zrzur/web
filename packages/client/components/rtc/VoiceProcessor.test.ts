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

function setup(
  noiseSupression: "disabled" | "browser" | "enhanced",
  extra: Record<string, unknown> = {},
) {
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
    ...extra,
  };
  globalThis.MediaStream ??= class {
    constructor(public tracks: unknown[]) {}
  } as unknown as typeof MediaStream;
  const settings = {
    inputVolume: 1,
    noiseSupression,
    inputMode: "voice",
    inputSensitivityAuto: false,
    inputThreshold: -42,
  };
  const processor = new VoiceProcessor(
    settings as unknown as ConstructorParameters<typeof VoiceProcessor>[0],
  );
  const source = () => made.filter((n) => n.kind === "source").at(-1)!;
  const find = (kind: string) => made.filter((n) => n.kind === kind).at(-1)!;
  return { processor, settings, context, source, find, made };
}

const targets = (n: { links: Set<{ kind: string }> }) =>
  [...n.links].map((l) => l.kind).sort();

describe("VoiceProcessor wiring", () => {
  it("without Enhanced the microphone goes straight to the volume", async () => {
    const { processor, context, source } = setup("browser");
    await processor.restart({
      track: {},
      audioContext: context,
    } as unknown as Parameters<typeof processor.restart>[0]);
    expect(targets(source())).toEqual(["gain"]);
  });

  it("switching to Enhanced mid-call routes only through the filter (no raw microphone)", async () => {
    const { processor, settings, context, source } = setup("browser");
    await processor.restart({
      track: {},
      audioContext: context,
    } as unknown as Parameters<typeof processor.restart>[0]);
    settings.noiseSupression = "enhanced";
    (processor as unknown as { rebuild(): void }).rebuild();
    expect(targets(source())).toEqual(["highpass"]);
  });

  it("switching back from Enhanced goes straight to the volume again", async () => {
    const { processor, settings, context, source } = setup("enhanced");
    await processor.restart({
      track: {},
      audioContext: context,
    } as unknown as Parameters<typeof processor.restart>[0]);
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

describe("VoiceProcessor input sensitivity gate", () => {
  /** AudioWorkletNode stand-in that records what the page tells it */
  class FakeWorkletNode {
    kind = "gate";
    links = new Set<{ kind: string }>();
    sent: unknown[] = [];
    onprocessorerror: (() => void) | null = null;
    port = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: (message: unknown) => this.sent.push(message),
    };
    constructor(
      public context: unknown,
      public name: string,
    ) {
      gates.push(this);
    }
    connect(other: { kind: string }) {
      this.links.add(other);
    }
    disconnect() {
      this.links.clear();
    }
  }
  const gates: FakeWorkletNode[] = [];
  const addModule = vi.fn(async () => undefined);

  async function start(extra: Record<string, unknown>, mode = "voice") {
    globalThis.AudioWorkletNode = FakeWorkletNode as never;
    const made = setup("browser", extra);
    made.settings.inputMode = mode;
    await made.processor.init({
      track: {},
      audioContext: made.context,
    } as unknown as Parameters<typeof made.processor.init>[0]);
    return made;
  }

  it("sends the microphone through the gate when the browser has audio worklets", async () => {
    const { find } = await start({ audioWorklet: { addModule } });
    expect(addModule).toHaveBeenCalledOnce();
    // same origin, never a blob: (a script-src 'self' policy allows it)
    expect(addModule).toHaveBeenCalledWith(
      expect.stringMatching(/^\/voice-gate-worklet\.js\?v=/),
    );
    const gate = gates.at(-1)!;
    expect(gate.name).toBe("zrzur-voice-gate");
    expect(targets(find("gain"))).toEqual(["gate"]);
    expect(targets(gate)).toEqual(["destination"]);
  });

  it("tells the gate the saved sensitivity, and keeps it open in push to talk", async () => {
    await start({ audioWorklet: { addModule } });
    expect(gates.at(-1)!.sent.at(-1)).toEqual({
      enabled: true,
      auto: false,
      thresholdDb: -42,
      holdMs: 300,
    });
    await start({ audioWorklet: { addModule } }, "ptt");
    expect(gates.at(-1)!.sent.at(-1)).toMatchObject({ enabled: false });
  });

  it("a gate that fails while running is bypassed, so the call keeps sound", async () => {
    const { find } = await start({ audioWorklet: { addModule } });
    const gate = gates.at(-1)!;
    gate.onprocessorerror!();
    expect(targets(find("gain"))).toEqual(["destination"]);
    expect(targets(gate)).toEqual([]);
  });

  it("without audio worklets the microphone still reaches the call", async () => {
    const { find } = await start({});
    expect(targets(find("gain"))).toEqual(["destination"]);
  });

  it("a worklet that fails to load leaves the microphone ungated, not silent", async () => {
    const failing = vi.fn(async () => {
      throw new Error("blocked");
    });
    const { find } = await start({ audioWorklet: { addModule: failing } });
    expect(targets(find("gain"))).toEqual(["destination"]);
  });
});

describe("VoiceProcessor high quality audio (music)", () => {
  it("skips RNNoise even when Enhanced is chosen", async () => {
    const { processor, settings, context, source } = setup("enhanced");
    (settings as Record<string, unknown>).highQualityAudio = true;
    await processor.restart({
      track: {},
      audioContext: context,
    } as unknown as Parameters<typeof processor.restart>[0]);
    expect(targets(source())).toEqual(["gain"]);
  });
});
