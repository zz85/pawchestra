import type { DemoId, StageFile } from '../app/demos.ts';
import type { MixName } from './output-chain.ts';

/**
 * The loudness of each demo at the output of the chain, after the limiter, in LUFS (design 6.8):
 * the distribution loudness of music of AES TD1008. Spotify plays at -14 LUFS by default, and
 * EBU R 128 gives -23 LUFS for broadcast. At -16 LUFS, the limiter acts on at most 2 % of the
 * blocks of 50 ms of a demo by more than 1 dB (`pnpm loudness`).
 */
export const TARGET_LOUDNESS = -16;

/**
 * The loudness of each demo that {@link pieceGainDb} corrects, for each mix preset, in LUFS: the
 * target minus the piece gain that gives {@link TARGET_LOUDNESS} (ITU-R BS.1770-4, integrated)
 * after the limiter and its trim. `pnpm loudness --fit --mix <name>` measures it for each full
 * demo, with the SoundFont of design 6.2, the velocity curve, the stage mix, the room of the
 * synth, and the code of `output-chain.ts` in an OfflineAudioContext of headless Chromium. For a
 * demo that the limiter does not touch, the value is the loudness with the piece gain 0 dB. A
 * demo with no fit yet has no value, and plays at 0 dB, as a file of the user does.
 */
export const DEMO_LOUDNESS: Readonly<
  Record<MixName, Readonly<Partial<Record<DemoId, number>>>>
> = {
  hall: {
    'boulanger-matin': -16.6,
    'beethoven-9': -9.2,
    'pachelbel-p37': -17.0,
    'beethoven-5-4': -11.9,
    'beethoven-7-4': -13.4,
    'beethoven-6-1': -16.1,
    'mozart-k525': -22.7,
    'bach-bwv1048': -16.3,
    'beethoven-8': -21.7,
    'mozart-k315': -17.8,
    'beethoven-1': -13.9,
    'brahms-2': -15.1,
    'beethoven-8-4': -15.3,
    'bach-bwv1047': -13.9,
    'bach-bwv1050': -17.9,
    'mendelssohn-op61': -17.6,
    'mozart-k417': -18.0,
    'mozart-k191': -16.0,
  },
  cinematic: {
    'boulanger-matin': -14.9,
    'beethoven-9': -7.2,
    'pachelbel-p37': -14.9,
    'beethoven-5-4': -9.6,
    'beethoven-7-4': -11.4,
    'beethoven-6-1': -14.0,
    'mozart-k525': -20.8,
    'bach-bwv1048': -13.9,
    'beethoven-8': -20.5,
    'mozart-k315': -15.3,
    'beethoven-1': -11.6,
    'brahms-2': -13.1,
    'beethoven-8-4': -13.7,
    'bach-bwv1047': -12.5,
    'bach-bwv1050': -16.0,
    'mendelssohn-op61': -15.8,
    'mozart-k417': -16.0,
    'mozart-k191': -14.6,
  },
};

/** The values of {@link DEMO_LOUDNESS}, for a lookup with any file name. */
const LOUDNESS_OF_FILE: Readonly<Record<MixName, ReadonlyMap<string, number>>> = {
  hall: new Map(Object.entries(DEMO_LOUDNESS.hall)),
  cinematic: new Map(Object.entries(DEMO_LOUDNESS.cinematic)),
};

/**
 * Gives the gain of a piece (design 6.8): the gain that brings a demo to
 * {@link TARGET_LOUDNESS}, and 0 dB for a file of the user and for `perf-60.mid`. The app gives
 * it to the `Player` as `PlayerScore.gainDb`. The limiter catches the peaks of a file of the
 * user.
 *
 * @param file The demo or `perf-60.mid`, or `null` for a file of the user.
 * @param mix The mix preset of the `Player`.
 * @returns The gain in dB, rounded to 0.1 dB.
 */
export function pieceGainDb(file: StageFile | null, mix: MixName): number {
  const loudness = file ? LOUDNESS_OF_FILE[mix].get(file) : undefined;
  return loudness === undefined ? 0 : Math.round((TARGET_LOUDNESS - loudness) * 10) / 10;
}
