import { MathUtils, Quaternion, Vector3 } from 'three';
import { SCENE_COLORS } from './colors.ts';
import { PIANO_BENCH, buildPianoBench } from './instruments/piano.ts';
import { toQuat, toVec3 } from './tuples.ts';
import type { Vec3 } from './tuples.ts';
import { centeredBox } from './bounds.ts';
import type { Bounds } from './bounds.ts';
import type { RiserLevel, SceneLayout } from './layout.ts';
import { MeshBuilder, splitByFacing, srgb, transform } from './mesh.ts';
import type { MeshData, Rgb, Transform } from './mesh.ts';
import { box, quad } from './primitives.ts';
import { SPECIES } from './species.ts';
import type { SpeciesParams } from './species.ts';
import { studioBodyOf } from './studio-body.ts';
import type { StudioBody } from './studio-format.ts';

/**
 * The colors of the stage, the steps, the podium, and the choir risers (design 4.5, scene
 * colors), in linear values. The stage is glossy walnut, as in `mockup.png` and `scene.png`.
 */
export const STAGE_COLORS = {
  /**
   * The mean color of a plank. Each plank has its own tone around it. The light of the lit floor
   * comes mostly from the diffuse light of the wood (`STAGE_FINISH` of `scene/stage.ts`). The
   * darker walnut `#3b2618` then gives a lit floor that is too dark and too pale. The side lights
   * are a warm white, so the wood holds the amber itself: `#5e351a` gives a lit floor with a
   * saturation of 0.44 against 0.54 in `orchestra-latest.png`, and shadows that are too dark.
   * `#844c16` reads as a bright, even amber, and the stage looks over-exposed. The plank is 0.85
   * of it in linear values, so the lit players stand out of the floor.
   */
  plank: srgb('#7a4614'),
  /**
   * The dark line between two planks, at 0.68 of the plank color in linear values. The stage
   * shader finds a seam by this color, so no plank has it.
   */
  seam: srgb('#663a0f'),
  /**
   * The raised lip around the stage top, with a round top that catches the light. The lip and the
   * risers follow the plank color, by the same factor of each linear channel.
   */
  nosing: srgb('#84551f'),
  /** The skirt: the front and the sides of the stage, and the step rises. */
  skirt: srgb('#3c2416'),
  /** The grooves of the skirt panels. */
  groove: srgb('#26160d'),
  /** The body of the podium, and the frames around the panels of its sides. */
  podium: srgb('#6c4429'),
  /** The boards of the treads of the choir risers, lighter than the stage, as in `orchestra-side.png`. */
  riserTread: srgb('#784d1b'),
  /** The lighter front edge of each tread of the choir risers. */
  riserNosing: srgb('#ab742e'),
  /** The panels of the sides of the podium, inside their frames. */
  podiumPanel: srgb('#58371f'),
  /** The top plate of the podium and the frame of its top, a little lighter, as in `mockup.png`. */
  podiumTop: srgb('#80532f'),
  /** The panel of the top of the podium, inside its frame and a dark groove. */
  podiumTopPanel: srgb('#73492a'),
} as const satisfies Readonly<Record<string, Rgb>>;

/**
 * The item that a player sits or stands on (design 5.1). `stand` is the floor or the podium, and
 * `riser` is a level of the choir risers.
 */
export type Support = 'chair' | 'stool' | 'high-stool' | 'bench' | 'stand' | 'riser';

/**
 * The chair (design 4.5, props). The player sits on it and faces -z. The seat of each chair fits
 * the legs of its species (`seatHeights()`).
 */
export const CHAIR = {
  seatWidth: 0.42,
  seatDepth: 0.4,
  /**
   * The height of the top of the back above the seat. A lower seat has a lower back. The top rail
   * starts above the tail of the red fox, which passes the back posts up to 0.34 m above the seat.
   */
  back: 0.45,
  /**
   * The height of the one wide top rail of the back. The rail ends at the back top, and the back
   * is open below it, as on the chairs of `animals.webp`.
   */
  rail: 0.1,
} as const;

/** The heights of a seat (design 4.5, props). */
export interface SeatHeights {
  /** The height of the top of the seat above the floor, in meters. */
  readonly seatHeight: number;
  /**
   * The height of the rest under the feet, in meters: 0 for the floor, or the height of the foot
   * ring of the high stool.
   */
  readonly footHeight: number;
  /**
   * The depth of the seat of a chair or of the stool of the harp under a studio body, in meters
   * (`StudioBody.chairDepth`). The seat keeps the back of the chair, and its front edge is further
   * back. The piano bench under a studio body takes its depth from the haunch and the thighs
   * (`StudioBody.benchDepth`), at least `PIANO_BENCH.studioDepth`. The other seats, and the seats
   * under the parametric biped, keep their own depth.
   */
  readonly seatDepth?: number;
  /**
   * The reach of the front edge of the piano bench under a studio body in front of the floor
   * point, in meters: half the depth of its fit, so a deeper bench grows back. The other seats
   * stand around the floor point.
   */
  readonly seatFront?: number;
  /**
   * The width of the seat of a chair or of the stool of the harp under a studio body with a wide
   * haunch, in meters (`StudioBody.chairWidth`). The legs and the back posts stay at the side edges
   * of the seat.
   */
  readonly seatWidth?: number;
  /**
   * True when the app builds no chair under the body (`SpeciesParams.noChair`). The body keeps its
   * seated pose at these heights.
   */
  readonly noChair?: true;
}

/**
 * The stool of the harp (design 4.5, props), with no back. Under the parametric biped, its seat has
 * the height `seatHeight`, for the strings of the harp. Under a studio body, its seat fits the
 * legs, and it has the width and the depth of the seat of the chair of the body, as the chair does
 * (`seatHeights()`).
 */
export const STOOL = {
  seatHeight: 0.35,
  seatSize: 0.36,
} as const;

/**
 * The high stool of the contrabass (design 4.5, props). Its seat keeps its height for the
 * contrabass. The feet rest on a ring between the legs, at the legs of the species below the seat
 * (`seatHeights()`). No player sits on it since the hippo stands at its contrabass.
 */
export const HIGH_STOOL = {
  seatHeight: 0.7,
  seatSize: 0.36,
} as const;

/**
 * The depth of each level of the choir risers, the height of the lowest level, and the rise of
 * each higher level (design 4.5). The lowest level stands 1.0 m high, so that a large animal of
 * the back row hides no head of a singer.
 */
export const RISER = {
  /** The depth of each level, in meters. The singers stand on its middle. */
  depth: 0.8,
  /** The height of the lowest level above the stage top, in meters. */
  base: 1.0,
  /** The height of each higher level above the level in front of it, in meters. */
  rise: 0.25,
  /** The most levels. */
  levels: 3,
  /**
   * The steps in front of the lowest level, from the stage top up to it, as the wooden risers of
   * `orchestra-latest.png` and `orchestra-side.png`. The steps divide the height of the lowest
   * level evenly: three steps give the rise of 0.25 m of the levels. No singer stands on them.
   */
  steps: { count: 3, depth: 0.2 },
  /** The width of the lighter edge at the front of each tread, in meters. */
  nosing: 0.04,
  /** The widest board of a tread, in meters. A dark line divides a deeper tread into boards. */
  board: 0.4,
  /**
   * The arc of the risers past the outermost singer on each side, in meters at the lowest level.
   * The risers of `orchestra-latest.png` and `orchestra-side.png` reach past the choir.
   */
  wing: 1.0,
} as const;

/**
 * Gives the depth of the steps in front of the lowest level of the risers (design 4.5).
 *
 * @returns The depth, in meters.
 */
export function riserStepsDepth(): number {
  return RISER.steps.count * RISER.steps.depth;
}

/** The music stand (design 4.5, props). The reader is at +z and faces -z. */
export const MUSIC_STAND = {
  deskWidth: 0.5,
  deskDepth: 0.35,
  /**
   * The highest height of the middle of the desk above the floor, in meters. The desk of each
   * stand comes down from it for its readers ({@link standDeskHeight}).
   */
  deskHeight: 1.05,
  /**
   * The gap from the lowest eye of the readers of a stand down to the top edge of its desk, in
   * meters: the gap of the seated red fox to a desk of 1.05 m, from its lower eye bone at 1.325 m
   * to the top edge at 1.202 m.
   */
  eyeGap: 0.123,
  /** The lowest height of the middle of the desk above the floor, in meters. */
  lowestDesk: 0.6,
  /** The tilt of the desk toward the reader. */
  tilt: 30 * MathUtils.DEG2RAD,
  /** The length of each leg of the tripod base. */
  legLength: 0.24,
} as const;

/**
 * Gives the height of the desk of a music stand from the eyes of its readers (design 4.5, props):
 * the top edge of the desk lies {@link MUSIC_STAND} `eyeGap` below the lowest eye, so that the
 * desk never hides the eyes of its players. The middle of the desk stays from `lowestDesk` to
 * `deskHeight`.
 *
 * @param eyes The heights of the eyes of the readers above the floor, in meters.
 * @returns The height of the middle of the desk above the floor, in meters.
 */
export function standDeskHeight(eyes: readonly number[]): number {
  const s = MUSIC_STAND;
  const top = Math.min(...eyes) - s.eyeGap;
  const middle = top - (s.deskDepth / 2) * Math.cos(s.tilt);
  return Math.min(s.deskHeight, Math.max(s.lowestDesk, middle));
}

/** The width of the legs and of the back posts of the chair. */
export const CHAIR_LEG = 0.035;

/**
 * Gives the depth of the chair under a studio body (design 4.4): the chair of its seated bind, or
 * the chair of its seated pose for a standing body that also sits (`StudioBody.sitting`).
 *
 * @param studio The studio body.
 * @returns The depth, in meters, or `null` for a body with no chair.
 */
function studioChairDepth(studio: StudioBody): number | null {
  return studio.chairDepth ?? studio.sitting?.chairDepth ?? null;
}

/**
 * Gives the heights of the chair of a body (design 4.5, props): the seat at the legs of the
 * species. A studio body sits on a chair as deep as the chair of the studio (design 4.4), and a
 * wide studio body on a wider chair.
 *
 * @param species The species of the body.
 * @param legs The height of the seat above the floor, in meters.
 * @returns The heights.
 */
function chairHeights(species: SpeciesParams, legs: number): SeatHeights {
  const studio: StudioBody | null = species.body ? studioBodyOf(species.body) : null;
  const depth = studio ? studioChairDepth(studio) : null;
  if (!studio || depth === null) {
    return { seatHeight: legs, footHeight: 0 };
  }
  const seat = { seatHeight: legs, footHeight: 0, seatDepth: depth };
  return studio.chairWidth === undefined ? seat : { ...seat, seatWidth: studio.chairWidth };
}

/**
 * Gives the heights of the stool of the harp under a body (design 4.5, props): the seat at the
 * given height, and under a studio body the depth and the width of the seat of its chair
 * (`StudioBody.chairDepth`, `chairWidth`), as on the chair.
 *
 * @param species The species of the body.
 * @param seatHeight The height of the seat above the floor, in meters.
 * @returns The heights.
 */
function stoolHeights(species: SpeciesParams, seatHeight: number): SeatHeights {
  const studio: StudioBody | null = species.body ? studioBodyOf(species.body) : null;
  const depth = studio ? studioChairDepth(studio) : null;
  if (!studio || depth === null) {
    return { seatHeight, footHeight: 0 };
  }
  const seat = { seatHeight, footHeight: 0, seatDepth: depth };
  return studio.chairWidth === undefined ? seat : { ...seat, seatWidth: studio.chairWidth };
}

/**
 * Gives the heights of the piano bench under a body (design 4.5, props): the seat at the given
 * height, and under a studio body the depth that fits its haunch and its thighs
 * (`StudioBody.benchDepth`), with the front edge of the fit and at least
 * `PIANO_BENCH.studioDepth` of depth behind it, so the whole haunch sits on the bench.
 *
 * @param species The species of the body.
 * @param seatHeight The height of the seat above the floor, in meters.
 * @returns The heights.
 */
function benchHeights(species: SpeciesParams, seatHeight: number): SeatHeights {
  const studio: StudioBody | null = species.body ? studioBodyOf(species.body) : null;
  const seat = { seatHeight, footHeight: 0 };
  if (studio?.benchDepth === undefined) {
    return seat;
  }
  const depth = Math.max(studio.benchDepth, PIANO_BENCH.studioDepth);
  return { ...seat, seatDepth: depth, seatFront: studio.benchDepth / 2 };
}

/**
 * Gives the heights of the seat of a body on a support (design 4.5, props). The chair fits the
 * legs of the species: its seat is the `seatHeight` of the skeleton above the floor. A species
 * with no chair (`SpeciesParams.noChair`) keeps these heights, and the app builds no chair. The
 * high stool keeps its seat for the contrabass, and its foot ring is the `seatHeight` of the
 * skeleton below the seat. The stool of the harp and the piano bench keep their heights for the
 * parametric biped and the penguin. Under a studio body, such as the polar bear on its bench, they
 * fit the legs, as the chair does (design 4.4).
 *
 * @param support The support.
 * @param species The species of the body.
 * @returns The heights, or `null` for a standing body.
 */
export function seatHeights(support: Support, species: SpeciesParams): SeatHeights | null {
  const legs = species.seatHeight * species.headHeight;
  const studioLegs = species.body !== undefined;
  switch (support) {
    case 'chair': {
      const seat = chairHeights(species, legs);
      return species.noChair ? { ...seat, noChair: true } : seat;
    }
    case 'stool':
      return stoolHeights(species, studioLegs ? legs : STOOL.seatHeight);
    case 'high-stool':
      return { seatHeight: HIGH_STOOL.seatHeight, footHeight: HIGH_STOOL.seatHeight - legs };
    case 'bench':
      return benchHeights(species, studioLegs ? legs : PIANO_BENCH.seatHeight);
    case 'stand':
    case 'riser':
      return null;
    default: {
      const unhandled: never = support;
      throw new Error(`The support "${String(unhandled)}" is not known.`);
    }
  }
}

/**
 * Gives the boxes of the chair back: the two back legs, which go on up to the top of the back, and
 * the wide top rail (design 4.5). The back keeps its height above the seat. The seat center is
 * above the origin, and the back is at +z.
 *
 * @param seatHeight The height of the seat, in meters.
 * @param seatWidth The width of the seat, in meters (`SeatHeights.seatWidth`).
 * @returns The boxes.
 */
export function chairBack(seatHeight: number, seatWidth: number = CHAIR.seatWidth): Bounds[] {
  const c = CHAIR;
  const top = seatHeight + c.back;
  const x = seatWidth / 2 - CHAIR_LEG / 2;
  const z = c.seatDepth / 2 - CHAIR_LEG / 2;
  return [
    ...[-x, x].map((px) => centeredBox([px, top / 2, z], [CHAIR_LEG, top, CHAIR_LEG])),
    centeredBox([0, top - c.rail / 2, z], [seatWidth - 2 * CHAIR_LEG, c.rail, 0.025]),
  ];
}

/**
 * Gives the box of the chair seat: 0.04 m thick, with its top at the seat height (design 4.5). A
 * shorter seat keeps its back edge, so its front edge is further back.
 *
 * @param seatHeight The height of the seat, in meters.
 * @param seatDepth The depth of the seat, in meters.
 * @param seatWidth The width of the seat, in meters.
 * @returns The box.
 */
export function chairSeat(
  seatHeight: number,
  seatDepth: number = CHAIR.seatDepth,
  seatWidth: number = CHAIR.seatWidth,
): Bounds {
  const center = (CHAIR.seatDepth - seatDepth) / 2;
  return centeredBox([0, seatHeight - 0.02, center], [seatWidth, 0.04, seatDepth]);
}

/**
 * Adds a box part to a mesh.
 *
 * @param builder The mesh.
 * @param part The box.
 * @param color The color.
 */
function addBox(builder: MeshBuilder, part: Bounds, color: Rgb): void {
  const { min, max } = part;
  builder.add(box(max[0] - min[0], max[1] - min[1], max[2] - min[2]), {
    color,
    at: transform([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]),
  });
}

/**
 * Builds a chair: a seat, four legs, two back posts, and a wide top rail (design 4.5). The seat
 * center of the chair of design 4.5 is above the origin, and the back is at +z. A shorter seat
 * keeps the back, and its front edge is further back (`StudioBody.chairDepth`). A wider seat keeps
 * its legs and its back posts at its side edges (`StudioBody.chairWidth`).
 *
 * @param seatHeight The height of the seat, in meters.
 * @param seatDepth The depth of the seat, in meters.
 * @param seatWidth The width of the seat, in meters.
 * @returns The mesh data, with all vertices on bone 0.
 */
export function buildChair(
  seatHeight: number,
  seatDepth: number = CHAIR.seatDepth,
  seatWidth: number = CHAIR.seatWidth,
): MeshData {
  const c = { ...CHAIR, seatHeight, seatWidth };
  const builder = new MeshBuilder();
  const color = SCENE_COLORS.chair;
  const x = c.seatWidth / 2 - CHAIR_LEG / 2;
  const center = (c.seatDepth - seatDepth) / 2;
  const z = seatDepth / 2 - CHAIR_LEG / 2 - center;
  addBox(builder, chairSeat(seatHeight, seatDepth, seatWidth), color);
  for (const side of [-1, 1]) {
    // A front leg up to the seat. The back legs are the posts of the back.
    const legHeight = c.seatHeight - 0.04;
    addBox(
      builder,
      centeredBox([side * x, legHeight / 2, -z], [CHAIR_LEG, legHeight, CHAIR_LEG]),
      color,
    );
  }
  for (const part of chairBack(seatHeight, seatWidth)) {
    addBox(builder, part, color);
  }
  return builder.build();
}

/**
 * Builds a music stand: a tripod base, a post, a tilted desk, and a white sheet (design 4.5).
 * The post stands on the origin. The reader is at +z, so the desk faces +z.
 *
 * @param deskHeight The height of the middle of the desk above the floor, in meters
 *   ({@link standDeskHeight}).
 * @returns The mesh data, with all vertices on bone 0.
 */
export function buildMusicStand(deskHeight: number = MUSIC_STAND.deskHeight): MeshData {
  const s = { ...MUSIC_STAND, deskHeight };
  const builder = new MeshBuilder();
  const color = SCENE_COLORS.stand;
  for (let i = 0; i < 3; i++) {
    const turn = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      (i * 120 + 60) * MathUtils.DEG2RAD,
    );
    const center = new Vector3(0, 0, s.legLength / 2)
      .applyQuaternion(turn)
      .add(new Vector3(0, 0.05, 0));
    // Each leg leans 20° down from the post to the floor.
    const leanAxis = new Vector3(1, 0, 0).applyQuaternion(turn).normalize();
    const lean = new Quaternion().setFromAxisAngle(leanAxis, 20 * MathUtils.DEG2RAD);
    builder.add(box(0.015, 0.015, s.legLength), {
      color,
      at: transform(toVec3(center), toQuat(lean.multiply(turn))),
    });
  }
  builder.add(box(0.02, s.deskHeight, 0.02), { color, at: transform([0, s.deskHeight / 2, 0]) });
  // The desk is a vertical plate that leans back by the tilt, so that its face points to the reader.
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -s.tilt);
  const deskCenter = new Vector3(0, s.deskHeight, 0);
  addDesk(
    builder,
    box(s.deskWidth, s.deskDepth, 0.012),
    transform(toVec3(deskCenter), toQuat(tilt)),
  );
  // The sheet is one quad a little in front of the desk.
  const w = s.deskWidth / 2 - 0.04;
  const d = s.deskDepth / 2 - 0.04;
  const front = 0.0075;
  const corner = (cx: number, cy: number): Vec3 =>
    toVec3(new Vector3(cx, cy, front).applyQuaternion(tilt).add(deskCenter));
  builder.add(quad(corner(-w, -d), corner(w, -d), corner(w, d), corner(-w, d)), {
    color: SCENE_COLORS.sheet,
  });
  return builder.build();
}

/**
 * Adds the desk of a stand (design 4.5): its two large faces in a dark warm gray, and its four
 * narrow faces in a lighter color, so that the desk reads as an object with an edge.
 *
 * @param builder The builder.
 * @param plate The corner list of the desk plate, with its large faces along z.
 * @param at The place of the desk.
 */
export function addDesk(builder: MeshBuilder, plate: readonly number[], at: Transform): void {
  const [front, rest] = splitByFacing(plate, [0, 0, 1], 0.99);
  const [back, edges] = splitByFacing(rest, [0, 0, -1], 0.99);
  builder.add([...front, ...back], { color: SCENE_COLORS.standDesk, at });
  builder.add(edges, { color: SCENE_COLORS.standEdge, at });
}

/**
 * Builds a stool with four legs and no back: the stool of the harp, or the high stool of the
 * contrabass with its foot ring (design 4.5). The seat center is above the origin. Under a studio
 * body, the seat of the stool of the harp has the width and the depth of the seat of the chair of
 * the body (`SeatHeights.seatWidth`, `seatDepth`), with its back at the back of the chair and its
 * legs at its corners, so that the knees, the shins, and the hooves stay out of it.
 *
 * @param high True for the high stool.
 * @param seat The heights of the seat and of the foot ring. The stool of the harp has no ring.
 * @returns The mesh data, with all vertices on bone 0.
 */
export function buildStool(high: boolean, seat: SeatHeights): MeshData {
  const { seatHeight } = seat;
  const { seatSize } = high ? HIGH_STOOL : STOOL;
  const width = high ? seatSize : (seat.seatWidth ?? seatSize);
  const depth = high ? seatSize : (seat.seatDepth ?? seatSize);
  // A seat as deep as the seat of a studio body keeps the back of the chair, as the chair does
  // (`chairSeat()`): its front edge ends where the thighs leave it, behind the knees and the shins.
  const center = high || seat.seatDepth === undefined ? 0 : (CHAIR.seatDepth - depth) / 2;
  const builder = new MeshBuilder();
  const color = SCENE_COLORS.chair;
  addBox(builder, centeredBox([0, seatHeight - 0.02, center], [width, 0.04, depth]), color);
  const legHeight = seatHeight - 0.04;
  const at = seatSize / 2 - CHAIR_LEG / 2;
  const atX = width / 2 - CHAIR_LEG / 2;
  const atZ = depth / 2 - CHAIR_LEG / 2;
  for (const x of [-atX, atX]) {
    for (const z of [center - atZ, center + atZ]) {
      addBox(builder, centeredBox([x, legHeight / 2, z], [CHAIR_LEG, legHeight, CHAIR_LEG]), color);
    }
  }
  if (high) {
    // The foot ring: four rails between the legs, with their tops at the height of the ring.
    const rail = seatSize - 2 * CHAIR_LEG;
    const y = seat.footHeight - 0.0125;
    for (const side of [-at, at]) {
      addBox(builder, centeredBox([0, y, side], [rail, 0.025, 0.025]), color);
      addBox(builder, centeredBox([side, y, 0], [0.025, 0.025, rail]), color);
    }
  }
  return builder.build();
}

/**
 * Builds the seat of a player: the chair, a stool, the high stool, or the piano bench. The seat
 * center is above the origin, and the player sits on it and faces -z. A species with no chair
 * (`SeatHeights.noChair`) gets no chair.
 *
 * @param support The support of the player.
 * @param seat The heights of the seat ({@link seatHeights}), or `null` for a standing player.
 * @returns The mesh data, or `null` for a standing player or a body with no chair.
 */
export function buildSupport(support: Support, seat: SeatHeights | null): MeshData | null {
  if (!seat) {
    return null;
  }

  switch (support) {
    case 'chair':
      return seat.noChair ? null : buildChair(seat.seatHeight, seat.seatDepth, seat.seatWidth);
    case 'stool':
      return buildStool(false, seat);
    case 'high-stool':
      return buildStool(true, seat);
    case 'bench':
      return buildPianoBench(seat.seatHeight, seat.seatDepth, seat.seatFront);
    case 'stand':
    case 'riser':
      return null;
    default: {
      const unhandled: never = support;
      throw new Error(`The support "${String(unhandled)}" is not known.`);
    }
  }
}

/** The largest angle of one face of a riser arc. */
const RISER_FACET = 5 * MathUtils.DEG2RAD;

/** The width of the dark line between two boards of a tread, as between two planks of the stage. */
const PLANK_LINE = 0.012;

/** One arc block of the risers: a level or a step, around the podium center. */
interface RiserBlock {
  /** The distance of the front face from the podium center, in meters. */
  readonly inner: number;
  /** The distance of the back face from the podium center, in meters. */
  readonly outer: number;
  /** The height of the top above the stage top, in meters. */
  readonly height: number;
  /** Half the angle of the arc, in radians. The arc is centered on 0°. */
  readonly halfAngle: number;
}

/**
 * Gives the bands of the top of a tread from its front to its back: the lighter edge, then boards
 * of at most {@link RISER}.board with a dark line between two boards.
 *
 * @param inner The distance of the front of the tread from the podium center.
 * @param outer The distance of the back of the tread from the podium center.
 * @returns The bands: the start, the end, and the color.
 */
function treadBands(inner: number, outer: number): [number, number, Rgb][] {
  const line = PLANK_LINE / 2;
  const bands: [number, number, Rgb][] = [[inner, inner + RISER.nosing, STAGE_COLORS.riserNosing]];
  const start = inner + RISER.nosing;
  const boards = Math.ceil((outer - start) / RISER.board - 1e-9);
  const width = (outer - start) / boards;
  for (let i = 0; i < boards; i++) {
    const from = start + i * width + (i > 0 ? line : 0);
    const to = start + (i + 1) * width - (i < boards - 1 ? line : 0);
    bands.push([from, to, STAGE_COLORS.riserTread]);
    if (i < boards - 1) {
      bands.push([to, to + 2 * line, STAGE_COLORS.seam]);
    }
  }
  return bands;
}

/**
 * Adds one closed arc block of the risers: the top as a tread, the front, the back, and the two
 * ends.
 *
 * @param builder The builder.
 * @param block The block.
 * @param podium The podium center, the center of the arc.
 */
function addRiserBlock(builder: MeshBuilder, block: RiserBlock, podium: Vec3): void {
  const { inner, outer, height, halfAngle } = block;
  const point = (r: number, angle: number, y: number): Vec3 => [
    podium[0] + r * Math.sin(angle),
    podium[1] + y,
    podium[2] - r * Math.cos(angle),
  ];
  const segments = Math.max(1, Math.ceil((2 * halfAngle) / RISER_FACET));
  const sides: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a0 = -halfAngle + (2 * halfAngle * i) / segments;
    const a1 = -halfAngle + (2 * halfAngle * (i + 1)) / segments;
    for (const [from, to, color] of treadBands(inner, outer)) {
      builder.add(
        quad(
          point(from, a0, height),
          point(from, a1, height),
          point(to, a1, height),
          point(to, a0, height),
        ),
        { color },
      );
    }
    sides.push(
      ...quad(
        point(inner, a0, 0),
        point(inner, a1, 0),
        point(inner, a1, height),
        point(inner, a0, height),
      ),
      ...quad(
        point(outer, a0, 0),
        point(outer, a0, height),
        point(outer, a1, height),
        point(outer, a1, 0),
      ),
    );
  }
  sides.push(
    ...quad(
      point(inner, -halfAngle, 0),
      point(inner, -halfAngle, height),
      point(outer, -halfAngle, height),
      point(outer, -halfAngle, 0),
    ),
    ...quad(
      point(inner, halfAngle, 0),
      point(outer, halfAngle, 0),
      point(outer, halfAngle, height),
      point(inner, halfAngle, height),
    ),
  );
  builder.add(sides, { color: STAGE_COLORS.skirt });
}

/**
 * Builds the choir risers: one arc block for each level, from the stage top to the height of the
 * level, and the steps in front of the lowest level (design 4.5). Each tread has a lighter edge
 * at its front and boards of a wood a little lighter than the stage top, and the faces have the
 * color of the stage sides, as the wooden risers of `orchestra-latest.png` and `orchestra-side.png`.
 *
 * @param levels The levels of the layout.
 * @param podium The podium center, the center of the arcs.
 * @returns The mesh data in the stage axes, with all vertices on bone 0.
 */
export function buildRisers(levels: readonly RiserLevel[], podium: Vec3): MeshData {
  const builder = new MeshBuilder();
  for (const { level, radius, height, halfAngle } of levels) {
    const inner = radius - RISER.depth / 2;
    addRiserBlock(builder, { inner, outer: radius + RISER.depth / 2, height, halfAngle }, podium);
    if (level !== 0) {
      continue;
    }
    const { count, depth } = RISER.steps;
    for (let j = 1; j <= count; j++) {
      const step = {
        inner: inner - j * depth,
        outer: inner - (j - 1) * depth,
        height: (height * (count + 1 - j)) / (count + 1),
        halfAngle,
      };
      addRiserBlock(builder, step, podium);
    }
  }
  return builder.build();
}

/**
 * The box that a small wind player stands on (design 4.5, props): a wooden box, wider than a
 * chair seat, so that the feet and the tail on its top stay on it. The player stands on the
 * middle of its top and faces -z, and the box reaches further back, under the tail.
 */
export const STANDING_BOX = { width: 0.5, depth: 0.6, back: 0.1, rim: 0.03 } as const;

/**
 * Builds the box that a player stands on ({@link STANDING_BOX}) in the color of the chairs: a body
 * and a top that reaches a little past it.
 *
 * @param height The height of its top above the floor, in meters.
 * @returns The mesh data, with all vertices on bone 0.
 */
export function buildStandingBox(height: number): MeshData {
  const { width, depth, back, rim } = STANDING_BOX;
  const builder = new MeshBuilder();
  addBox(
    builder,
    centeredBox([0, (height - rim) / 2, back], [width, height - rim, depth]),
    SCENE_COLORS.chair,
  );
  addBox(
    builder,
    centeredBox([0, height - rim / 2, back], [width + 0.02, rim, depth + 0.02]),
    SCENE_COLORS.chair,
  );
  return builder.build();
}

/**
 * Builds the static props of a layout as one mesh: the seat of each player, each music stand,
 * and the choir risers (design 4.4). Each kind of seat at each height and depth and each stand
 * at each desk height is built one time.
 *
 * @param layout The layout of a score.
 * @returns The mesh data in the stage axes, with all vertices on bone 0.
 */
export function buildSceneProps(layout: SceneLayout): MeshData {
  const builder = new MeshBuilder();
  const seats = new Map<string, MeshData | null>();
  const place = (position: Vec3, facing: number): Transform =>
    transform(position, toQuat(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), facing)));
  for (const player of layout.players) {
    const { support, species } = player.cast;
    const heights = seatHeights(support, SPECIES[species]);
    const key = [
      support,
      heights?.seatHeight,
      heights?.footHeight,
      heights?.seatDepth,
      heights?.seatFront,
      heights?.seatWidth,
      heights?.noChair,
    ].join(' ');
    if (!seats.has(key)) {
      seats.set(key, buildSupport(support, heights));
    }
    const seat = seats.get(key);
    if (seat) {
      builder.addMesh(seat, place(player.position, player.facing));
    }
    const lift = player.position[1];
    if (support !== 'riser' && lift > 1e-6) {
      const boxKey = `box ${lift}`;
      const box = seats.get(boxKey) ?? buildStandingBox(lift);
      seats.set(boxKey, box);
      const [x, , z] = player.position;
      builder.addMesh(box, place([x, 0, z], player.facing));
    }
  }
  const stands = new Map<number, MeshData>();
  for (const at of layout.stands) {
    const stand = stands.get(at.deskHeight) ?? buildMusicStand(at.deskHeight);
    stands.set(at.deskHeight, stand);
    builder.addMesh(stand, place(at.position, at.facing));
  }
  if (layout.risers.length > 0) {
    builder.addMesh(buildRisers(layout.risers, layout.podium), transform());
  }
  return builder.build();
}
