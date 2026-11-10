import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createRoot,
  createSignal,
  JSX,
  lazy,
  on,
  onCleanup,
  Setter,
  untrack,
  useContext,
} from "solid-js";
import type { TrackReferenceOrPlaceholder } from "solid-livekit-components";

import { useLocation, useNavigate } from "@solidjs/router";
import { Channel } from "@zrzur/sdk/solid";
import type { LocalTrackPublication, Room } from "livekit-client";

import { SoundController, useClient, useSound } from "@revolt/client";
import {
  activePlusLimits,
  levelPerks,
  voiceBitrateFor,
} from "@revolt/client/billing";
import { assertAllowedServiceUrl } from "@revolt/common/lib/env";
import { useInstance } from "@revolt/instance";
import { ModalController, useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  ScreenShareContent,
  ScreenShareQualityName,
  Voice as VoiceSettings,
} from "@revolt/state/stores/Voice";
import { VoiceCallCardContext } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { Device, useDevice } from "@revolt/common";
import {
  isMac,
  isTypingTarget,
  matchGlobalShortcut,
  transmitting,
} from "../keybinds/shortcuts";
import {
  audioCaptureFor,
  audioPublishFor,
  callBitrate,
  watchAudioSettings,
} from "./audioQuality";
import { deviceFallback } from "./callHealth";
import { InRoom } from "./components/InRoom";
import {
  desktopPushToTalk,
  globalTalkAllowed,
  latchPress,
} from "./desktopPushToTalk";
import { RoomState, TrackSource } from "./livekitConstants";
import { type VoiceRuntime, loadVoiceRuntime } from "./loadVoiceRuntime";
import { useVoiceError } from "./messages";
import { voiceErrorType } from "./moderation";
import {
  applyQuality,
  captureOptions,
  publishOptions,
  publishSafeQuality,
  republishCodec,
  resolveQuality,
  ScreenShareLimits,
  screenShareQualities,
  ScreenShareQuality,
  setDisplayMediaCap,
  watchRetiredCodecs,
} from "./screenShare";
import type { VoiceProcessor } from "./VoiceProcessor";

/** The call's audio, with LiveKit (loaded with the first call) */
const RoomAudio = lazy(() => import("./components/RoomAudio"));

type State =
  | "READY"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

/** LiveKit advertises ws/wss. The node probe must be http/https or fetch rejects and the call stays on Connecting. */
function livekitHealthUrl(publicUrl: string): string {
  if (publicUrl.startsWith("wss://")) {
    return `https://${publicUrl.slice("wss://".length)}`;
  }
  if (publicUrl.startsWith("ws://")) {
    return `http://${publicUrl.slice("ws://".length)}`;
  }
  return publicUrl;
}

function isMissingDevice(error: unknown): boolean {
  const name = (error as Error)?.name;
  const message = String((error as Error)?.message ?? error);
  return (
    name === "NotFoundError" || message.includes("Requested device not found")
  );
}

/** Waits between rejoin attempts after a network drop (about a minute in total) */
const REJOIN_DELAYS = [1000, 2000, 4000, 8000, 15000, 15000, 15000];

export type VoiceLayout = "fullscreen" | "expanded" | "collapsed" | undefined;

/** Short notices about the call, shown next to its status for a few seconds */
export type CallNotice =
  | "reconnected"
  | "inputFallback"
  | "inputRestored"
  | "outputFallback"
  | "outputRestored";

/** How long a call notice stays */
const NOTICE_MS = 6000;

/** Global push to talk (desktop): not asked, holding the combination, refused */
export type GlobalPttState = "off" | "on" | "unavailable";

class Voice {
  #client = useClient();
  #connectionAttempt = 0;
  #recentRemoval?: { channelId: string; at: number };
  #disconnecting: Promise<void> = Promise.resolve();
  #disposeTracks?: () => void;
  /** LiveKit, once the first call loaded it */
  #lk?: VoiceRuntime;
  error: Accessor<string | undefined>;
  #setError: Setter<string | undefined>;
  #errorMessage = useVoiceError();
  #settings: VoiceSettings;

  channel: Accessor<Channel | undefined>;
  #setChannel: Setter<Channel | undefined>;

  /** Voice bitrate of the current call (bits per second) */
  bitrate: Accessor<number>;
  #setBitrate: Setter<number>;

  room: Accessor<Room | undefined>;
  #setRoom: Setter<Room | undefined>;

  vidTracks: Accessor<TrackReferenceOrPlaceholder[]>;

  state: Accessor<State>;
  #setState: Setter<State>;

  deafen: Accessor<boolean>;
  /** The person's mute choice (what mute buttons show) */
  unmuted: Accessor<boolean>;
  /** Whether the microphone is sending right now (push to talk included) */
  microphone: Accessor<boolean>;

  /** Push to talk: whether the key is held right now */
  pttHeld: Accessor<boolean>;
  #setPttHeld: Setter<boolean>;

  /**
   * Push to talk from other apps (desktop app): turned on and off by the
   * global combination, because the desktop cannot see the key's release
   */
  pttLatched: Accessor<boolean>;
  #setPttLatched: Setter<boolean>;

  /**
   * Whether Rejoin makes sense after the call ended: not when this seat was
   * taken by another tab or device of the same account
   */
  canRejoin: Accessor<boolean>;
  #setCanRejoin: Setter<boolean>;

  /** A short notice about the call (reconnected, device unplugged) */
  notice: Accessor<CallNotice | undefined>;
  #setNotice: Setter<CallNotice | undefined>;
  #noticeTimer?: ReturnType<typeof setTimeout>;
  /** Ends the wait before the next rejoin attempt (the network came back) */
  #wake?: () => void;

  /** Whether the desktop app holds the global combination right now */
  globalPtt: Accessor<GlobalPttState>;
  #setGlobalPtt: Setter<GlobalPttState>;

  video: Accessor<boolean>;
  #setVideo: Setter<boolean>;

  screenshare: Accessor<boolean>;
  #setScreenshare: Setter<boolean>;

  layout: Accessor<VoiceLayout>;
  #setLayout: Setter<VoiceLayout>;

  focusId: Accessor<string | undefined>;
  #setFocus: Setter<string | undefined>;

  showBar: Accessor<boolean>;
  #setShowBar: Setter<boolean>;

  private sound: SoundController;
  private device: Device;

  private openModal;
  private config;
  private limits;
  private screenShareTracks: Set<string>;
  private voiceProcessor?: VoiceProcessor;

  constructor(
    voiceSettings: VoiceSettings,
    modals: ModalController,
    sound: SoundController,
    device: Device,
  ) {
    this.#settings = voiceSettings;
    const [error, setError] = createSignal<string>();
    this.error = error;
    this.#setError = setError;
    this.sound = sound;
    this.device = device;

    const [channel, setChannel] = createSignal<Channel>();
    this.channel = channel;
    this.#setChannel = setChannel;

    const [bitrate, setBitrate] = createSignal(64_000);
    this.bitrate = bitrate;
    this.#setBitrate = setBitrate;

    const [room, setRoom] = createSignal<Room>();
    this.room = room;
    this.#setRoom = setRoom;

    this.vidTracks = () => [];

    const [state, setState] = createSignal<State>("READY");
    this.state = state;
    this.#setState = setState;

    const [pttHeld, setPttHeld] = createSignal(false);
    this.pttHeld = pttHeld;
    this.#setPttHeld = setPttHeld;

    const [pttLatched, setPttLatched] = createSignal(false);
    this.pttLatched = pttLatched;
    this.#setPttLatched = setPttLatched;

    const [canRejoin, setCanRejoin] = createSignal(true);
    this.canRejoin = canRejoin;
    this.#setCanRejoin = setCanRejoin;

    const [notice, setNotice] = createSignal<CallNotice>();
    this.notice = notice;
    this.#setNotice = setNotice;

    const [globalPtt, setGlobalPtt] = createSignal<GlobalPttState>("off");
    this.globalPtt = globalPtt;
    this.#setGlobalPtt = setGlobalPtt;

    this.deafen = () => voiceSettings.deafen;
    this.unmuted = () =>
      voiceSettings.micOn && !voiceSettings.deafen && this.speakingPermission;
    this.microphone = () =>
      this.unmuted() &&
      transmitting(voiceSettings.inputMode, pttHeld() || pttLatched());

    // talking from other apps stops on mute, deafen and any change of room
    createEffect(
      on(
        [() => this.unmuted(), () => this.channel()],
        () => this.#setPttLatched(false),
        { defer: true },
      ),
    );

    const [video, setVideo] = createSignal(false);
    this.video = video;
    this.#setVideo = setVideo;

    const [screenshare, setScreenshare] = createSignal(false);
    this.screenshare = screenshare;
    this.#setScreenshare = setScreenshare;

    const [layout, setLayout] = createSignal<VoiceLayout>();
    this.layout = layout;
    this.#setLayout = setLayout;

    const [focus, setFocus] = createSignal<string>();
    this.focusId = focus;
    this.#setFocus = setFocus;

    const [showBar, setShowBar] = createSignal(true);
    this.showBar = showBar;
    this.#setShowBar = setShowBar;

    const inst = useInstance();
    this.config = inst.config;
    this.limits = inst.limits;
    this.openModal = modals.openModal;

    this.screenShareTracks = new Set();

    // Setup settings listeners
    this.settingsListeners();

    // The voice quality follows the server's supercharge level, also when
    // it changes during a call
    createEffect(() => {
      const room = this.room();
      const level = this.channel()?.server?.supercharge?.level;
      const bitrate = callBitrate(
        voiceBitrateFor(level),
        this.#settings.highQualityAudio,
      );
      this.#setBitrate(bitrate);
      if (this.state() !== "CONNECTED" || !room) return;
      void this.applyVoiceBitrate(room, bitrate);
    });

    createEffect(() => {
      const room = this.room();
      if (this.state() !== "CONNECTED" || !room) return;
      // Moderation affects effective media only; user preferences remain untouched.
      const enabled = this.microphone();
      void room.localParticipant
        .setMicrophoneEnabled(enabled)
        .catch((error) => this.onErr(error));
    });
  }

  // Dynamically set echo cancellation and gain control when the settings are changed
  // These functions are needed to maintain reactivity. Don't ask me why but if you make them not functions it breaks.
  private settingsListeners() {
    watchAudioSettings(this.#settings, {
      // capture constraints changed: restart the microphone with them
      restartCapture: (capture) => {
        const track = untrack(() => this.getMicrophoneTrack()?.audioTrack);
        if (!track) return;
        track.constraints.echoCancellation = capture.echoCancellation;
        track.constraints.autoGainControl = capture.autoGainControl;
        track.constraints.noiseSuppression = capture.noiseSuppression;
        //@ts-expect-error voiceIsolation is not yet standard, but it supported by livekit and most chromium based browsers, including electron.
        track.constraints.voiceIsolation = capture.voiceIsolation;
        track.constraints.channelCount = capture.channelCount;
        void track.restartTrack();
      },
      // high quality audio changes the encoder (stereo, DTX)
      republish: () => {
        const room = untrack(this.room);
        if (!room || untrack(this.state) !== "CONNECTED") return;
        void this.republishMicrophone(room);
      },
    });
  }

  /**
   * Publish the microphone again with the current audio settings (stereo
   * and DTX are fixed when a track is published)
   */
  private async republishMicrophone(room: Room) {
    const music = this.#settings.highQualityAudio;
    Object.assign(
      (room.options.publishDefaults ??= {}),
      audioPublishFor(
        voiceBitrateFor(this.channel()?.server?.supercharge?.level),
        music,
      ),
    );
    Object.assign(
      (room.options.audioCaptureDefaults ??= {}),
      audioCaptureFor(this.#settings, music),
    );
    try {
      const track = this.getMicrophoneTrack()?.track;
      if (track) await room.localParticipant.unpublishTrack(track);
      await this.enableMicrophone(room);
    } catch (error) {
      this.onErr(error);
    }
  }

  /**
   * Join a voice channel
   * @param auth Token and node URL already issued (moves)
   * @param previousSession LiveKit session of this device before its
   *   connection dropped; the server refuses the rejoin when another tab or
   *   device took the seat meanwhile
   */
  async connect(
    channel: Channel,
    auth?: { url: string; token: string },
    previousSession?: string,
    retry = 0,
  ): Promise<void> {
    // a rejoin after a network drop is not a leave: no leave sound
    this.disconnect(!!previousSession);
    const attempt = ++this.#connectionAttempt;
    this.#setError();
    this.#setCanRejoin(true);

    void this.device.setWakeLocked().catch(() => undefined);

    // the call carries the voice quality of the server's level; the call
    // bar shows the same number
    const voiceBitrate = voiceBitrateFor(channel.server?.supercharge?.level);
    this.#setBitrate(
      callBitrate(voiceBitrate, this.#settings.highQualityAudio),
    );

    // LiveKit loads with the first call, not with the app
    let lk: VoiceRuntime;
    try {
      lk = this.#lk ??= await loadVoiceRuntime();
    } catch (error) {
      if (attempt === this.#connectionAttempt) this.onErr(error);
      return;
    }
    if (attempt !== this.#connectionAttempt) return;

    const room = new lk.Room({
      // livekit-client 2.x defaults to the single-peer-connection protocol
      // (/rtc/v1), which our LiveKit server (1.9.x) does not serve: every
      // join failed once with a 404 and retried. Use the supported path
      // directly until the server is upgraded.
      singlePeerConnection: false,
      audioCaptureDefaults: audioCaptureFor(
        this.#settings,
        this.#settings.highQualityAudio,
      ),
      audioOutput: {
        deviceId: this.#settings.preferredAudioOutputDevice,
      },
      videoCaptureDefaults: {
        // TODO: Support higher resolutions based on limits
        resolution: lk.VideoPresets.h720.resolution,
        deviceId: this.#settings.preferredVideoDevice,
      },
      publishDefaults: {
        videoEncoding: lk.VideoPresets.h720.encoding,
        screenShareEncoding: lk.ScreenSharePresets.h720fps30.encoding,
        // Opus with DTX and RED; a supercharged server carries clearer
        // voice for everyone (see audioQuality.ts)
        ...audioPublishFor(voiceBitrate, this.#settings.highQualityAudio),
      },
    });

    // connect() runs from event handlers, outside any reactive owner: give
    // the track subscriptions their own root so disconnect() can dispose
    // them (they used to leak on every join)
    this.#disposeTracks?.();
    createRoot((dispose) => {
      this.#disposeTracks = dispose;
      this.vidTracks = lk.useTracks(
        [
          { source: TrackSource.Camera, withPlaceholder: true },
          { source: TrackSource.ScreenShare, withPlaceholder: false },
        ],
        { room, onlySubscribed: false },
      );
    });

    batch(() => {
      this.#setRoom(room);
      this.#setChannel(channel);
      this.#setState(previousSession ? "RECONNECTING" : "CONNECTING");
      this.#setVideo(false);
      this.#setScreenshare(false);
    });

    room.addListener("connected", () => {
      this.#setState("CONNECTED");
      if (previousSession) this.showNotice("reconnected");
      void this.enableMicrophone(room);
      for (const p of room.remoteParticipants.values()) {
        const screenShareTrack = p.getTrackPublication(TrackSource.ScreenShare);
        if (screenShareTrack) {
          this.screenShareTracks.add(screenShareTrack.trackSid);
        }
      }
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("disconnected", (reason) => {
      if (this.room() === room) {
        if (reason === lk.DisconnectReason.PARTICIPANT_REMOVED) {
          const channelId = this.channel()?.id;
          this.disconnect();
          // LiveKit removal can precede the application's move/token event.
          if (channelId) this.#recentRemoval = { channelId, at: Date.now() };
          return;
        }
        // the same account joined from another tab or device: that one
        // has the seat now, a Rejoin here would only push it out
        this.#setCanRejoin(reason !== lk.DisconnectReason.DUPLICATE_IDENTITY);
        this.#setState("DISCONNECTED");
        this.device.releaseWakeLock();
      }
    });
    // LiveKit's own reconnect reuses the token of the original join: after a
    // network drop its resume can take over the session of a tab or device
    // the user joined from meanwhile (same identity), and a full rejoin
    // pushes that one out. Rejoin through join_call instead, with the session
    // this device had: the server refuses when the seat has moved on.
    const rejoin = () => {
      if (this.room() !== room) return;
      const session = room.localParticipant.sid;
      if (!session) return this.#setState("RECONNECTING");
      void this.connect(channel, undefined, session);
    };
    room.addListener("signalReconnecting", rejoin);
    room.addListener("reconnecting", rejoin);
    room.addListener("reconnected", () => {
      this.#setState("CONNECTED");
      this.showNotice("reconnected");
    });
    // an unplugged headset: the call moves to the system default and says
    // so; plugged in again, it moves back
    room.addListener("mediaDevicesChanged", () => {
      if (this.room() === room) void this.followDevices(room);
    });

    room.addListener("localTrackPublished", (pub) => {
      if (pub.audioTrack && pub.audioTrack.source === TrackSource.Microphone) {
        if (!pub.audioTrack.getProcessor()) {
          pub.audioTrack?.setProcessor(
            (this.voiceProcessor = new lk.VoiceProcessor(this.#settings)),
          );
        }
      }
    });

    room.addListener("participantConnected", () => {
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("participantDisconnected", () => {
      this.sound.playSound("userLeaveVoice");
    });

    room.addListener("trackPublished", (pub) => {
      if (pub.source === TrackSource.ScreenShare) {
        pub.once("subscribed", (track) => {
          // Play the sound once playback starts, which might be quite a bit after subscription
          // as it starts paused for the screen share settings modal.
          track.once("videoPlaybackStarted", () => {
            this.sound.playSound("streamStart");
            if (track.sid) {
              this.screenShareTracks.add(track.sid);
            }
          });
        });
      }
    });

    room.addListener("trackUnpublished", (unpub) => {
      if (this.screenShareTracks.has(unpub.trackSid)) {
        this.sound.playSound("streamEnd");
        this.screenShareTracks.delete(unpub.trackSid);
      }
    });

    try {
      await this.#disconnecting;
      if (attempt !== this.#connectionAttempt) return;
      if (!auth) {
        // Move events already supply a new token and a known node: never probe
        // or obtain a second token in that path. With a single node there is
        // nothing to choose, so skip the health probe (one round trip less on
        // every join); room.connect reports an unreachable node anyway.
        const nodes = this.config.features.livekit.nodes;
        for (const node of nodes) {
          assertAllowedServiceUrl(node.public_url, `livekit node ${node.name}`);
        }
        const selected =
          nodes.length === 1
            ? nodes[0].name
            : await Promise.any(
                nodes.map(async (node) => {
                  const response = await fetch(
                    livekitHealthUrl(node.public_url),
                    {
                      signal: AbortSignal.timeout(5000),
                    },
                  );
                  if (!response.ok) throw new Error("Voice node unavailable");
                  return node.name;
                }),
              );
        if (attempt !== this.#connectionAttempt) return;
        auth = previousSession
          ? await this.rejoinCall(channel, selected, previousSession)
          : await channel.joinCall(selected);
      }
      if (attempt !== this.#connectionAttempt) return;
      if (!auth.token || !auth.url)
        throw new Error("Missing voice connection token");
      assertAllowedServiceUrl(auth.url, "livekit joinCall url");
      await room.connect(auth.url, auth.token, {
        autoSubscribe: false,
      });
    } catch (e) {
      if (attempt !== this.#connectionAttempt) return;
      room.removeAllListeners();
      await room.disconnect();
      // While the network is still coming back, keep trying for about a
      // minute, as LiveKit's own reconnect would; a server refusal is final.
      const type = voiceErrorType(e);
      if (
        previousSession &&
        retry < REJOIN_DELAYS.length &&
        type !== "AlreadyConnected" &&
        type !== "VoiceRejoinRefused"
      ) {
        this.#setState("RECONNECTING");
        // wait, unless the network comes back first (see networkBack)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, REJOIN_DELAYS[retry]);
          this.#wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        this.#wake = undefined;
        if (attempt !== this.#connectionAttempt) return;
        return this.connect(channel, undefined, previousSession, retry + 1);
      }
      this.#setCanRejoin(
        type !== "AlreadyConnected" && type !== "VoiceRejoinRefused",
      );
      this.#setState("DISCONNECTED");
      this.device.releaseWakeLock();
      this.onErr(e);
    }
  }

  /**
   * join_call for a device coming back from a network drop. A refusal from
   * the server (seat taken by another tab or device, moderator disconnect)
   * is final; network failures are retried by connect().
   */
  private async rejoinCall(
    channel: Channel,
    node: string,
    previousSession: string,
  ) {
    try {
      return (await this.#client().api.post(
        `/channels/${channel.id}/join_call`,
        {
          node,
          force_disconnect: true,
          previous_session: previousSession,
        },
      )) as { url: string; token: string };
    } catch (error) {
      const type = voiceErrorType(error);
      // fetch rejects with a TypeError while offline
      if (
        error instanceof TypeError ||
        type === "RateLimited" ||
        type === "AlreadyConnected"
      )
        throw error;
      throw JSON.stringify({ type: "VoiceRejoinRefused" });
    }
  }

  disconnect(quiet = false) {
    this.#recentRemoval = undefined;
    // notices belong to the call that ends here
    clearTimeout(this.#noticeTimer);
    this.#setNotice();
    ++this.#connectionAttempt;
    this.device.releaseWakeLock();
    try {
      const room = this.room();
      if (!room) return;

      room.removeAllListeners();
      this.#disconnecting = room
        .disconnect()
        .catch((error) => this.onErr(error));

      // drop ourselves from the channel's roster right away instead of
      // waiting for the server's leave event to round-trip
      const channel = this.channel();
      const self = this.#client().user?.id;
      if (channel && self) channel.voiceParticipants.delete(self);

      batch(() => {
        this.#setState("READY");
        this.#setRoom();
        this.#setChannel();
        this.#setLayout();
        this.vidTracks = () => [];
      });
      this.#disposeTracks?.();
      this.#disposeTracks = undefined;

      this.screenShareTracks = new Set();

      if (!quiet) this.sound.playSound("userLeaveVoice");
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleDeafen(fromMute?: boolean) {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      if (room.state !== RoomState.Connected) return;
      this.#settings.deafen = !this.#settings.deafen;
      if (fromMute) {
        this.#settings.micOn = true;
      }
      await room.localParticipant.setMicrophoneEnabled(this.microphone());
      if (this.#settings.deafen) {
        this.sound.playSound("deafen");
      } else {
        this.sound.playSound("undeafen");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  /** Show a short notice next to the call status */
  showNotice(notice: CallNotice) {
    clearTimeout(this.#noticeTimer);
    this.#setNotice(notice);
    this.#noticeTimer = setTimeout(() => this.#setNotice(), NOTICE_MS);
  }

  /**
   * The browser is online again: try the next rejoin now instead of after
   * the rest of the wait
   */
  networkBack() {
    this.#wake?.();
  }

  /** Join the same channel again after the call gave up reconnecting */
  rejoin() {
    const channel = this.channel();
    if (channel && this.state() === "DISCONNECTED" && this.canRejoin())
      void this.connect(channel);
  }

  /** Apply deviceFallback to the microphone and the speaker */
  private async followDevices(room: Room) {
    let devices: MediaDeviceInfo[];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      return;
    }
    for (const kind of ["audioinput", "audiooutput"] as const) {
      const preferred =
        kind === "audioinput"
          ? this.#settings.preferredAudioInputDevice
          : this.#settings.preferredAudioOutputDevice;
      const { switchTo, notice } = deviceFallback({
        preferred,
        active: room.getActiveDevice(kind) ?? preferred,
        available: devices.filter((device) => device.kind === kind),
      });
      if (switchTo) {
        try {
          await room.switchActiveDevice(kind, switchTo);
        } catch (error) {
          console.warn("[rtc] could not switch device", error);
          continue;
        }
      }
      if (notice)
        this.showNotice(
          kind === "audioinput"
            ? notice === "fallback"
              ? "inputFallback"
              : "inputRestored"
            : notice === "fallback"
              ? "outputFallback"
              : "outputRestored",
        );
    }
  }

  /**
   * Push to talk: the key went down or up (or the window lost focus)
   */
  setPushToTalk(held: boolean) {
    this.#setPttHeld(held);
  }

  /**
   * Push to talk from other apps (desktop): the global combination was
   * pressed. A sound says which way it went, since the window may be hidden.
   */
  togglePushToTalkLatch() {
    const { latched, sound } = latchPress(this.pttLatched(), this.unmuted());
    this.#setPttLatched(latched);
    this.sound.playSound(sound);
  }

  /** Stop talking from other apps (leaving the call, leaving push to talk) */
  clearPushToTalkLatch() {
    this.#setPttLatched(false);
  }

  /** What the desktop app answered when asked for the global combination */
  setGlobalPtt(state: GlobalPttState) {
    this.#setGlobalPtt(state);
  }

  async toggleMute() {
    if (this.#settings.deafen) {
      this.toggleDeafen(true);
      return;
    }
    try {
      const room = this.room();
      // not in a call yet: the choice is saved and used when joining
      if (!room || room.state !== RoomState.Connected) {
        this.#settings.micOn = !this.#settings.micOn;
        return;
      }
      if (!this.speakingPermission) return;
      // flip the saved choice, not the live track: with push to talk the
      // track is off between presses while the person is not muted
      this.#settings.micOn = !this.#settings.micOn;
      await room.localParticipant.setMicrophoneEnabled(this.microphone());

      if (this.#settings.micOn) {
        this.sound.playSound("unmute");
      } else {
        this.sound.playSound("mute");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleCamera() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      if (room.state !== RoomState.Connected) return;
      if (!this.videoPermission && !room.localParticipant.isCameraEnabled)
        return;
      await room.localParticipant.setCameraEnabled(
        !room.localParticipant.isCameraEnabled,
      );

      this.#setVideo(room.localParticipant.isCameraEnabled);
    } catch (e) {
      this.onErr(e);
    }
  }

  /**
   * Screen share qualities the plan and the server's level allow (720p 30
   * FPS always), tuned for what is shared
   * @param content Text and slides (sharp) or video and games (smooth)
   */
  getEnabledScreenShareQualities(
    content: ScreenShareContent = this.#settings.screenShareContent,
  ): Partial<Record<ScreenShareQualityName, ScreenShareQuality>> {
    return screenShareQualities(this.screenShareLimits(), content);
  }

  /** Resolution and frame rate the plan and the server's level allow */
  private screenShareLimits(): ScreenShareLimits {
    // Plus and a supercharged server raise resolution and frame rate
    const perks = levelPerks(this.channel()?.server?.supercharge?.level);
    const own = this.limits().video_resolution;
    const limit =
      perks &&
      own[0] !== 0 &&
      perks.video_resolution[0] * perks.video_resolution[1] > own[0] * own[1]
        ? perks.video_resolution
        : own;
    const fps = Math.max(
      activePlusLimits()?.video_framerate ?? 30,
      perks?.video_framerate ?? 30,
    );

    return { resolution: [limit[0], limit[1]], framerate: fps };
  }

  async toggleScreenshare() {
    const room = this.room();
    if (!room) throw "invalid state";
    if (room.state !== RoomState.Connected) return;
    if (!this.videoPermission && !room.localParticipant.isScreenShareEnabled)
      return;

    if (this.screenshare()) {
      await room.localParticipant.setScreenShareEnabled(false);

      this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

      this.sound.playSound("streamEnd");
    } else {
      watchRetiredCodecs(room);
      const qualities = this.getEnabledScreenShareQualities();
      let screenPickerQualityName: ScreenShareQualityName | undefined;
      let screenPickerAudio: boolean | undefined;
      let screenPickerContent: ScreenShareContent | undefined;

      // Register the modal on screen picker handler if it exists
      if (window.native && window.native.onceScreenPicker) {
        window.native.onceScreenPicker((sources) => {
          this.openModal({
            type: "screen_share_picker",
            onCancel: () => {
              window.native.screenPickerCallback(-1, false);
            },
            callback: (
              idx: number,
              qualityName: ScreenShareQualityName,
              audio: boolean,
              content: ScreenShareContent,
            ) => {
              window.native.screenPickerCallback(idx, audio);
              screenPickerQualityName = qualityName;
              screenPickerAudio = audio;
              screenPickerContent = content;
            },
            sources: sources,
            qualities: Object.keys(qualities).map((k) => {
              const v = qualities[k as ScreenShareQualityName]!;
              return { name: k, fullName: v.fullName };
            }),
          });
        });
      }

      try {
        // Publish at the stored quality (the dialog's default), as large as
        // voice-ingress accepts for the plan: it removes users whose
        // published video is bigger. The chosen quality is applied right
        // after on every path (this used to start at 640×480 / 5 FPS and
        // stay there when the dialog was turned off).
        const startQuality = publishSafeQuality(
          resolveQuality(qualities, this.#settings.screenShareQuality),
          this.screenShareLimits().resolution,
        );
        setDisplayMediaCap(startQuality);
        const localTrack = await room.localParticipant
          .setScreenShareEnabled(
            true,
            captureOptions(startQuality, {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              voiceIsolation: false,
              restrictOwnAudio: true,
            }),
            publishOptions(startQuality, republishCodec(room)),
          )
          .finally(() => setDisplayMediaCap(undefined));

        const screenAudioTrack = room.localParticipant.getTrackPublication(
          TrackSource.ScreenShareAudio,
        );

        this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

        if (localTrack) {
          // This event is only fired if the screen share is ended by closing the window being streamed.
          // This catches the ending and disables screen sharing on our side. If this weren't here,
          // livekit would still share stream audio after closing the window being streamed.
          localTrack.on("ended", () => {
            this.toggleScreenshare();
            const oldAudioTrack = room.localParticipant.getTrackPublication(
              TrackSource.ScreenShareAudio,
            );
            if (oldAudioTrack && oldAudioTrack.track) {
              room.localParticipant.unpublishTrack(oldAudioTrack.track);
            }
          });

          const callback = async (
            qualityName: ScreenShareQualityName | undefined,
            audio: boolean,
            content: ScreenShareContent,
          ) => {
            const quality = resolveQuality(
              this.getEnabledScreenShareQualities(content),
              qualityName,
            );

            if (localTrack.videoTrack) {
              try {
                await applyQuality(localTrack, quality);
              } catch (error) {
                // the capture keeps the size it started with
                console.warn("[rtc] screen share quality not applied", error);
              }
              if (!audio && screenAudioTrack?.track) {
                room.localParticipant.unpublishTrack(screenAudioTrack.track);
              }
              this.sound.playSound("streamStart");
            }
          };

          if (screenPickerQualityName) {
            callback(
              screenPickerQualityName,
              screenPickerAudio || false,
              screenPickerContent ?? this.#settings.screenShareContent,
            );
          } else if (this.#settings.screenShareQualityAsk) {
            // the dialog also asks what is shared, so it opens even when
            // the plan offers one size
            {
              localTrack.pauseUpstream();
              screenAudioTrack?.pauseUpstream();
              this.openModal({
                onCancel: async () => {
                  await room.localParticipant.setScreenShareEnabled(false);
                  this.#setScreenshare(
                    room.localParticipant.isScreenShareEnabled,
                  );
                },
                type: "screen_share_settings",
                trackReference: {
                  participant: room.localParticipant,
                  publication: localTrack,
                  source: TrackSource.ScreenShare,
                },
                qualities: Object.keys(qualities).map((k) => {
                  const v = qualities[k as ScreenShareQualityName]!;
                  return { name: k, fullName: v.fullName };
                }),
                audio: !!screenAudioTrack,
                callback: async (qualityName, audio, content) => {
                  // apply first so viewers never get frames of the old size
                  await callback(qualityName, audio, content);
                  localTrack.resumeUpstream();
                  if (audio) {
                    screenAudioTrack?.resumeUpstream();
                  }
                },
              });
            }
          } else {
            // "Don't ask again": use the saved choice (this path used to
            // keep the 640×480 / 5 FPS start-up capture for the whole share)
            callback(
              this.#settings.screenShareQuality,
              this.#settings.screenShareAudio,
              this.#settings.screenShareContent,
            );
          }
        }
      } catch (e) {
        this.onErr(e);
      }
    }
  }

  resetLayout() {
    this.#setLayout();
  }

  toggleLayout(type: VoiceLayout) {
    this.#setLayout((l) => (l === type ? undefined : type));
  }

  trackId(t: TrackReferenceOrPlaceholder) {
    return `${t.source}_${t.participant.sid}`;
  }

  toggleFocus(t?: TrackReferenceOrPlaceholder) {
    const id = t ? this.trackId(t) : undefined;
    this.#setFocus(
      this.focusId() === id || this.vidTracks().length < 2 ? undefined : id,
    );
  }

  isFocus(t: TrackReferenceOrPlaceholder) {
    return this.trackId(t) === this.focusId();
  }

  focusTrack() {
    const id = this.focusId();
    return id
      ? this.vidTracks().find((t) => this.trackId(t) === id)
      : undefined;
  }

  toggleShowBar() {
    this.#setShowBar((s) => !s);
  }

  getConnectedUser(userId: string) {
    return this.room()?.getParticipantByIdentity(userId);
  }

  showCard(channel: Channel) {
    return (
      channel.isVoice &&
      (this.channel()?.id === channel.id ||
        channel.type === "TextChannel" ||
        !!channel.voiceParticipants.size)
    );
  }

  getMicrophoneTrack(): LocalTrackPublication | undefined {
    const track = this.room()?.localParticipant.getTrackPublication(
      TrackSource.Microphone,
    );
    return track;
  }

  get listenPermission() {
    return !!this.channel()?.havePermission("Listen") && !this.serverDeafened;
  }

  get speakingPermission() {
    const channel = this.channel();
    return (
      !!channel?.havePermission("Speak") &&
      !this.serverMuted &&
      // on a stage only speakers talk: the audience never opens its
      // microphone (no prompt, no track), and an invite opens it
      (!channel.isStage || this.isStageSpeaker)
    );
  }

  /** Whether you may speak on the stage you are in */
  get isStageSpeaker() {
    const self = this.#client().user?.id;
    return !!self && !!this.channel()?.isStageSpeaker(self);
  }

  get ownMember() {
    const server = this.channel()?.serverId;
    const user = this.#client().user?.id;
    return server && user
      ? this.#client().serverMembers.getByKey({ server, user })
      : undefined;
  }

  acceptsMoveFrom(channelId: string) {
    return (
      this.channel()?.id === channelId ||
      (this.#recentRemoval?.channelId === channelId &&
        Date.now() - this.#recentRemoval.at < 15000)
    );
  }

  get serverMuted() {
    return this.ownMember?.canPublish === false;
  }
  get serverDeafened() {
    return this.ownMember?.canReceive === false;
  }
  get videoPermission() {
    return !!this.channel()?.havePermission("Video");
  }

  /**
   * Cap the microphone's outgoing bitrate (new publications get it from the
   * room defaults; this updates one that is already sending)
   */
  private async applyVoiceBitrate(room: Room, bitrate: number) {
    const sender = room.localParticipant.getTrackPublication(
      TrackSource.Microphone,
    )?.track?.sender;
    if (!sender) return;
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings?.length) parameters.encodings = [{}];
      for (const encoding of parameters.encodings) {
        encoding.maxBitrate = bitrate;
      }
      await sender.setParameters(parameters);
    } catch {
      // the next join uses the new quality anyway
    }
  }

  private async enableMicrophone(room: Room) {
    // push to talk: publish the microphone already muted, so the first
    // press only unmutes it and no word is cut off; nothing is sent
    // before the key goes down
    if (
      this.unmuted() &&
      !this.microphone() &&
      this.#settings.inputMode === "ptt"
    ) {
      try {
        const track = await this.#lk!.createLocalAudioTrack(
          room.options.audioCaptureDefaults,
        );
        await track.mute();
        await room.localParticipant.publishTrack(track, {
          source: TrackSource.Microphone,
        });
        // the key may have gone down while publishing
        if (this.microphone())
          await room.localParticipant.setMicrophoneEnabled(true);
        await this.applyVoiceBitrate(room, this.bitrate());
      } catch (error) {
        // the first press opens the microphone the usual way instead
        if (!isMissingDevice(error)) this.onErr(error);
      }
      return;
    }

    if (!this.microphone()) return;

    try {
      const track = await room.localParticipant.setMicrophoneEnabled(true);
      this.#settings.micOn = track != null;
      if (track) await this.applyVoiceBitrate(room, this.bitrate());
      return;
    } catch (error) {
      if (!isMissingDevice(error)) {
        this.#settings.micOn = false;
        this.onErr(error);
        return;
      }
    }

    this.#settings.preferredAudioInputDevice = undefined;
    try {
      await room.switchActiveDevice("audioinput", "default");
      const track = await room.localParticipant.setMicrophoneEnabled(true);
      this.#settings.micOn = track != null;
    } catch (error) {
      this.#settings.micOn = false;
      this.onErr(error);
    }
  }

  private onErr(e: unknown) {
    this.#setError(this.#errorMessage(e));
  }
}

const voiceContext = createContext<Voice>(null as unknown as Voice);

/**
 * Mount global voice context and room audio manager
 */
export function VoiceContext(props: { children: JSX.Element }) {
  const state = useState();
  const modals = useModals();
  const sound = useSound();
  const device = useDevice();
  const voice = new Voice(state.voice, modals, sound, device);
  const client = useClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { mediaUrl } = useInstance();

  // App-wide shortcuts (listed in Ctrl+/) and push to talk. Physical keys,
  // so they match on every keyboard layout.
  const mac = isMac();
  const inCall = () => voice.state() === "CONNECTED";
  const onKeyDown = (event: KeyboardEvent) => {
    const shortcut = matchGlobalShortcut(event, mac);
    if (shortcut === "open_shortcuts") {
      event.preventDefault();
      if (!event.repeat)
        modals.openModal({
          type: "settings",
          config: "user",
          initialPage: "keybinds",
        });
      return;
    }
    if (shortcut) {
      // outside a call the browser keeps its own meaning for these keys
      if (!inCall()) return;
      event.preventDefault();
      if (event.repeat) return;
      if (shortcut === "toggle_mute") void voice.toggleMute();
      else void voice.toggleDeafen();
      return;
    }
    if (
      inCall() &&
      state.voice.inputMode === "ptt" &&
      event.code === state.voice.pttKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isTypingTarget(event.target)
    ) {
      // also on repeats, so a held Space never scrolls the page
      event.preventDefault();
      voice.setPushToTalk(true);
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === state.voice.pttKey) voice.setPushToTalk(false);
  };
  // a key released in another window never reaches us: stop talking
  const release = () => voice.setPushToTalk(false);
  const onVisibility = () => document.hidden && release();
  const onOnline = () => voice.networkBack();
  window.addEventListener("online", onOnline);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", release);
    document.removeEventListener("visibilitychange", onVisibility);
  });
  createEffect(() => {
    if (!inCall() || state.voice.inputMode !== "ptt") {
      release();
      voice.clearPushToTalkLatch();
    }
  });

  // Desktop app: Ctrl+Shift (⌘⇧) with the push-to-talk key works from other
  // apps too, as a toggle. Held only during a push-to-talk call, so the
  // combination stays free for other apps the rest of the time. Browsers
  // keep the in-window key and stop talking when the window loses focus.
  const desktopPtt = desktopPushToTalk();
  if (desktopPtt) {
    const stopListening = desktopPtt.onToggle(() => {
      if (inCall() && state.voice.inputMode === "ptt")
        voice.togglePushToTalkLatch();
    });
    onCleanup(() => stopListening());
    createEffect(() => {
      const key = state.voice.pttKey;
      if (
        !inCall() ||
        state.voice.inputMode !== "ptt" ||
        // off until the person turns "Talk from other apps" on, and never
        // for keys other apps need with Ctrl+Shift
        !state.voice.globalTalk ||
        !globalTalkAllowed(key)
      ) {
        voice.setGlobalPtt("off");
        return;
      }
      let current = true;
      desktopPtt
        .register(key)
        .catch(() => false)
        .then((ok) => current && voice.setGlobalPtt(ok ? "on" : "unavailable"));
      onCleanup(() => {
        current = false;
        desktopPtt.unregister();
      });
    });
  }
  createEffect(() => {
    const instance = client();
    const onMove = (move: {
      node: string;
      from: string;
      to: string;
      token: string;
    }) => {
      if (!voice.acceptsMoveFrom(move.from)) return;
      const channel = instance.channels.get(move.to);
      const node = instance.configuration?.features.livekit.nodes.find(
        (node) => node.name === move.node,
      );
      if (!channel || !node || !move.token) {
        voice.disconnect();
        modals.openModal({
          type: "error2",
          error: new Error(
            "Voice move is missing a destination, node or new token. Rejoin the destination channel.",
          ),
        });
        return;
      }
      void voice.connect(channel, { url: node.public_url, token: move.token });
      // Like Discord, a move only follows into the new room when the user
      // was looking at the old one; any other page stays open.
      if (location.pathname.includes(move.from)) navigate(channel.path);
    };
    const onLeave = (channelId: string, userId: string) => {
      // Roster leave events have no session identifier. An old session's leave
      // may arrive after a same-channel rejoin, or while LiveKit is still
      // reconnecting this one after a network drop (the replaced session
      // leaves); LiveKit owns active media state, so only a room it already
      // gave up on is cleared here.
      if (
        userId === instance.user?.id &&
        voice.channel()?.id === channelId &&
        voice.state() !== "RECONNECTING" &&
        (voice.room()?.state ?? RoomState.Disconnected) ===
          RoomState.Disconnected
      )
        voice.disconnect();
    };
    instance.on("userMoveVoiceChannel", onMove);
    instance.on("voiceChannelLeave", onLeave);
    onCleanup(() => {
      instance.off("userMoveVoiceChannel", onMove);
      instance.off("voiceChannelLeave", onLeave);
    });
  });

  // stage, soundboard and screen share stills: loaded with the first call
  createEffect(() => {
    const channel = voice.channel();
    if (!channel) return;
    let detach: (() => void) | undefined;
    let cancelled = false;
    void import("./voiceExtras").then(({ attachVoiceExtras }) => {
      if (cancelled) return;
      detach = attachVoiceExtras(
        client(),
        channel,
        voice,
        state.voice,
        mediaUrl,
      );
    });
    onCleanup(() => {
      cancelled = true;
      detach?.();
    });
  });
  onCleanup(() => voice.disconnect());

  return (
    <voiceContext.Provider value={voice}>
      <VoiceCallCardContext>{props.children}</VoiceCallCardContext>
      <InRoom>
        <RoomAudio />
      </InRoom>
    </voiceContext.Provider>
  );
}

export const useVoice = () => useContext(voiceContext);
