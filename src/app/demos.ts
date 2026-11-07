import { spokenTime } from './time-text.ts';

/**
 * The hash ids of the demos, in the order of the demo list (design 8.2). The first one is the
 * default demo.
 */
export const DEMO_IDS = [
  'mozart-k191',
  'mozart-k417',
  'bach-bwv1050',
  'beethoven-9',
  'pachelbel-p37',
  'beethoven-5-4',
  'beethoven-7-4',
  'beethoven-6-1',
  'boulanger-matin',
  'mozart-k525',
  'bach-bwv1048',
  'beethoven-8',
  'mozart-k315',
  'beethoven-1',
  'brahms-2',
  'beethoven-8-4',
  'bach-bwv1047',
  'mendelssohn-op61',
  'sibelius-2-1',
  'sibelius-2-2',
  'sibelius-2-3-4',
] as const;

/** The hash id of one demo (design 8.2). */
export type DemoId = (typeof DEMO_IDS)[number];

/**
 * The default demo: the first demo of the list. The first screen shows it, and it is part of the
 * first download (design 2.2, 7.2).
 */
export const DEFAULT_DEMO: DemoId = DEMO_IDS[0];

/** A link of the credits dialog (design 2.8). */
export interface CreditLink {
  /** The text of the link. */
  readonly text: string;
  /** The URL. */
  readonly href: string;
}

/** The texts and the length of one demo (design 8.2). */
export interface DemoInfo {
  /**
   * The title of the piece at the top left of the page and in the demo list, in one pattern:
   * "{work}, {catalogue number}: {movement}".
   */
  readonly title: string;
  readonly composer: string;
  /** The credit line of the credits dialog. */
  readonly credit: string;
  /**
   * The links after the credit line: the source and the license of a CC BY file, because CC BY 4.0
   * asks for a link to the license, section 3(a)(1)(C) (design 8.1). No other demo has links.
   */
  readonly links?: readonly CreditLink[];
  /** The song length in whole seconds, from `wholeSeconds()` of `app/time-text.ts`. */
  readonly lengthSec: number;
}

/** The texts and the length of each demo (design 8.2). */
export const DEMOS = {
  'mozart-k191': {
    title: 'Bassoon Concerto, K. 191: III',
    composer: 'Wolfgang Amadeus Mozart',
    credit: 'Score: Mutopia Project, piece 686, public domain. Typeset by Maurizio Tomasi.',
    lengthSec: 224,
  },
  'mozart-k417': {
    title: 'Horn Concerto No. 2, K. 417: III',
    composer: 'Wolfgang Amadeus Mozart',
    credit: 'Score: Mutopia Project, piece 901, public domain. Typeset by Maurizio Tomasi.',
    lengthSec: 203,
  },
  'bach-bwv1050': {
    title: 'Brandenburg Concerto No. 5, BWV 1050: III',
    composer: 'Johann Sebastian Bach',
    credit: 'Score: Mutopia Project, piece 548, public domain. Typeset by Eric van der Velden.',
    lengthSec: 310,
  },
  'beethoven-9': {
    title: 'Symphony No. 9, Op. 125: Ode to Joy',
    composer: 'Ludwig van Beethoven',
    credit:
      'Score: OpenScore Orchestra, CC0. Bars 543 to 590 and 851 to 940 of the finale. MIDI file made with MuseScore 4.',
    lengthSec: 158,
  },
  'pachelbel-p37': {
    title: 'Canon in D, P. 37',
    composer: 'Johann Pachelbel',
    credit: 'Score: Mutopia Project, piece 2047, CC BY 4.0. Typeset by Michael Fischer v. Mollard.',
    links: [
      { text: 'Source', href: 'https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047' },
      { text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
    ],
    lengthSec: 245,
  },
  'beethoven-5-4': {
    title: 'Symphony No. 5, Op. 67: IV',
    composer: 'Ludwig van Beethoven',
    credit:
      'Score: OpenScore Orchestra, CC0. The exposition plays one time. MIDI file made with MuseScore 4.',
    lengthSec: 564,
  },
  'beethoven-7-4': {
    title: 'Symphony No. 7, Op. 92: IV',
    composer: 'Ludwig van Beethoven',
    credit:
      'Score: OpenScore Orchestra, CC0. The exposition plays one time. MIDI file made with MuseScore 4.',
    lengthSec: 420,
  },
  'beethoven-6-1': {
    title: 'Symphony No. 6, Op. 68: I',
    composer: 'Ludwig van Beethoven',
    credit:
      'Score: OpenScore Orchestra, CC0. The exposition plays one time. MIDI file made with MuseScore 4.',
    lengthSec: 467,
  },
  'boulanger-matin': {
    title: "D'un matin de printemps",
    composer: 'Lili Boulanger',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 280,
  },
  'mozart-k525': {
    title: 'Eine kleine Nachtmusik, K. 525: I',
    composer: 'Wolfgang Amadeus Mozart',
    credit: 'Score: Mutopia Project, piece 2230, public domain. Typeset by Mike Blackstock.',
    lengthSec: 248,
  },
  'bach-bwv1048': {
    title: 'Brandenburg Concerto No. 3, BWV 1048: I',
    composer: 'Johann Sebastian Bach',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 327,
  },
  'beethoven-8': {
    title: 'Symphony No. 8, Op. 93: II',
    composer: 'Ludwig van Beethoven',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 220,
  },
  'mozart-k315': {
    title: 'Andante in C, K. 315',
    composer: 'Wolfgang Amadeus Mozart',
    credit: 'Score: Mutopia Project, piece 344, public domain. Typeset by Maurizio Tomasi.',
    lengthSec: 255,
  },
  'beethoven-1': {
    title: 'Symphony No. 1, Op. 21: IV',
    composer: 'Ludwig van Beethoven',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 294,
  },
  'brahms-2': {
    title: 'Symphony No. 2, Op. 73: IV',
    composer: 'Johannes Brahms',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 752,
  },
  'beethoven-8-4': {
    title: 'Symphony No. 8, Op. 93: IV',
    composer: 'Ludwig van Beethoven',
    credit: 'Score: OpenScore Orchestra, CC0. MIDI file made with MuseScore 4.',
    lengthSec: 718,
  },
  'bach-bwv1047': {
    title: 'Brandenburg Concerto No. 2, BWV 1047: I',
    composer: 'Johann Sebastian Bach',
    credit: 'Score: Mutopia Project, piece 1680, public domain. Typeset by Allen Garvin.',
    lengthSec: 277,
  },
  'mendelssohn-op61': {
    title: "A Midsummer Night's Dream, Op. 61: V",
    composer: 'Felix Mendelssohn',
    credit: 'Score: Mutopia Project, piece 80, public domain. Typeset by Aaron Gage.',
    lengthSec: 148,
  },
  'sibelius-2-1': {
    title: 'Symphony No. 2, Op. 43: I',
    composer: 'Jean Sibelius',
    credit: 'MIDI file sequenced by Jack Gilbert.',
    lengthSec: 577,
  },
  'sibelius-2-2': {
    title: 'Symphony No. 2, Op. 43: II',
    composer: 'Jean Sibelius',
    credit: 'MIDI file sequenced by Jack Gilbert.',
    lengthSec: 823,
  },
  'sibelius-2-3-4': {
    title: 'Symphony No. 2, Op. 43: III and IV',
    composer: 'Jean Sibelius',
    credit: 'MIDI file sequenced by Jack Gilbert.',
    lengthSec: 1176,
  },
} as const satisfies Readonly<Record<DemoId, DemoInfo>>;

/**
 * Gives the `aria-label` of the row of a demo in the demo list (design 2.8): the title, the
 * composer, and the spoken length. A screen reader reads the texts of the row with no pause
 * between them, for example "printemps4:40Lili".
 *
 * @param id The demo.
 * @returns The label, for example "Symphony No. 8, Op. 93: II, Ludwig van Beethoven, 3 minutes 40
 *   seconds".
 */
export function demoRowLabel(id: DemoId): string {
  const demo = DEMOS[id];
  return `${demo.title}, ${demo.composer}, ${spokenTime(demo.lengthSec)}`;
}

/**
 * Finds if a text is the hash id of a demo.
 *
 * @param value The text.
 * @returns True for one of {@link DEMO_IDS}.
 */
export function isDemoId(value: string): value is DemoId {
  return DEMO_IDS.some((id) => id === value);
}

/**
 * Gives the URL of the file of a demo in the site (design 8.3).
 *
 * @param id The demo.
 * @param base The base URL of the site, with a slash at the end.
 * @returns The URL of `demos/<id>.mid`.
 */
export function demoUrl(id: DemoId, base: string): string {
  return `${base}demos/${id}.mid`;
}

/**
 * The id of `perf-60.mid`, the file of the frame target (design 9.5, 9.7). Only the dev server
 * shows it, with the section size "One per part". `tools/write-perf-60.ts` writes it into
 * `perf/`, which the build does not copy into `dist/`.
 */
export const PERF_60 = 'perf-60';

/** A file that the stage can show: a demo, or `perf-60.mid` on the dev server. */
export type StageFile = DemoId | typeof PERF_60;

/**
 * Selects the file of the URL hash `#demo=<id>` (design 2.2). Only on the dev server,
 * `#demo=perf-60` gives `perf-60.mid` (9.5).
 *
 * @param hash The hash of the URL, for example `#demo=beethoven-9`, or '' for none.
 * @param devServer True on the dev server.
 * @returns The file of the hash, or the default demo for a missing or unknown id.
 */
export function fileFromHash(hash: string, devServer: boolean): StageFile {
  const value = new URLSearchParams(hash.replace(/^#/u, '')).get('demo') ?? '';
  if (devServer && value === PERF_60) {
    return PERF_60;
  }
  return isDemoId(value) ? value : DEFAULT_DEMO;
}

/**
 * Gives the URL hash of a demo (design 2.2).
 *
 * @param id The demo.
 * @returns The hash, for example `#demo=beethoven-9`.
 */
export function demoHash(id: DemoId): string {
  return `#demo=${id}`;
}
