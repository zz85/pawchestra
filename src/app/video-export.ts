import { Muxer, StreamTarget } from 'mp4-muxer';

import { channelGainsDb, mixSynthEvents } from '../score/stage-mix.ts';
import type { ChannelMix } from '../score/stage-mix.ts';
import type { Score } from '../score/types.ts';
import type { DecodeReply, DecodeRequest } from '../audio/decode-messages.ts';
import { BLOCK_FRAMES, SynthEngine } from '../audio/engine.ts';
import type { EngineBank } from '../audio/engine.ts';
import { fetchOk } from '../audio/fetch-ok.ts';
import { MIX_BUSES, createOutputChain, gainOfDb } from '../audio/output-chain.ts';
import type { MixName } from '../audio/output-chain.ts';
import { INDEX_FILE, resolvePresetFiles } from '../audio/preset-index.ts';
import type { PresetFileEntry } from '../audio/preset-index.ts';
import { SOUNDFONT_HEADROOM_DB } from '../audio/soundfont-info.ts';
import { packSynthEvents } from '../audio/synth-events.ts';

/** The sample rate of the sound of a video (design 2.9). */
const SAMPLE_RATE = 48_000;

/** The frames of one chunk of the sound that the encoder gets: 1024, one AAC frame. */
const AUDIO_CHUNK = 1024;

/** The bit rate of the sound, in bits a second. */
const AUDIO_BITRATE = 192_000;

/** The seconds between two key frames of the picture. */
const KEY_FRAME_SEC = 2;

/** The most frames that wait in the video encoder before the next frame renders. */
const ENCODE_QUEUE = 4;

/** The blocks of the synth between two yields to the page, about 0.3 s of sound. */
const BLOCKS_A_SLICE = 120;

/** The parts of a job: the sound, then the picture. */
export type ExportStage = 'samples' | 'sound' | 'picture' | 'file';

/** The progress of an export, for the text of the panel. */
export type ExportProgress = (stage: ExportStage, done: number, total: number) => void;

/** True if the browser can encode a video: WebCodecs (design 2.9). */
export function exportSupported(): boolean {
  return typeof VideoEncoder === 'function' && typeof AudioEncoder === 'function';
}

/**
 * Gives the bit rate of the picture: about 0.12 bits for each pixel of each frame, so 1080p at 30
 * fps gets 7.5 Mbit/s.
 *
 * @param width The width, in pixels.
 * @param height The height, in pixels.
 * @param fps The frames a second.
 * @returns The bit rate, in bits a second.
 */
export function videoBitrate(width: number, height: number, fps: number): number {
  return Math.round(Math.min(60e6, Math.max(2e6, width * height * fps * 0.12)));
}

/**
 * Gives a time for the end of a slice of work, so the page stays responsive.
 *
 * @returns A promise that resolves in a later task.
 */
async function nextTask(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Throws if the export was cancelled.
 *
 * @param signal The signal of the cancel.
 * @throws DOMException `AbortError` after a cancel.
 */
function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('The export was cancelled.', 'AbortError');
  }
}

/**
 * Fetches and decodes the presets of a score into PCM banks on a decode Worker, as the `Player`
 * does (design 6.3).
 *
 * @param urls The URLs of the preset files.
 * @param onProgress Gets the files that are ready.
 * @returns The banks, in the order of the files.
 */
async function decodeBanks(
  urls: readonly string[],
  onProgress: (done: number) => void,
): Promise<readonly EngineBank[]> {
  if (urls.length === 0) {
    return [];
  }
  const worker = new Worker(new URL('../audio/decode-worker.ts', import.meta.url), {
    type: 'module',
  });
  try {
    return await new Promise<readonly EngineBank[]>((resolve, reject) => {
      worker.addEventListener('message', (event: MessageEvent<DecodeReply>) => {
        const reply = event.data;
        if (reply.type === 'progress') {
          onProgress(reply.done);
        } else if (reply.type === 'decoded') {
          resolve(reply.banks);
        } else {
          reject(new Error(reply.message));
        }
      });
      worker.addEventListener('error', () => {
        reject(new Error('The decode Worker failed.'));
      });
      const request: DecodeRequest = { type: 'decode', id: 1, urls };
      worker.postMessage(request);
    });
  } finally {
    worker.terminate();
  }
}

/** The inputs of the sound of a video. */
export interface SoundInput {
  readonly score: Score;
  /** The pan and the reverb send of each synth channel (design 6.1). */
  readonly mix: readonly ChannelMix[];
  /** The gain of the piece, from `pieceGainDb()` (design 6.8). */
  readonly gainDb: number;
  /** The mix preset of the session. */
  readonly mixName: MixName;
  /** True for each seat that sounds (the mute and solo buttons, design 6.6). */
  readonly audible: readonly boolean[];
  /** The song time of the start, in seconds. */
  readonly startSec: number;
  /** The length of the sound, in seconds. */
  readonly lengthSec: number;
  /** The URL of the site root, which holds `sf/`. */
  readonly baseUrl: URL;
  readonly onProgress: ExportProgress;
  readonly signal: AbortSignal;
}

/**
 * Renders the sound of a video offline (design 2.9): the synth of the worklet on the main thread
 * in blocks, from the start of the clip, then the output chain of the `Player` with the hall in
 * an `OfflineAudioContext`. Thus the sound is the sound of the page, and it is in sync with each
 * frame.
 *
 * @param input The inputs.
 * @returns The sound, stereo at 48 kHz.
 */
export async function renderSound(input: SoundInput): Promise<AudioBuffer> {
  const { score, signal, onProgress } = input;
  const index = await fetchOk(new URL(INDEX_FILE, input.baseUrl)).then(
    async (response): Promise<readonly PresetFileEntry[]> => {
      // SAFETY: tools/split-soundfont.ts writes this file as an array of PresetFileEntry.
      return (await response.json()) as PresetFileEntry[];
    },
  );
  const urls = resolvePresetFiles(index, score.presets).map(
    (file) => new URL(file.file, input.baseUrl).href,
  );
  onProgress('samples', 0, urls.length);
  const banks = await decodeBanks(urls, (done) => {
    onProgress('samples', done, urls.length);
  });
  checkAbort(signal);

  const engine = new SynthEngine(SAMPLE_RATE, () => undefined);
  engine.loadScore(
    packSynthEvents(mixSynthEvents(score.synthEvents, input.mix)),
    score.durationSec,
    channelGainsDb(input.mix),
  );
  engine.addBanks(banks);
  input.audible.forEach((audible, seatIndex) => {
    if (!audible) {
      engine.enqueue({ type: 'seat', seatIndex, audible });
    }
  });
  engine.enqueue({ type: 'seek', songSec: input.startSec });
  engine.enqueue({ type: 'play', countInSec: 0 });

  const blocks = Math.ceil((input.lengthSec * SAMPLE_RATE) / BLOCK_FRAMES);
  const length = blocks * BLOCK_FRAMES;
  const context = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const dry = context.createBuffer(2, length, SAMPLE_RATE);
  const left = dry.getChannelData(0);
  const right = dry.getChannelData(1);
  for (let b = 0; b < blocks; b++) {
    const at = b * BLOCK_FRAMES;
    engine.render(at / SAMPLE_RATE, left.subarray(at, at + BLOCK_FRAMES), right.subarray(at, at + BLOCK_FRAMES));
    if (b % BLOCKS_A_SLICE === 0) {
      onProgress('sound', b, blocks);
      await nextTask();
      checkAbort(signal);
    }
  }

  const chain = createOutputChain(context, MIX_BUSES[input.mixName]);
  chain.input.gain.value = gainOfDb(SOUNDFONT_HEADROOM_DB + input.gainDb);
  const hall = chain.bus.hall;
  try {
    const flac = await fetchOk(new URL(hall.flacUrl, input.baseUrl));
    chain.convolver.buffer = await context.decodeAudioData(await flac.arrayBuffer());
  } catch {
    const wav = await fetchOk(new URL(hall.wavUrl, input.baseUrl));
    chain.convolver.buffer = await context.decodeAudioData(await wav.arrayBuffer());
  }
  const source = context.createBufferSource();
  source.buffer = dry;
  source.connect(chain.input);
  source.start();
  return await context.startRendering();
}

/** The picture and the sound of a video, for {@link encodeVideo}. */
export interface VideoJob {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** The number of frames. */
  readonly frames: number;
  /** The canvas that each frame renders on, at the size of the video. */
  readonly canvas: HTMLCanvasElement;
  /**
   * Renders one frame on the canvas.
   *
   * @param frame The number of the frame, from 0.
   */
  readonly renderFrame: (frame: number) => void;
  /** The sound, or `null` for a video with no sound. */
  readonly sound: AudioBuffer | null;
  readonly onProgress: ExportProgress;
  readonly signal: AbortSignal;
}

/**
 * Finds an H.264 profile that the browser encodes at the size of the video.
 *
 * @param config The configuration with no codec.
 * @returns The codec string, or `null` if none works.
 */
async function videoCodec(config: Omit<VideoEncoderConfig, 'codec'>): Promise<string | null> {
  // High profile at the levels 4.0, 5.1, and 5.2, then the baseline profile.
  for (const codec of ['avc1.640028', 'avc1.640033', 'avc1.640034', 'avc1.42003e']) {
    const support = await VideoEncoder.isConfigSupported({ ...config, codec });
    if (support.supported === true) {
      return codec;
    }
  }
  return null;
}

/**
 * Encodes a video offline (design 2.9): each frame renders at a fixed time step, so the video is
 * smooth however slow the GPU is. WebCodecs encodes H.264 and AAC, or Opus with no AAC encoder, and `mp4-muxer` writes a
 * fragmented MP4 file, which it writes from the start to the end.
 *
 * @param job The picture and the sound.
 * @returns The file.
 * @throws Error if the browser cannot encode the video.
 */
export async function encodeVideo(job: VideoJob): Promise<Blob> {
  const { width, height, fps, signal } = job;
  const bitrate = videoBitrate(width, height, fps);
  const base = { width, height, bitrate, framerate: fps };
  const codec = await videoCodec(base);
  if (!codec) {
    throw new Error(`This browser cannot encode H.264 video at ${width} x ${height}.`);
  }

  // AAC where the browser encodes it, as Chrome does; else Opus, as Chromium does.
  const audioConfig = { sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE };
  const aac = job.sound
    ? (await AudioEncoder.isConfigSupported({ ...audioConfig, codec: 'mp4a.40.2' })).supported ===
      true
    : false;

  const parts: Uint8Array<ArrayBuffer>[] = [];
  let written = 0;
  const target = new StreamTarget({
    onData: (data, position) => {
      if (position !== written) {
        throw new Error('The MP4 writer moved back in the file.');
      }
      parts.push(new Uint8Array(data));
      written += data.byteLength;
    },
  });
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: fps },
    ...(job.sound
      ? { audio: { codec: aac ? 'aac' : 'opus', numberOfChannels: 2, sampleRate: SAMPLE_RATE } }
      : {}),
    fastStart: 'fragmented',
    minFragmentDuration: 1,
  });
  let failure: Error | null = null;
  const fail = (error: Error): void => {
    failure ??= error;
  };

  if (job.sound) {
    const audio = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      },
      error: fail,
    });
    audio.configure({ ...audioConfig, codec: aac ? 'mp4a.40.2' : 'opus' });
    const left = job.sound.getChannelData(0);
    const right = job.sound.getChannelData(1);
    const total = job.sound.length;
    for (let at = 0; at < total; at += AUDIO_CHUNK) {
      const frames = Math.min(AUDIO_CHUNK, total - at);
      const planar = new Float32Array(frames * 2);
      planar.set(left.subarray(at, at + frames), 0);
      planar.set(right.subarray(at, at + frames), frames);
      const data = new AudioData({
        format: 'f32-planar',
        sampleRate: SAMPLE_RATE,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: Math.round((at * 1e6) / SAMPLE_RATE),
        data: planar,
      });
      audio.encode(data);
      data.close();
    }
    await audio.flush();
    audio.close();
  }

  const video = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: fail,
  });
  video.configure({ ...base, codec, latencyMode: 'quality' });
  const keyEvery = Math.max(1, Math.round(KEY_FRAME_SEC * fps));
  const frameUs = 1e6 / fps;
  for (let f = 0; f < job.frames; f++) {
    checkAbort(signal);
    if (failure) {
      throw failure;
    }
    job.renderFrame(f);
    const frame = new VideoFrame(job.canvas, {
      timestamp: Math.round(f * frameUs),
      duration: Math.round(frameUs),
    });
    video.encode(frame, { keyFrame: f % keyEvery === 0 });
    frame.close();
    job.onProgress('picture', f + 1, job.frames);
    while (video.encodeQueueSize > ENCODE_QUEUE) {
      await nextTask();
    }
    if (f % 8 === 7) {
      await nextTask();
    }
  }
  await video.flush();
  video.close();
  if (failure) {
    throw failure;
  }

  job.onProgress('file', 1, 1);
  muxer.finalize();
  return new Blob(parts, { type: 'video/mp4' });
}
