/**
 * Prints the choice of the shot planner at each cut of a time range (design 5.6): the shots that
 * start in the range, the candidates that a rule drops, with the rule, and the other candidates in
 * the order of the search, with their scores, their ranks, and their tries in each elevation band.
 * The candidate whose try found the camera of the shot has the mark `chosen`.
 * Each try gives the counts of the refusals of its cameras, and the nearest refusal by the
 * distance against `CLOSE_DISTANCE_SHARE`. With `--cameras`, each tested camera follows with its
 * refusal. The plan comes from `traceShots()` of `src/shots/prepare.ts`, with the seed of the app.
 *
 * With `--base <ref>`, the commit and the working tree run at the same time, each in a child
 * process (`probeBeside()`), and the tool prints the shots and the trace of both. A commit with no
 * `traceShots()` gives only its shots.
 *
 * With `--rules`, the tool checks the shots of each demo against the rules of film grammar
 * (`tools/shot-rules.ts`) in place of a trace.
 *
 * Usage: pnpm shot-trace <demo> [--from <s>] [--to <s>] [--cameras] [--base <ref>] [--json <file>]
 *        pnpm shot-trace --rules [--demo <id>]... [--base <ref>] [--list] [--json <file>]
 */
import { writeFileSync } from 'node:fs';

import { patchedDemos } from './patch-demos.ts';
import { probeBeside, shortHash, withoutOptions } from './ref-tree.ts';
import { rulesMain } from './shot-rules.ts';
import { writeSmf } from '../src/midi/test-smf.ts';
import type { TestFile } from '../src/midi/test-smf.ts';
import { layoutScene } from '../src/models/layout-scene.ts';
import { ModelCache } from '../src/models/model-cache.ts';
import {
  stringQuartetFile,
  violinPianoDuoFile,
  windQuintetFile,
} from '../src/models/test-chamber.ts';
import { buildScore } from '../src/score/score.ts';
import { pianoSoloFile } from '../src/score/test-audit-files.ts';
import * as planner from '../src/shots/prepare.ts';
import type {
  AttemptTrace,
  CameraRefusal,
  CameraTrace,
  ChoiceRule,
  CutOutcome,
  CutTrace,
  SearchTrace,
} from '../src/shots/trace.ts';
import type { Shot } from '../src/shots/types.ts';

/** The chamber test files of the shot tests (design 4.2), by the name that the tool takes. */
const CHAMBER_FILES: ReadonlyMap<string, () => TestFile> = new Map([
  ['piano-solo', pianoSoloFile],
  ['violin-piano', violinPianoDuoFile],
  ['string-quartet', stringQuartetFile],
  ['wind-quintet', windQuintetFile],
]);

/** The usage text of `pnpm shot-trace`. */
const USAGE = `Usage: pnpm shot-trace <demo> [--from <s>] [--to <s>] [--cameras] [--base <ref>] [--json <file>], with a demo of demos/src, with or without .mid, or a chamber test file: ${[...CHAMBER_FILES.keys()].join(', ')}.`;

/** The options of `pnpm shot-trace`. */
export interface TraceOptions {
  /** The demo, with no `.mid`, or a key of {@link CHAMBER_FILES}. */
  readonly demo: string;
  /** The first cut of the range, in song seconds. */
  readonly fromSec: number;
  /** The last cut of the range, in song seconds. */
  readonly toSec: number;
  /** True to print each tested camera. */
  readonly cameras: boolean;
  /** The commit, the branch, or the tag to compare with the working tree, or `null`. */
  readonly base: string | null;
  /** The file into which the tool writes its lines as JSON, or `null` for none. */
  readonly json: string | null;
}

/**
 * Reads the options of `pnpm shot-trace`.
 *
 * @param args The arguments after the script.
 * @returns The options.
 * @throws Error if the demo is missing, if an option is not known or has no value, if a time is
 *   not a number, or if the range is empty.
 */
export function parseTraceOptions(args: readonly string[]): TraceOptions {
  const [first = '', ...rest] = args;
  if (first === '' || first.startsWith('--')) {
    throw new Error(USAGE);
  }
  let fromSec = -Infinity;
  let toSec = Infinity;
  let cameras = false;
  let base: string | null = null;
  let json: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i] ?? '';
    if (flag === '--cameras') {
      cameras = true;
      continue;
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`The option "${flag}" has no value.\n${USAGE}`);
    }
    i++;
    switch (flag) {
      case '--from':
        fromSec = timeValue(flag, value);
        break;
      case '--to':
        toSec = timeValue(flag, value);
        break;
      case '--base':
        base = value;
        break;
      case '--json':
        json = value;
        break;
      default:
        throw new Error(`The option "${flag}" is not known.\n${USAGE}`);
    }
  }
  if (fromSec > toSec) {
    throw new Error(`The range from ${fromSec} s to ${toSec} s is empty.`);
  }
  if (base !== null && json !== null) {
    throw new Error(`The options --base and --json do not go together.\n${USAGE}`);
  }
  return { demo: first.replace(/\.mid$/, ''), fromSec, toSec, cameras, base, json };
}

/**
 * Reads a time of the command line.
 *
 * @param flag The option, for the message.
 * @param text The text of the time, in seconds.
 * @returns The time.
 * @throws Error if the text is not a number.
 */
function timeValue(flag: string, text: string): number {
  const value = Number(text);
  if (text.trim() === '' || Number.isNaN(value)) {
    throw new Error(`The option ${flag} takes a time in seconds, and "${text}" is not one.`);
  }
  return value;
}

/** The text of each refusal of a camera, as the tool prints it. */
export const REFUSAL_TEXTS: Readonly<Record<CameraRefusal, string>> = {
  axis: 'over the line of the stage',
  look: 'look to the other side',
  jump: 'jump cut',
  repeat: 'repeat of the last framing',
  head: 'head in the foreground',
  near: 'animal too near',
  beamEdge: 'beam edge at the start',
  distance: 'distance share',
  beamSide: 'other beam side',
  camera: 'blocked camera',
  sight: 'blocked sight line',
  line: 'blocked line to the target',
  object: 'object in the foreground',
  face: 'own instrument over the eyes',
};

/** The text of each rule of the choice that drops a candidate, as the tool prints it. */
export const RULE_TEXTS: Readonly<Record<ChoiceRule, string>> = {
  subject: `rule 1, the subject of the previous shot`,
  group: 'rule 2, the group of the previous shot',
  wideSpacing: `rule 3, fewer than ${planner.SHOT_TIMES.wideSpacing} shots since the last wide or high shot`,
  wideRoom: 'rule 3, no room for the other shots before the last shot',
  conductorSpacing: `rule 3b, fewer than ${planner.SHOT_TIMES.conductorSpacing} shots since the last conductor shot`,
  sideSpacing: `rule 3c, fewer than ${planner.SHOT_TIMES.sideSpacing} shots since the last side view`,
};

/** The text of each end of the choice at a cut. */
const OUTCOME_TEXTS: Readonly<Record<CutOutcome, string>> = {
  candidate: 'a candidate fits',
  hold: 'no candidate fits, and the previous shot holds on',
  conductor: 'no candidate fits, and the conductor fills the time',
  wide: 'no candidate fits, and a wide shot fills the time',
};

/**
 * Writes an angle in degrees.
 *
 * @param radians The angle, in radians.
 * @returns The text, such as `87.0°`.
 */
function degrees(radians: number): string {
  return `${((radians * 180) / Math.PI).toFixed(1)}°`;
}

/**
 * Writes a time in song seconds. The first shot starts at `-Infinity`, and the last shot ends at
 * `Infinity`.
 *
 * @param seconds The time.
 * @returns The text.
 */
function timeText(seconds: number): string {
  return Number.isFinite(seconds) ? seconds.toFixed(2) : seconds > 0 ? 'end' : 'start';
}

/**
 * Writes the shots of a plan that start in a range as table rows.
 *
 * @param shots The shots of the plan.
 * @param fromSec The first time of the range.
 * @param toSec The last time of the range.
 * @returns The rows, one for each shot.
 */
export function shotRows(shots: readonly Shot[], fromSec: number, toSec: number): string[] {
  return shots
    .filter((shot) => shot.startSec >= fromSec - 1e-9 && shot.startSec <= toSec + 1e-9)
    .map((shot) => {
      const seats = shot.seats.length > 0 ? shot.seats.join(', ') : '-';
      const key = (k: Shot['from']): string =>
        `${degrees(k.azimuth)} ${degrees(k.elevation)} zoom ${k.zoom.toFixed(2)}`;
      return `| ${timeText(shot.startSec)} | ${timeText(shot.endSec)} | ${shot.kind} | ${seats} | ${key(shot.from)} | ${key(shot.to)} | ${shot.blendSec.toFixed(2)} |`;
    });
}

/** The header of the table of {@link shotRows}. */
export const SHOT_HEADER: readonly string[] = [
  '| Start s | End s | Kind | Seats | From (azimuth, elevation) | To | Blend s |',
  '|---:|---:|---|---|---|---|---:|',
];

/**
 * Writes the band of a try.
 *
 * @param attempt The try.
 * @returns The text, such as `band 2`, or `all bands` for the conductor that fills the time.
 */
function bandText(attempt: AttemptTrace): string {
  return attempt.band === null ? 'all bands' : `band ${attempt.band + 1}`;
}

/**
 * Writes a camera, such as `87.0° 17.0° arc 6.0°`.
 *
 * @param camera The camera.
 * @returns The text.
 */
function cameraText(camera: CameraTrace): string {
  return `${degrees(camera.azimuth)} ${degrees(camera.elevation)} arc ${degrees(camera.arc)}`;
}

/**
 * Writes the summary of a search: the subject, the band, the counts of the refusals, the nearest
 * refusal by the distance, and the camera of the shot.
 *
 * @param search The search.
 * @returns The text.
 */
export function searchSummary(search: SearchTrace): string {
  const counts = new Map<CameraRefusal, number>();
  for (const camera of search.cameras) {
    if (camera.refusal) {
      counts.set(camera.refusal, (counts.get(camera.refusal) ?? 0) + 1);
    }
  }
  const nearest = search.cameras
    .filter((camera) => camera.refusal === 'distance')
    .toSorted((a, b) => (a.share ?? 0) - (b.share ?? 0))[0];
  const refusals = [...counts].map(([refusal, n]) => {
    const share =
      refusal === 'distance' && nearest
        ? ` (nearest ${(nearest.share ?? 0).toFixed(4)} > ${planner.CLOSE_DISTANCE_SHARE.toFixed(2)} at ${cameraText(nearest)})`
        : '';
    return `${REFUSAL_TEXTS[refusal]} ${n}${share}`;
  });
  const found = search.cameras.find((camera) => camera.refusal === null);
  const [bottom, top] = search.band;
  const band = `${Number.isFinite(bottom) ? `above ${degrees(bottom)}` : 'from the lowest'} to ${degrees(top)}`;
  const tested = search.cameras.length - (found ? 1 : 0);
  return [
    `${search.subject} (front ${degrees(search.front)}, wanted ${degrees(search.wantedAzimuth)}, ${band}${search.full ? ', full' : ''}):`,
    `${tested} refused${refusals.length > 0 ? ` (${refusals.join(', ')})` : ''}, ${search.outsideFront} outside the front;`,
    found ? `camera ${cameraText(found)}` : 'no camera',
  ].join(' ');
}

/**
 * Writes the lines of the tries of a candidate or of the fill.
 *
 * @param attempts The tries.
 * @param cameras True to write each tested camera.
 * @returns The lines, with an indent.
 */
function attemptLines(attempts: readonly AttemptTrace[], cameras: boolean): string[] {
  const lines: string[] = [];
  for (const attempt of attempts) {
    if (attempt.searches.length === 0) {
      lines.push(
        `      ${bandText(attempt)}: ${attempt.found ? 'framed with no search' : 'no subject'}`,
      );
    }
    for (const search of attempt.searches) {
      lines.push(`      ${bandText(attempt)}: ${searchSummary(search)}`);
      if (cameras) {
        for (const camera of search.cameras) {
          const refusal = camera.refusal ? REFUSAL_TEXTS[camera.refusal] : 'the camera of the shot';
          const share = camera.share !== null ? ` ${camera.share.toFixed(4)}` : '';
          lines.push(
            `        ${cameraText(camera)}: ${refusal}${share}${camera.kept ? ' (kept)' : ''}`,
          );
        }
      }
    }
  }
  return lines;
}

/**
 * Writes the trace of the cuts as lines: for each cut, its end, the dropped candidates with their
 * rules, and the other candidates in the order of the search with their tries. The candidate whose
 * try found the camera of the shot (`CutTrace.chosen`) has the mark `chosen`.
 *
 * @param cuts The traced cuts.
 * @param cameras True to write each tested camera.
 * @returns The lines.
 */
export function cutLines(cuts: readonly CutTrace[], cameras: boolean): string[] {
  const lines: string[] = [];
  for (const cut of cuts) {
    lines.push('', `Cut ${cut.cutSec.toFixed(2)} s: ${OUTCOME_TEXTS[cut.outcome]}.`);
    for (const dropped of cut.dropped) {
      lines.push(`  Dropped ${dropped.id}: ${RULE_TEXTS[dropped.rule]}.`);
    }
    for (const [i, candidate] of cut.candidates.entries()) {
      const entering =
        candidate.entering.length > 0 ? `, entering ${candidate.entering.join(', ')}` : '';
      const tries = candidate.attempts.length > 0 ? '' : ', not tried';
      const chosen = cut.chosen === i ? ', chosen' : '';
      lines.push(
        `  ${i + 1}. ${candidate.id}: score ${candidate.score.toFixed(2)}, ${candidate.tier}${entering}${tries}${chosen}`,
      );
      lines.push(...attemptLines(candidate.attempts, cameras));
    }
    if (cut.fill.length > 0) {
      lines.push('  Fill: conductor');
      lines.push(...attemptLines(cut.fill, cameras));
    }
  }
  return lines;
}

/**
 * The format version of the JSON text of `--json` (`formatVersion()` of `tools/ref-tree.ts`). A
 * change of the format takes the next version, so that a compare with `--base` stops on two
 * formats.
 */
export const TRACE_FORMAT = 1;

/** The output of one tree, as `--json` writes it. */
export interface TraceOutput {
  /** True when the tree has `traceShots()`. */
  readonly traced: boolean;
  /** The rows of the shots that start in the range ({@link shotRows}). */
  readonly shots: readonly string[];
  /** The lines of the trace ({@link cutLines}), or none with no `traceShots()`. */
  readonly cuts: readonly string[];
}

/**
 * Writes the output of one tree as the JSON text of `--json`, with the format version
 * {@link TRACE_FORMAT}.
 *
 * @param output The output.
 * @returns The text.
 */
export function traceJson(output: TraceOutput): string {
  return JSON.stringify({ version: TRACE_FORMAT, ...output });
}

/**
 * Reads the bytes of a demo or of a chamber test file.
 *
 * @param demo The demo, with no `.mid`, or a key of {@link CHAMBER_FILES}.
 * @returns The bytes.
 * @throws Error if no demo and no chamber test file has the name.
 */
async function demoBytes(demo: string): Promise<Uint8Array> {
  const chamber = CHAMBER_FILES.get(demo);
  if (chamber) {
    return writeSmf(chamber());
  }
  const found = (await patchedDemos()).find((d) => d.file === `${demo}.mid`);
  if (!found) {
    throw new Error(`No demo and no chamber test file has the name ${demo}.\n${USAGE}`);
  }
  return found.bytes;
}

/**
 * Plans and traces the shots of a demo, as the app does: the section size "Auto" and the seed of
 * the app. A tree with no `traceShots()`, such as a commit of `--base` from before it, gives only
 * its shots.
 *
 * @param options The options.
 * @returns The output.
 * @throws Error if the demo is not valid.
 */
async function traceDemo(options: TraceOptions): Promise<TraceOutput> {
  const result = buildScore(await demoBytes(options.demo), 'auto');
  if (!result.ok) {
    throw new Error(`The demo is not valid: ${result.error}.`);
  }
  const models = new ModelCache();
  const layout = layoutScene(result.score, models);
  const range = { fromSec: options.fromSec, toSec: options.toSec };
  // A commit of --base runs this script on its own src/, which can lack traceShots().
  if (!Reflect.has(planner, 'traceShots')) {
    const plan = planner.prepareShots(result.score, layout, planner.SHOT_SEED, models);
    return { traced: false, shots: shotRows(plan.shots, range.fromSec, range.toSec), cuts: [] };
  }
  const trace = planner.traceShots(result.score, layout, planner.SHOT_SEED, range, models);
  return {
    traced: true,
    shots: shotRows(trace.plan.shots, range.fromSec, range.toSec),
    cuts: cutLines(trace.cuts, options.cameras),
  };
}

/**
 * Writes the range of the options.
 *
 * @param options The options.
 * @returns The text, such as `cuts from 30.00 s to 60.00 s`.
 */
function rangeText(options: TraceOptions): string {
  return `cuts from ${timeText(options.fromSec)} to ${timeText(options.toSec)}${Number.isFinite(options.toSec) ? ' s' : ''}`;
}

/**
 * Writes the output of one tree.
 *
 * @param name The name of the tree, such as `the working tree`.
 * @param output The output.
 * @param changed The rows of the shots to mark as changed.
 * @returns The lines.
 */
function outputLines(name: string, output: TraceOutput, changed: ReadonlySet<string>): string[] {
  const rows = output.shots.map((row) => (changed.has(row) ? `${row} changed` : row));
  return [
    '',
    `Shots of ${name} that start in the range:`,
    '',
    ...SHOT_HEADER,
    ...rows,
    '',
    output.traced
      ? `The choice at each cut of ${name}:`
      : `${name} has no traceShots(), so it gives only its shots.`,
    ...output.cuts,
  ];
}

/**
 * Traces the commit of `--base` and the working tree at the same time, each in a child process
 * (`probeBeside()`), and writes both. A row of a shot of the working tree that the commit does not
 * have ends with `changed`.
 *
 * @param options The options.
 * @param ref The commit, the branch, or the tag.
 */
async function compareTrace(options: TraceOptions, ref: string): Promise<void> {
  const label = `${ref} (${shortHash(ref)})`;
  const args = withoutOptions(process.argv.slice(2), ['--base']);
  const started = performance.now();
  const texts = await probeBeside(
    ref,
    'shot-trace.ts',
    { base: args, tree: args },
    { prefix: 'shot-trace-' },
  );
  // SAFETY: each text comes from the --json output of this script in a child process.
  const base = JSON.parse(texts.base) as TraceOutput;
  // SAFETY: as above.
  const tree = JSON.parse(texts.tree) as TraceOutput;
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const baseRows = new Set(base.shots);
  const changed = new Set(tree.shots.filter((row) => !baseRows.has(row)));
  console.log(
    `Shot trace of ${options.demo} on ${label} and on the working tree, ${rangeText(options)}: ${seconds} s.`,
  );
  console.log(
    `${changed.size} of ${tree.shots.length} shots of the working tree in the range differ from ${label}.`,
  );
  console.log(
    [
      ...outputLines(label, base, new Set()),
      ...outputLines('the working tree', tree, changed),
    ].join('\n'),
  );
}

/** Runs the tool: `node tools/shot-trace.ts <demo> [options]`, or the rules check with `--rules`. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--rules')) {
    await rulesMain(args);
    return;
  }
  const options = parseTraceOptions(args);
  if (options.base !== null) {
    await compareTrace(options, options.base);
    return;
  }
  const output = await traceDemo(options);
  if (options.json !== null) {
    writeFileSync(options.json, traceJson(output));
    return;
  }
  console.log(
    `Shot trace of ${options.demo} with the seed ${planner.SHOT_SEED}, ${rangeText(options)}.`,
  );
  console.log(outputLines('the working tree', output, new Set()).join('\n'));
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
