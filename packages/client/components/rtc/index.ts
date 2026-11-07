import { installDisplayMediaCap } from "./screenShare";
import { getVirtmic } from "./virtualMic";

export { useVoice, VoiceContext } from "./state";

export { InRoom } from "./components/InRoom";
export {
  type ScreenShareLiveStats,
  liveStatsLabel,
  senderLiveStats,
} from "./screenShare";
export { stoatSinkName } from "./virtualMic";

// A screen capture starts at most at the size the voice state sets for the
// share (the chosen quality, within what voice-ingress accepts at publish).
// This used to force every capture to 640×480 at 5 FPS and relied on a later
// switch to the chosen quality, which some paths never made.
installDisplayMediaCap(async (stream, opts) => {
  if (opts && opts.audio && window.native?.isWayland?.()) {
    const id = await getVirtmic();

    console.debug("Virt mic acquired:", id);

    if (id) {
      const audio = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: id,
          },
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
        },
      });

      // the replaced capture audio would otherwise keep running
      stream.getAudioTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(audio.getAudioTracks()[0]);
    }
  }

  return stream;
});
