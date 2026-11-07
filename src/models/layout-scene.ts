import { runAll } from '../score/steps.ts';
import type { Steps } from '../score/steps.ts';
import type { Score, Seat } from '../score/types.ts';
import { castScore, chamberFormOf, CONDUCTOR } from './cast.ts';
import type { ChamberForm, PlayerCast, PlayingSection } from './cast.ts';
import { centeredBox } from './bounds.ts';
import {
  footprintOf,
  obstacleOf,
  obstaclesTouch,
  placeFootprint,
  playerFootprint,
  standFootprint,
} from './footprint.ts';
import type { Footprint, Obstacle, PlacedBox } from './footprint.ts';
import { FIRST_ROW_RADIUS, SEATED_ARC, STAND_DISTANCE, seatAt } from './layout.ts';
import type { ConductorPlace, PlayerPlace, RiserLevel, SceneLayout, StandPlace } from './layout.ts';
import type { Vec3 } from './tuples.ts';
import { ModelCache } from './model-cache.ts';
import type { PlayerModel } from './player.ts';
import { RISER, riserStepsDepth, standDeskHeight } from './props.ts';
import { boneIndex } from './rig.ts';
import { CONDUCTOR_STAND, PODIUM_FROM_FRONT, PODIUM_SIZE, keepsStageMargin } from './stage.ts';
import { pieceBounds } from './instruments/piece.ts';

/** The arc length of one singer on the risers (design 4.5, seat geometry). */
const SINGER_ARC = 0.6;

/**
 * The arc length of one vocal soloist (design 3.8, 4.5). The soloists stand on the lowest level
 * of the risers, in front of the choir, with space between them, so that they read as soloists.
 */
const VOCAL_SOLOIST_ARC = 1.2;

/** The smallest radius step from one row to the next (design 4.5, seat geometry). */
export const ROW_STEP = 1.2;

/** The largest angle of one side of a row: half of 160° (design 4.5, seat geometry). */
const HALF_SPAN = (80 * Math.PI) / 180;

/**
 * The smallest free space between the footprints of two items of the scene, in meters: two
 * players, a player and a stand, or two rows.
 */
export const FOOTPRINT_GAP = 0.05;

/**
 * The smallest free space between the footprint of a piano case and the footprint of a player in
 * a row behind it, in meters (design 4.5, seat geometry). A footprint is the bind pose, and a
 * player behind the case faces it and reaches toward it in play. With the gap of 0.05 m, the bow
 * arm of the hippo contrabass of `bach-bwv1050` touched the curved side of the case. With 0.15 m,
 * the nearest part keeps 14 cm through the whole song.
 */
const PIANO_REACH_GAP = 0.15;

/** The step by which a row, a stand, or a seat arc grows until it is clear, in meters. */
const CLEAR_STEP = 0.02;

/** The room for the chair and the margin at the edge of the stage (design 4.5, stage origin). */
const CHAIR_ROOM = 0.5;
const EDGE_MARGIN = 0.3;

/** The smallest stage side (design 4.5, stage origin). */
const SMALLEST_STAGE = 5;

/**
 * The place of the piano case center from the podium center: 2.0 m to the left and 0.8 m to the
 * front (design 4.5, seat geometry).
 */
const PIANO_CENTER = [-2.0, 0.8] as const;

/** The facing of the pianist: +x, toward the conductor (design 4.5, seat geometry). */
const PIANIST_FACING = -Math.PI / 2;

/**
 * The turn of a keyboard of the orchestra from the facing of its row: a quarter turn to the
 * left, so that the pianist faces along the arc toward the middle of the stage, and the case
 * lies along the row (design 4.5, seat geometry). At 0°, the keyboard thus has the facing of the
 * piano of a concerto: the pianist faces +x, and the lid opens to the audience. Facing the
 * podium, the case of 2.3 m with the bench pushed its row 2 m back.
 */
const KEYBOARD_TURN = Math.PI / 2;

/**
 * The place of a soloist that does not play the piano, from the podium center: 1.75 m to the
 * left and 0.35 m to the front (design 4.5, seat geometry). It is the front left of the
 * conductor, as in a concerto. The default view and the wide views then see the heads, the arms,
 * and the violins of the first desk beside the soloist: the K. 315 flute hides at most 8.9% of
 * a first-desk player, and 4.4% of its head, arms, and violin. With the wider cute heads, the place
 * of 1.8 m and 0.3 m hid 10% of the first violin. At 0.05 m to the front, it hid 17% of a
 * first-desk player in the default view. At 1.4 m to the left, the body of the bear stood in the
 * frame of the solo shots of the flute.
 */
export const SOLOIST_PLACE = [-1.75, 0.35] as const;

/**
 * The facing of a soloist that does not play the piano: the audience, turned 40° to the
 * conductor (design 4.5, seat geometry). Thus the default view sees the face of the soloist, and
 * the soloist sees the conductor at the side. With a turn of 30° at this place, the middle of
 * the bear stood 1% of the half width outside the frame of a solo shot of the K. 315 flute.
 */
export const SOLOIST_FACING = Math.PI + (40 * Math.PI) / 180;

/**
 * The values of the layout of a chamber group (design 4.2, 4.5). A score with at most 5 players
 * has no conductor and no podium, and its players sit in a small arc at the stage center and face
 * each other a little.
 */
export const CHAMBER = {
  /**
   * The smallest radius of the arc, in meters: the radius of row 0 of an orchestra. Thus two
   * players turn about 12° to each other, and a string quartet about 50° at its ends.
   */
  radius: FIRST_ROW_RADIUS,
  /**
   * The largest angle of a player from the middle of the arc: 60°. A larger arc moves back. Thus
   * the players at the ends of a quintet still show three quarters of their faces to the front.
   */
  halfSpan: (60 * Math.PI) / 180,
  /**
   * The partner of a pianist in a recital stands this far from the middle of the case toward its
   * tail, in front of the curved side of the case: the crook of the piano.
   */
  crook: 0.45,
  /**
   * The turn of the partner of a pianist in a recital from the audience to the pianist: 25°. The
   * partner and the pianist then see each other, and the audience sees the face of the partner.
   */
  turn: (25 * Math.PI) / 180,
} as const;

/** The facing of a player alone at the stage center: the audience (+z). */
const AUDIENCE_FACING = Math.PI;

/** The largest angle of one box of a riser arc, for the overlap check. */
const RISER_BOX_ANGLE = (5 * Math.PI) / 180;

/** How the players of a section use music stands (design 4.5, seat geometry). */
type StandUse = 'shared' | 'own' | 'none';

/** The string sections that sit in desks: the first desk in row 0, the other desks in row 1. */
type DeskSection = 'violin-1' | 'violin-2' | 'viola' | 'cello';

/**
 * The groups of the rows: the sections, the first violin seat, the other violin seats, and the
 * desks after the first desk of a string seat (the suffix `-b`). The soloist of the score
 * (design 3.8) has no row. The vocal soloists stand on the lowest level of the risers.
 */
type RowGroup = PlayingSection | DeskSection | `${DeskSection}-b` | 'soloist' | 'vocal-soloists';

/** The place of a group in its row: left of 0°, around 0°, or right of 0°. */
type RowSide = -1 | 0 | 1;

/**
 * The string sections in their wedges (design 4.5, seat geometry), as the seating plan of a
 * modern orchestra: from the left edge to the winds, the first violins and the other violins, and
 * from the winds to the right edge, the violas, the cellos, and the contrabasses. Each section
 * spreads over the string rows from the front, desk by desk, so that it keeps one wedge from the
 * front to the back. The contrabasses fill their wedge from the back.
 */
const STRING_WEDGES = {
  left: ['violin-1', 'violin-2'],
  right: ['viola', 'cello', 'contrabass'],
} as const;

/** The string wedge of a player. */
type StringWedge = (typeof STRING_WEDGES)['left' | 'right'][number];

/** The string players that one string row holds on its fuller side, at most. */
const STRING_ROW_PLAYERS = 7;

/** The most string rows. */
const MAX_STRING_ROWS = 4;

/**
 * The winds in the middle of each row from the front (design 4.5, seat geometry): no wind in the
 * row of the conductor, then the flutes and the oboes, the clarinets and the bassoons, and the
 * horns. The rows of the strings and of the winds are the same rows.
 */
const MIDDLE_ROWS: readonly (readonly RowGroup[])[] = [
  [],
  ['flute', 'oboe'],
  ['clarinet', 'bassoon'],
  ['horn'],
];

/**
 * The last row (design 4.5, seat geometry): the keyboard, the harp, and the percussion on the
 * left, the timpani and the trumpets in the middle, and the trombones and the tuba on the right.
 */
const BACK_ROW = {
  left: ['piano', 'harp', 'percussion'],
  center: ['timpani', 'trumpet'],
  right: ['trombone', 'tuba'],
} as const satisfies Readonly<Record<'left' | 'center' | 'right', readonly RowGroup[]>>;

/**
 * The order of the players in the arc of a chamber group, from left to right (design 4.5, seat
 * geometry). A keyboard sits at the left end and faces along the arc, as a keyboard of the
 * orchestra does. The other players follow the order of the rows, and the desks of a string seat
 * stay together. Thus a string quartet sits from the first violin on the left to the cello on the
 * right, as the classic quartet half circle.
 */
const CHAMBER_ORDER: readonly RowGroup[] = [
  'piano',
  'violin-1',
  'violin-1-b',
  'violin-2',
  'violin-2-b',
  'viola',
  'viola-b',
  'cello',
  'cello-b',
  'harp',
  'flute',
  'oboe',
  'horn',
  'clarinet',
  'bassoon',
  'trumpet',
  'percussion',
  'contrabass',
  'timpani',
  'trombone',
  'tuba',
  'choir',
];

/** The players of a desk: two players share one stand (design 4.5, seat geometry). */
const DESK_SIZE = 2;

/** The stands of each section: strings share one for two players, and winds have one each. */
const STAND_USE = {
  violin: 'shared',
  viola: 'shared',
  cello: 'shared',
  contrabass: 'shared',
  harp: 'none',
  piano: 'none',
  flute: 'own',
  oboe: 'own',
  clarinet: 'own',
  bassoon: 'own',
  horn: 'own',
  trumpet: 'own',
  trombone: 'own',
  tuba: 'own',
  timpani: 'none',
  percussion: 'none',
  choir: 'none',
} as const satisfies Readonly<Record<PlayingSection, StandUse>>;

/**
 * The sections whose players stand on a box, with the height of its top in meters (design 4.5,
 * props). The mouse of the oboes and the beaver of the bassoons stand with no chair, and they are
 * small, so the rows in front hid them. On the box, their heads come up to the heads of the
 * seated players around them.
 */
export const STANDING_BOXES: Partial<Readonly<Record<PlayingSection, number>>> = {
  oboe: 0.45,
  bassoon: 0.4,
};

/** One player that the layout places. */
interface Member {
  /** The index of the player in the cast and in `SceneLayout.players`. */
  readonly index: number;
  readonly cast: PlayerCast;
  /** The model of the player, from the model cache of the score. */
  readonly model: PlayerModel;
  /** The footprint in the axes of the row: the footprint of the model after {@link turn}. */
  readonly footprint: Footprint;
  /** The turn of the player from the facing of its row, in radians: 0, or a quarter turn. */
  readonly turn: number;
  /** The smallest arc of the player: 0.95 m, or 0.6 m for a singer. */
  readonly arc: number;
  readonly stand: StandUse;
  /**
   * The height of the lower eye of the model above the floor, in meters. The desk of each stand
   * that the player reads stays below it ({@link standDeskHeight}).
   */
  readonly eye: number;
  /** The distance of its own stand in front of the player, in meters. */
  readonly standDistance: number;
  /**
   * The height of the box that the player stands on, in meters ({@link STANDING_BOXES}), or 0
   * for the floor.
   */
  readonly lift: number;
}

/** A player or a stand with its place, relative to the podium center. */
interface Placed<T> {
  readonly place: T;
  readonly obstacle: Obstacle;
}

/** A placed player, with its index in `SceneLayout.players`. */
type PlacedPlayer = Placed<PlayerPlace> & { readonly index: number };

/** A placed stand, with the player that has it as its own stand, or -1 for a shared stand. */
type PlacedStand = Placed<StandPlace> & { readonly owner: number };

/** The players and the stands of one row at one radius. */
interface RowPlacement {
  readonly players: readonly PlacedPlayer[];
  readonly stands: readonly PlacedStand[];
}

/** The podium center: the origin of a layout before the stage size moves it. */
const CENTER: Vec3 = [0, 0, 0];

/**
 * Places a player at an angle and a radius around the podium center.
 *
 * @param member The player.
 * @param angle The angle. 0 points to the back, and negative angles are on the left.
 * @param radius The radius.
 * @param height The height of the floor under the player.
 * @returns The place and the obstacle.
 */
function placePlayer(member: Member, angle: number, radius: number, height = 0): PlacedPlayer {
  const spot = seatAt(CENTER, angle, radius);
  const position: Vec3 = [spot.position[0], height + member.lift, spot.position[2]];
  const { species, instrument, seatIndex, player } = member.cast;
  return {
    index: member.index,
    place: {
      position,
      facing: spot.facing + member.turn,
      cast: member.cast,
    },
    obstacle: obstacleOf(
      `${species} ${instrument} (seat ${seatIndex}, player ${player})`,
      placeFootprint(member.footprint, position, spot.facing),
    ),
  };
}

/**
 * Places a music stand in front of a row. Its readers face the podium, and so does the stand. Its
 * desk stays below the eyes of its readers ({@link standDeskHeight}).
 *
 * @param angle The angle of the stand.
 * @param distance The radius of the stand.
 * @param owner The index of the player that has it as its own stand, or -1.
 * @param readers The players who read from the stand.
 * @returns The place and the obstacle.
 */
function placeStand(
  angle: number,
  distance: number,
  owner: number,
  readers: readonly Member[],
): PlacedStand {
  const spot = seatAt(CENTER, angle, distance);
  const deskHeight = standDeskHeight(readers.map((reader) => reader.eye));
  return {
    owner,
    place: { position: spot.position, facing: spot.facing, deskHeight },
    obstacle: obstacleOf(
      `stand at ${((angle * 180) / Math.PI).toFixed(1)}°`,
      placeFootprint(standFootprint(deskHeight), spot.position, spot.facing),
    ),
  };
}

/**
 * Calculates the distance of the own stand of a wind player: 0.65 m in front of the player, or
 * further until the stand keeps the gap to the player and its instrument.
 *
 * @param footprint The footprint of the player.
 * @param deskHeight The height of the middle of the desk of the stand, in meters.
 * @returns The distance, in meters.
 */
function ownStandDistance(footprint: Footprint, deskHeight: number): number {
  const player = obstacleOf('player', placeFootprint(footprint, CENTER, 0));
  const desk = standFootprint(deskHeight);
  let distance = STAND_DISTANCE;
  for (;;) {
    // In the model axes, the player faces -z, and the stand faces the player.
    const stand = obstacleOf('stand', placeFootprint(desk, [0, 0, -distance], 0));
    if (!obstaclesTouch(player, stand, FOOTPRINT_GAP)) {
      return distance;
    }
    distance += CLEAR_STEP;
  }
}

/**
 * Finds if the next player in a row shares the stand of a string player. The players of a
 * string seat share one stand for each two: the players 0 and 1, then 2 and 3.
 */
function sharesWith(member: Member, next: Member | undefined): boolean {
  return (
    member.stand === 'shared' &&
    member.cast.player % 2 === 0 &&
    next?.cast.seatIndex === member.cast.seatIndex
  );
}

/**
 * Finds if a string player has no partner for its stand: the last player of a seat with an odd
 * count.
 */
function standsAlone(member: Member, next: Member | undefined): boolean {
  return member.stand === 'shared' && member.cast.player % 2 === 0 && !sharesWith(member, next);
}

/**
 * Calculates the arc from the seat center of one player to the next in a row. It is at least the
 * mean of their two smallest arcs. It grows until the two players, their own stands, and the
 * stand between them keep the gap (design 4.5). The stands also keep the gap from each other,
 * with the stand of the right player that it shares with its partner, or that stands where a
 * partner would share it.
 *
 * @param left The player on the left, as the audience sees it.
 * @param right The player on the right.
 * @param radius The radius of the row.
 * @returns The arc, in meters.
 */
function* spacingSteps(left: Member, right: Member, radius: number): Steps<number> {
  // The players face the podium, so the left neighbor is on the right side (+x) of a player.
  let arc = Math.max(
    (left.arc + right.arc) / 2,
    -left.footprint.bounds.min[0] + right.footprint.bounds.max[0] + FOOTPRINT_GAP,
  );
  for (;;) {
    const angle = arc / radius;
    const a = placePlayer(left, 0, radius);
    const b = placePlayer(right, angle, radius);
    const stands: PlacedStand[] = [];
    if (left.stand === 'own') {
      stands.push(placeStand(0, radius - left.standDistance, left.index, [left]));
    }
    if (right.stand === 'own') {
      stands.push(placeStand(angle, radius - right.standDistance, right.index, [right]));
    }
    if (sharesWith(left, right)) {
      stands.push(placeStand(angle / 2, radius - STAND_DISTANCE, -1, [left, right]));
    } else if (standsAlone(left, right)) {
      const alone = (yield* aloneStandArcSteps(left, radius)) / radius;
      stands.push(placeStand(alone, radius - STAND_DISTANCE, left.index, [left]));
    }
    // The right player starts a desk: its stand stands to its right, at half the arc to a
    // partner of its seat. Else the stands of the second violin and the viola of the string
    // quartet go into each other.
    const next =
      right.stand === 'shared' && right.cast.player % 2 === 0 && !sharesWith(left, right)
        ? [
            placeStand(
              angle + (yield* aloneStandArcSteps(right, radius)) / radius,
              radius - STAND_DISTANCE,
              -1,
              [right],
            ),
          ]
        : [];
    const clear =
      !obstaclesTouch(a.obstacle, b.obstacle, FOOTPRINT_GAP) &&
      stands.every(
        (stand) =>
          (stand.owner === left.index ||
            !obstaclesTouch(stand.obstacle, a.obstacle, FOOTPRINT_GAP)) &&
          (stand.owner === right.index ||
            !obstaclesTouch(stand.obstacle, b.obstacle, FOOTPRINT_GAP)),
      ) &&
      stands.every((stand, i) =>
        [...stands.slice(i + 1), ...next].every(
          (other) => !obstaclesTouch(stand.obstacle, other.obstacle, FOOTPRINT_GAP),
        ),
      );
    if (clear) {
      return arc;
    }
    arc += CLEAR_STEP;
    yield;
  }
}

/**
 * The arcs of {@link aloneStandArc} for each player and radius. The spread of a row places the
 * row many times at one radius, so the layout calculates each arc one time.
 */
const aloneStandArcs = new WeakMap<Member, Map<number, number>>();

/**
 * Calculates the arc from a string player with no partner to its stand. The stand stands where a
 * partner of the same seat would share it: half the arc to such a partner, to the right.
 */
function aloneStandArc(member: Member, radius: number): number {
  return aloneStandArcs.get(member)?.get(radius) ?? runAll(aloneStandArcSteps(member, radius));
}

/**
 * Calculates the arc from a string player with no partner to its stand as {@link aloneStandArc}
 * does, in steps (design 7.2).
 *
 * @param member The player.
 * @param radius The radius of the row.
 * @returns The steps, which return the arc in meters.
 */
function* aloneStandArcSteps(member: Member, radius: number): Steps<number> {
  const known = aloneStandArcs.get(member)?.get(radius);
  if (known !== undefined) {
    return known;
  }
  const partner: Member = { ...member, cast: { ...member.cast, player: member.cast.player + 1 } };
  const arc = (yield* spacingSteps(member, partner, radius)) / 2;
  const arcs = aloneStandArcs.get(member) ?? new Map<number, number>();
  arcs.set(radius, arc);
  aloneStandArcs.set(member, arcs);
  return arc;
}

/** The arc from the seat center of the leftmost player to the left end of its row. */
function leftEnd(member: Member): number {
  return Math.max(member.arc / 2, member.footprint.bounds.max[0] + FOOTPRINT_GAP / 2);
}

/** The arc from the seat center of the rightmost player to the right end of its row. */
function rightEnd(member: Member): number {
  return Math.max(member.arc / 2, -member.footprint.bounds.min[0] + FOOTPRINT_GAP / 2);
}

/** The arc positions of the players of a row, and the place of 0° on the arc. */
interface Arrangement {
  /** The arc position of each player. */
  readonly at: readonly number[];
  /** The arc position of 0°. */
  readonly zero: number;
  /** The smallest radius that keeps the row within 160°. */
  readonly radius: number;
}

/**
 * Places the players of a row on its arc (design 4.5, seat geometry). With sides, the middle of
 * the players around 0° is at 0°, or, with no such players, 0° is between the players of the
 * left and of the right, and each side spans at most 80°. With no sides, the row is centered on
 * 0°, and it spans at most 160°.
 *
 * @param members The players from left to right. There is at least one.
 * @param sides The side of each player in its row, or `null` for a row with no sides.
 * @param radius The radius at which the spacing is measured.
 * @param halfSpan The largest angle of one side: 80°, or 60° for the arc of a chamber group.
 * @returns The arrangement.
 */
function arrange(
  members: readonly Member[],
  sides: readonly RowSide[] | null,
  radius: number,
  halfSpan = HALF_SPAN,
): Arrangement {
  return runAll(arrangeSteps(members, sides, radius, halfSpan));
}

/**
 * Places the players of a row on its arc as {@link arrange} does, in steps (design 7.2).
 *
 * @param members The players from left to right. There is at least one.
 * @param sides The side of each player in its row, or `null` for a row with no sides.
 * @param radius The radius at which the spacing is measured.
 * @param halfSpan The largest angle of one side.
 * @returns The steps, which return the arrangement.
 */
function* arrangeSteps(
  members: readonly Member[],
  sides: readonly RowSide[] | null,
  radius: number,
  halfSpan = HALF_SPAN,
): Steps<Arrangement> {
  const at: number[] = [];
  for (const [i, member] of members.entries()) {
    const previous = members[i - 1];
    at.push(previous ? (at[i - 1] ?? 0) + (yield* spacingSteps(previous, member, radius)) : 0);
  }
  const first = members[0];
  const last = members.at(-1);
  const from = first ? -leftEnd(first) : 0;
  const to = last ? (at.at(-1) ?? 0) + rightEnd(last) : 0;
  if (!sides) {
    return { at, zero: (from + to) / 2, radius: (to - from) / (2 * halfSpan) };
  }
  const firstMiddle = sides.indexOf(0);
  const lastMiddle = sides.lastIndexOf(0);
  const lastLeft = sides.lastIndexOf(-1);
  let zero = from;
  const middleFirst = members[firstMiddle];
  const middleLast = members[lastMiddle];
  if (middleFirst && middleLast) {
    zero =
      ((at[firstMiddle] ?? 0) - leftEnd(middleFirst) + (at[lastMiddle] ?? 0) + rightEnd(middleLast)) /
      2;
  } else if (lastLeft === members.length - 1) {
    zero = to;
  } else if (lastLeft >= 0) {
    zero = ((at[lastLeft] ?? 0) + (at[lastLeft + 1] ?? 0)) / 2;
  }
  return { at, zero, radius: Math.max(zero - from, to - zero) / halfSpan };
}

/**
 * Calculates the angle of each player of a row from its arrangement.
 *
 * @param arrangement The arc positions of the players.
 * @param radius The radius of the row.
 * @returns The angles, in radians. 0 points to the back, and negative angles are on the left.
 */
function rowAngles(arrangement: Arrangement, radius: number): number[] {
  return arrangement.at.map((s) => (s - arrangement.zero) / radius);
}

/**
 * Places the players and the stands of a row at a radius around the podium center.
 *
 * @param members The players from left to right.
 * @param angles The angle of each player.
 * @param radius The radius of the row.
 * @param height The height of the floor of the row.
 * @returns The places, with their obstacles.
 */
function placeRow(
  members: readonly Member[],
  angles: readonly number[],
  radius: number,
  height = 0,
): RowPlacement {
  const players = members.map((member, i) => placePlayer(member, angles[i] ?? 0, radius, height));
  const stands: PlacedStand[] = [];
  members.forEach((member, i) => {
    const angle = angles[i] ?? 0;
    const next = members[i + 1];
    if (member.stand === 'own') {
      stands.push(placeStand(angle, radius - member.standDistance, member.index, [member]));
    } else if (next && sharesWith(member, next)) {
      stands.push(
        placeStand((angle + (angles[i + 1] ?? angle)) / 2, radius - STAND_DISTANCE, -1, [
          member,
          next,
        ]),
      );
    } else if (standsAlone(member, next)) {
      const arc = aloneStandArc(member, radius);
      stands.push(
        placeStand(angle + arc / radius, radius - STAND_DISTANCE, member.index, [member]),
      );
    }
  });
  return { players, stands };
}

/** An instrumental row with its radius, the angle of each player, and its places. */
interface FittedRow {
  /** The players from left to right. */
  readonly members: readonly Member[];
  /** The index of the row in {@link ROWS}. */
  readonly row: number;
  /** The side of each player in its row. */
  readonly sides: readonly RowSide[];
  /** True for a row with no players around 0°: its two sides meet at 0°. */
  readonly split: boolean;
  readonly radius: number;
  readonly angles: readonly number[];
  readonly placement: RowPlacement;
}

/**
 * Lists the obstacles of the players and the stands of a row.
 *
 * @param row The places of the row.
 * @returns The obstacles: the players, then the stands.
 */
function obstaclesOfRow(row: RowPlacement): Obstacle[] {
  return [...row.players, ...row.stands].map((p) => p.obstacle);
}

/**
 * Finds if new obstacles come closer than the gap to the obstacles already on the stage.
 *
 * @param fresh The new obstacles.
 * @param placed The obstacles on the stage.
 * @returns True if one pair touches.
 */
function touchesAny(fresh: readonly Obstacle[], placed: readonly Obstacle[]): boolean {
  return fresh.some((a) => placed.some((b) => obstaclesTouch(a, b, FOOTPRINT_GAP)));
}

/** The items that a row keeps clear of (design 4.5, seat geometry). */
interface RowClearance {
  /** The obstacles of the other items on the stage. Each item of the row keeps 0.05 m. */
  readonly placed: readonly Obstacle[];
  /** The piano cases in front of the row. Each player of the row keeps {@link PIANO_REACH_GAP}. */
  readonly pianosInFront: readonly Obstacle[];
  /** The players of the rows behind. Each piano case of the row keeps {@link PIANO_REACH_GAP}. */
  readonly playersBehind: readonly Obstacle[];
}

/**
 * Gives the obstacles of the piano cases of a row: the pianists with their pianos.
 *
 * @param row The places of the row.
 * @returns The obstacles of the pianists.
 */
function pianosOfRow(row: RowPlacement): Obstacle[] {
  return row.players.filter((p) => p.place.cast.instrument === 'piano').map((p) => p.obstacle);
}

/**
 * Finds if a row keeps its gaps: 0.05 m from each item, and {@link PIANO_REACH_GAP} between a
 * piano case and a player of a row behind it.
 *
 * @param row The places of the row.
 * @param clearance The items around the row.
 * @returns True if the row is clear.
 */
function rowClear(row: RowPlacement, clearance: RowClearance): boolean {
  const players = row.players.map((p) => p.obstacle);
  return (
    !touchesAny(obstaclesOfRow(row), clearance.placed) &&
    !players.some((a) =>
      clearance.pianosInFront.some((b) => obstaclesTouch(a, b, PIANO_REACH_GAP)),
    ) &&
    !pianosOfRow(row).some((a) =>
      clearance.playersBehind.some((b) => obstaclesTouch(a, b, PIANO_REACH_GAP)),
    )
  );
}

/**
 * Places a row at the smallest radius that keeps it within its span and clear of the items in
 * front (design 4.5, seat geometry).
 *
 * @param members The players of the row from left to right.
 * @param sides The side of each player in its row.
 * @param row The index of the row in {@link ROWS}.
 * @param smallest The radius of the previous row plus 1.2 m.
 * @param clearance The items on the stage, all in front of the row.
 * @returns The row with its radius, its angles, and its places.
 */
function* fitRowSteps(
  members: readonly Member[],
  sides: readonly RowSide[],
  row: number,
  smallest: number,
  clearance: RowClearance,
): Steps<FittedRow> {
  const split = !sides.includes(0);
  let radius = smallest;
  for (;;) {
    yield;
    const arrangement = yield* arrangeSteps(members, sides, radius);
    if (arrangement.radius > radius) {
      radius = Math.max(arrangement.radius, radius + CLEAR_STEP);
      continue;
    }
    const angles = rowAngles(arrangement, radius);
    const placement = placeRow(members, angles, radius);
    if (rowClear(placement, clearance)) {
      return { members, row, sides, split, radius, angles, placement };
    }
    radius += CLEAR_STEP;
  }
}

/**
 * Divides the singers evenly across the levels of the risers. The lower levels get the extra
 * singers.
 *
 * @param count The number of singers.
 * @param levels The number of levels.
 * @returns The number of singers on each level.
 */
export function divideSingers(count: number, levels: number): number[] {
  return Array.from(
    { length: levels },
    (_, k) => Math.floor(count / levels) + (k < count % levels ? 1 : 0),
  );
}

/**
 * Makes the obstacle of one riser level: one box for each part of at most 5° of its arc.
 *
 * @param level The level.
 * @param podium The podium center.
 * @returns The obstacle.
 */
function riserObstacle(level: RiserLevel, podium: Vec3): Obstacle {
  const parts = Math.max(1, Math.ceil((2 * level.halfAngle) / RISER_BOX_ANGLE));
  const step = (2 * level.halfAngle) / parts;
  const outer = level.radius + RISER.depth / 2;
  // The lowest level holds the steps in front of it, toward the podium (-z of a seat).
  const front = level.level === 0 ? riserStepsDepth() : 0;
  const size: Vec3 = [
    2 * outer * Math.sin(step / 2),
    level.height,
    RISER.depth + front + outer * (1 - Math.cos(step / 2)),
  ];
  const box = footprintOf([centeredBox([0, level.height / 2, -front / 2], size)]);
  const boxes = Array.from({ length: parts }, (_, i) => {
    const spot = seatAt(podium, -level.halfAngle + (i + 0.5) * step, level.radius);
    return placeFootprint(box, spot.position, spot.facing);
  }).flat();
  return obstacleOf(`riser level ${level.level}`, boxes);
}

/** The singers and the risers for one count of levels. */
interface ChoirPlacement {
  readonly singers: readonly PlacedPlayer[];
  readonly risers: readonly RiserLevel[];
  readonly obstacles: readonly Obstacle[];
}

/**
 * Places the singers on the risers behind the orchestra (design 4.5, seat geometry). The singers
 * fill the levels evenly. Level `k` has the radius `r + 0.8 k` and the height `1.0 + 0.25 k`. If a
 * level needs more than 160°, or if the risers touch the orchestra, all levels move back. The
 * vocal soloists (design 3.8) stand alone on the lowest level, in front of the choir.
 *
 * @param members The singers of the choir, in the order of the seats.
 * @param levels The number of levels of the choir.
 * @param smallest The radius of the last row plus 1.2 m.
 * @param placed The obstacles on the stage.
 * @param soloists The vocal soloists, or none.
 * @returns The singers and the risers.
 */
function fitChoir(
  members: readonly Member[],
  levels: number,
  smallest: number,
  placed: readonly Obstacle[],
  soloists: readonly Member[],
): ChoirPlacement {
  const groups: Member[][] = soloists.length > 0 ? [[...soloists]] : [];
  let next = 0;
  for (const count of divideSingers(members.length, levels)) {
    groups.push(members.slice(next, next + count));
    next += count;
  }
  let radius = smallest;
  for (;;) {
    const levelRadius = (k: number): number => radius + RISER.depth * k;
    const arrangements = groups.map((group, k) => arrange(group, null, levelRadius(k)));
    if (arrangements.some((a, k) => a.radius > levelRadius(k))) {
      radius += CLEAR_STEP;
      continue;
    }
    // All levels span the angle of the widest level of singers.
    const halfAngle = Math.max(
      ...arrangements.map((a, k) => (a.radius * HALF_SPAN) / levelRadius(k)),
    );
    const risers = groups.map((_, k): RiserLevel => ({
      level: k,
      radius: levelRadius(k),
      height: RISER.base + RISER.rise * k,
      halfAngle,
    }));
    const singers = groups.flatMap(
      (group, k) =>
        placeRow(
          group,
          rowAngles(arrangements[k] ?? arrange(group, null, 1), levelRadius(k)),
          levelRadius(k),
          RISER.base + RISER.rise * k,
        ).players,
    );
    const obstacles = [
      ...risers.map((level) => riserObstacle(level, CENTER)),
      ...singers.map((s) => s.obstacle),
    ];
    if (!touchesAny(obstacles, placed)) {
      return { singers, risers, obstacles };
    }
    radius += CLEAR_STEP;
  }
}

/** The step of the wing of the risers, in meters of arc at the lowest level. */
const WING_STEP = 0.02;

/**
 * Widens the risers after the stage size (design 4.5, seat geometry): each level reaches past
 * the outermost singer by the same wing on each side, up to {@link RISER}.wing, as the risers of
 * `orchestra-latest.png`. The wing is the largest that keeps each box 0.3 m from the outline of
 * the stage and 0.05 m from the other items. The stage side does not change.
 *
 * @param risers The levels of the risers, with the angle of the singers.
 * @param others The obstacles of the other items, relative to the podium center.
 * @param stage The stage side and the front distance.
 * @returns The levels with the wing.
 */
export function widenRisers(
  risers: readonly RiserLevel[],
  others: readonly Obstacle[],
  stage: StageSize,
): RiserLevel[] {
  const [first] = risers;
  if (!first) {
    return [];
  }
  for (let wing = RISER.wing; wing > 1e-9; wing -= WING_STEP) {
    const wide = risers.map((level) => ({
      ...level,
      halfAngle: level.halfAngle + wing / first.radius,
    }));
    const obstacles = wide.map((level) => riserObstacle(level, CENTER));
    const inside = obstacles.every((o) => o.boxes.every((b) => boxOnStage(b, stage)));
    if (inside && !touchesAny(obstacles, others)) {
      return wide;
    }
  }
  return [...risers];
}

/**
 * Places the conductor on the podium top, facing the orchestra (design 4.5).
 *
 * @param podium The podium center.
 * @returns The place of the conductor.
 */
export function conductorOn(podium: Vec3): ConductorPlace {
  return { position: [podium[0], podium[1] + PODIUM_SIZE[1], podium[2]], facing: 0 };
}

/** The label of the obstacle of the podium, the conductor stand, and the conductor. */
export const CONDUCTOR_OBSTACLE = 'podium and conductor';

/**
 * Makes the obstacle of the podium, the conductor stand, and the conductor.
 *
 * @param podium The podium center.
 * @param models The player models of the score.
 * @returns The obstacle.
 */
function conductorObstacle(podium: Vec3, models: ModelCache): Obstacle {
  const [width, height, depth] = PODIUM_SIZE;
  const stand = CONDUCTOR_STAND;
  const deskZ = -stand.forward;
  const boxes = footprintOf([
    centeredBox([0, height / 2, 0], [width, height, depth]),
    centeredBox(
      [0, (height + stand.deskHeight) / 2, deskZ],
      [2 * stand.baseRadius, height + stand.deskHeight, 2 * stand.baseRadius],
    ),
    centeredBox(
      [0, height + stand.deskHeight, deskZ],
      [
        stand.deskWidth,
        stand.deskDepth * Math.cos(stand.tilt) + 0.03,
        stand.deskDepth * Math.sin(stand.tilt) + 0.03,
      ],
    ),
  ]);
  const bear = playerFootprint(models.get(CONDUCTOR.species, CONDUCTOR.instrument));
  const conductor = conductorOn(podium);
  return obstacleOf(CONDUCTOR_OBSTACLE, [
    ...placeFootprint(boxes, podium, 0),
    ...placeFootprint(bear, conductor.position, conductor.facing),
  ]);
}

/**
 * Makes the obstacles of a layout: the podium with the conductor (when the layout has one), each
 * player with its instrument and its seat, each music stand, and each riser level. The overlap
 * test and the layout use the same footprints.
 *
 * @param layout The layout.
 * @param models The player models of the score. A new cache by default.
 * @returns The obstacles, in the stage axes.
 */
export function layoutObstacles(layout: SceneLayout, models = new ModelCache()): Obstacle[] {
  const players = layout.players.map((place) => {
    const { species, instrument, kettles, support, seatIndex, player } = place.cast;
    return obstacleOf(
      `${species} ${instrument} (seat ${seatIndex}, player ${player})`,
      placeFootprint(
        playerFootprint(models.get(species, instrument, kettles, support)),
        place.position,
        place.facing,
      ),
    );
  });
  const stands = layout.stands.map((stand, i) =>
    obstacleOf(
      `stand ${i}`,
      placeFootprint(standFootprint(stand.deskHeight), stand.position, stand.facing),
    ),
  );
  const risers = layout.risers.map((level) => riserObstacle(level, layout.podium));
  // The levels of the risers stand against each other, so they form one obstacle.
  const riserBlock =
    risers.length > 0
      ? [
          obstacleOf(
            'risers',
            risers.flatMap((r) => r.boxes),
          ),
        ]
      : [];
  const conductor = layout.conductor ? [conductorObstacle(layout.podium, models)] : [];
  return [...conductor, ...players, ...stands, ...riserBlock];
}

/**
 * Turns a footprint by a quarter turn to the left around y, as a facing of +π/2 turns a model.
 * A point (x, z) goes to (z, -x), so each box stays a box.
 *
 * @param footprint The footprint.
 * @returns The turned footprint.
 */
function quarterTurn(footprint: Footprint): Footprint {
  return footprintOf(
    footprint.boxes.map((b) => ({
      min: [b.min[2], b.min[1], -b.max[0]],
      max: [b.max[2], b.max[1], -b.min[0]],
    })),
  );
}

/**
 * Makes the member of the layout for one player.
 *
 * @param cast The cast of the player.
 * @param index The index of the player in the cast.
 * @param section The section of its seat.
 * @param models The player models of the score.
 * @param group The row group of the player. A keyboard of the orchestra (`piano`) turns by
 *   {@link KEYBOARD_TURN}, and a vocal soloist uses {@link VOCAL_SOLOIST_ARC}.
 * @returns The member.
 */
function memberOf(
  cast: PlayerCast,
  index: number,
  section: PlayingSection,
  models: ModelCache,
  group: RowGroup,
): Member {
  const turned = group === 'piano';
  const model = models.get(cast.species, cast.instrument, cast.kettles, cast.support);
  const footprint = turned ? quarterTurn(playerFootprint(model)) : playerFootprint(model);
  const stand = STAND_USE[section];
  // A soloist keeps the floor: it stands at the front, clear of the rows.
  const lift = group === 'soloist' ? 0 : (STANDING_BOXES[section] ?? 0);
  const eye =
    lift +
    Math.min(
      ...(['eyeL', 'eyeR'] as const).map(
        (bone) => model.skeleton.positions[boneIndex(bone)]?.[1] ?? Infinity,
      ),
    );
  return {
    index,
    cast,
    model,
    footprint,
    turn: turned ? KEYBOARD_TURN : 0,
    arc:
      group === 'vocal-soloists'
        ? VOCAL_SOLOIST_ARC
        : section === 'choir'
          ? SINGER_ARC
          : SEATED_ARC,
    stand,
    eye,
    standDistance:
      stand === 'own' ? ownStandDistance(footprint, standDeskHeight([eye])) : STAND_DISTANCE,
    lift,
  };
}

/**
 * Finds the row group of a player.
 *
 * @param seat The seat of the player.
 * @param player The index of the player in its seat.
 * @returns The group: the section, the first violin seat, or the other violin seats. A violin,
 *   viola, or cello player after the first desk gets the group with the suffix `-b`.
 */
function groupOf(seat: Seat, player: number): RowGroup {
  if (seat.section === 'sound-only') {
    return 'choir';
  }
  let desk: DeskSection;
  if (seat.section === 'violin') {
    desk = seat.indexInSection === 0 ? 'violin-1' : 'violin-2';
  } else if (seat.section === 'viola' || seat.section === 'cello') {
    desk = seat.section;
  } else {
    return seat.section;
  }
  return player < DESK_SIZE ? desk : `${desk}-b`;
}

/** The items of a layout with the podium center at the origin. */
interface Draft {
  readonly players: readonly (PlayerPlace | undefined)[];
  readonly stands: readonly StandPlace[];
  readonly risers: readonly RiserLevel[];
  readonly obstacles: readonly Obstacle[];
  /** The largest z of the soloist, with its instrument, or -Infinity with no soloist. */
  readonly soloistFront: number;
}

/** The stage side `S` and the front distance `F` (design 4.5, stage origin), in meters. */
interface StageSize {
  /** The stage side `S`, in meters. */
  readonly side: number;
  /** The front distance `F` from the front edge to the podium center, in meters. */
  readonly front: number;
}

/**
 * Calculates the stage side and the front distance of a draft (design 4.5, stage origin). The
 * half width `L` is the largest `|x|` of a seat plus 0.5 m for the chair and 0.3 m of margin, or
 * of a footprint box plus 0.3 m. The depth `D` follows the same rule behind the podium.
 *
 * @param draft The draft, with the podium center at the origin.
 * @returns The stage side `S` and the front distance `F`.
 */
function stageOf(draft: Draft): StageSize {
  const seats = draft.players.filter((p): p is PlayerPlace => p !== undefined);
  const boxes = draft.obstacles.flatMap((o) => o.boxes);
  const reachX = (b: PlacedBox): number => b.halfX * Math.abs(b.cos) + b.halfZ * Math.abs(b.sin);
  const reachZ = (b: PlacedBox): number => b.halfX * Math.abs(b.sin) + b.halfZ * Math.abs(b.cos);
  const halfWidth = Math.max(
    ...seats.map((p) => Math.abs(p.position[0]) + CHAIR_ROOM + EDGE_MARGIN),
    ...boxes.map((b) => Math.abs(b.x) + reachX(b) + EDGE_MARGIN),
  );
  const front = Math.max(PODIUM_FROM_FRONT, draft.soloistFront + EDGE_MARGIN);
  const behind = Math.max(
    0,
    ...seats.map((p) => -p.position[2] + CHAIR_ROOM + EDGE_MARGIN),
    ...boxes.map((b) => -b.z + reachZ(b) + EDGE_MARGIN),
  );
  return { side: Math.max(SMALLEST_STAGE, 2 * halfWidth, front + behind), front };
}

/**
 * Places the pianist with the piano and the bench, with the long axis of the case along x and the
 * keys at the left end. The pianist faces +x (design 4.5, seat geometry). The case center of a
 * soloist is 2.0 m to the left of the podium center and 0.8 m to the front, and the pianist faces
 * the conductor.
 *
 * @param member The pianist.
 * @param center The x and the z of the case center, relative to the podium center.
 * @returns The place of the pianist, its obstacle, and the largest z of the piano.
 */
function placePiano(
  member: Member,
  center: readonly [x: number, z: number] = PIANO_CENTER,
): PlacedPlayer & { readonly front: number } {
  const piano = member.model.pieces.find((p) => p.piece.bone === 'instrument');
  const bounds = piano ? pieceBounds(piano.piece) : { min: CENTER, max: CENTER };
  const offset = piano?.at.position ?? CENTER;
  const cx = offset[0] + (bounds.min[0] + bounds.max[0]) / 2;
  const cz = offset[2] + (bounds.min[2] + bounds.max[2]) / 2;
  // Facing +x moves a point (x, z) of the model to (-z, x).
  const position: Vec3 = [center[0] + cz, 0, center[1] - cx];
  return {
    index: member.index,
    place: {
      position,
      facing: PIANIST_FACING,
      cast: member.cast,
    },
    obstacle: obstacleOf(
      `${member.cast.species} piano`,
      placeFootprint(member.footprint, position, PIANIST_FACING),
    ),
    front: position[2] + offset[0] + bounds.max[0],
  };
}

/**
 * Places the soloist of the score at the front left of the conductor (design 4.2, 4.5). The
 * pianist sits at the piano ({@link placePiano}). Another soloist stands or sits at
 * {@link SOLOIST_PLACE}, faces the audience, and turns 40° to the conductor. It has no music
 * stand, because a soloist plays from memory.
 *
 * @param member The soloist.
 * @returns The place of the soloist, its obstacle, and the largest z of its footprint.
 */
function placeSoloist(member: Member): PlacedPlayer & { readonly front: number } {
  if (member.cast.instrument === 'piano') {
    return placePiano(member);
  }
  const position: Vec3 = [SOLOIST_PLACE[0], 0, SOLOIST_PLACE[1]];
  const obstacle = obstacleOf(
    `${member.cast.species} ${member.cast.instrument} (seat ${member.cast.seatIndex}, player ${member.cast.player})`,
    placeFootprint(member.footprint, position, SOLOIST_FACING),
  );
  const front = Math.max(
    ...obstacle.boxes.map((b) => b.z + b.halfX * Math.abs(b.sin) + b.halfZ * Math.abs(b.cos)),
  );
  return {
    index: member.index,
    place: { position, facing: SOLOIST_FACING, cast: member.cast },
    obstacle,
    front,
  };
}

/**
 * Places the players of a chamber group in one arc around the podium center, centered on 0°
 * (design 4.5, seat geometry). The arc has a radius of at least 2.4 m, and it moves back until
 * each player is within 60° of its middle. The players face the podium center, so they face each
 * other a little.
 *
 * @param members The players from left to right.
 * @returns The places of the players and of their stands.
 */
function fitArc(members: readonly Member[]): RowPlacement {
  let radius: number = CHAMBER.radius;
  for (;;) {
    const arrangement = arrange(members, null, radius, CHAMBER.halfSpan);
    if (arrangement.radius <= radius) {
      return placeRow(members, rowAngles(arrangement, radius), radius);
    }
    radius = Math.max(arrangement.radius, radius + CLEAR_STEP);
  }
}

/**
 * Places the partner of a pianist in a recital: in front of the curved side of the case, 0.45 m
 * from its middle toward the tail, as in the crook of the piano. The partner faces the audience
 * and turns 25° to the pianist. It moves toward the audience until it keeps the gap from the
 * piano. It has no music stand, as the soloist of design 4.5.
 *
 * @param member The partner.
 * @param middle The x and the z of the case center.
 * @param piano The pianist with the piano.
 * @returns The place of the partner and its obstacle.
 */
function placeInCrook(
  member: Member,
  middle: readonly [x: number, z: number],
  piano: PlacedPlayer,
): PlacedPlayer {
  const facing = AUDIENCE_FACING - CHAMBER.turn;
  const { species, instrument, seatIndex, player } = member.cast;
  for (let z = middle[1]; ; z += CLEAR_STEP) {
    const position: Vec3 = [middle[0] + CHAMBER.crook, 0, z];
    const obstacle = obstacleOf(
      `${species} ${instrument} (seat ${seatIndex}, player ${player})`,
      placeFootprint(member.footprint, position, facing),
    );
    if (!obstaclesTouch(obstacle, piano.obstacle, FOOTPRINT_GAP)) {
      return {
        index: member.index,
        place: { position, facing, cast: member.cast },
        obstacle,
      };
    }
  }
}

/**
 * Places a player alone at a point, facing the audience, with no music stand (design 4.5). A
 * pianist sits at the piano, with the case center at the point.
 *
 * @param member The player.
 * @param middle The x and the z of the point.
 * @returns The place of the player and its obstacle.
 */
function placeAlone(member: Member, middle: readonly [x: number, z: number]): PlacedPlayer {
  if (member.cast.instrument === 'piano') {
    return placePiano(member, middle);
  }
  const position: Vec3 = [middle[0], 0, middle[1]];
  const { species, instrument, seatIndex, player } = member.cast;
  return {
    index: member.index,
    place: {
      position,
      facing: AUDIENCE_FACING,
      cast: member.cast,
    },
    obstacle: obstacleOf(
      `${species} ${instrument} (seat ${seatIndex}, player ${player})`,
      placeFootprint(member.footprint, position, AUDIENCE_FACING),
    ),
  };
}

/** The stage of a chamber group, and the move of its items onto the stage. */
interface ChamberStage {
  /** The stage side `S`, in meters. */
  readonly side: number;
  /** The move that puts the middle of the group at the stage center. */
  readonly shift: Vec3;
}

/**
 * Calculates the stage of a chamber group (design 4.5, stage origin). The rule of the orchestra
 * applies from the middle of the group in place of the podium center: each seat needs 0.5 m for
 * the chair and 0.3 m of margin, and each footprint box 0.3 m of margin, on each side. The stage
 * side is at least 5 m, and the middle of the group goes to the stage center.
 *
 * @param players The places of the players, relative to the podium center.
 * @param stands The places of the stands.
 * @returns The stage side, and the move that puts the middle of the group at the origin.
 */
function chamberStage(
  players: readonly PlacedPlayer[],
  stands: readonly PlacedStand[],
): ChamberStage {
  const low = [Infinity, Infinity];
  const high = [-Infinity, -Infinity];
  const add = (x: number, z: number, reachX: number, reachZ: number): void => {
    low[0] = Math.min(low[0] ?? 0, x - reachX);
    low[1] = Math.min(low[1] ?? 0, z - reachZ);
    high[0] = Math.max(high[0] ?? 0, x + reachX);
    high[1] = Math.max(high[1] ?? 0, z + reachZ);
  };
  const seat = CHAIR_ROOM + EDGE_MARGIN;
  for (const p of players) {
    add(p.place.position[0], p.place.position[2], seat, seat);
  }
  for (const b of [...players, ...stands].flatMap((p) => p.obstacle.boxes)) {
    add(
      b.x,
      b.z,
      b.halfX * Math.abs(b.cos) + b.halfZ * Math.abs(b.sin) + EDGE_MARGIN,
      b.halfX * Math.abs(b.sin) + b.halfZ * Math.abs(b.cos) + EDGE_MARGIN,
    );
  }
  const [x0 = 0, z0 = 0] = low;
  const [x1 = 0, z1 = 0] = high;
  return {
    side: Math.max(SMALLEST_STAGE, x1 - x0, z1 - z0),
    shift: [-(x0 + x1) / 2, 0, -(z0 + z1) / 2],
  };
}

/**
 * Calculates the layout of a chamber group: a score with at most 5 players (design 4.2, 4.5).
 * It has no conductor and no podium. One player sits or stands at the stage center and faces
 * the audience. The partner of a pianist stands in the crook of the piano. Other groups sit in a
 * small arc ({@link fitArc}). The soloist rule of design 3.8 does not move a player.
 *
 * @param form The form of the group.
 * @param members The players, in the order of the cast.
 * @param cast The cast, for the check of {@link placesOfCast}.
 * @param groups The row group of each player.
 * @returns The layout.
 */
function layoutChamber(
  form: ChamberForm,
  members: readonly Member[],
  cast: readonly PlayerCast[],
  groups: readonly RowGroup[],
): SceneLayout {
  // The group stands where the first row of an orchestra sits: 2.4 m behind the podium center.
  const middle = [0, -CHAMBER.radius] as const;
  let placed: PlacedPlayer[] = [];
  let stands: readonly PlacedStand[] = [];
  if (form === 'arc') {
    const order = CHAMBER_ORDER.flatMap((group) =>
      members.filter((m) => groups[m.index] === group),
    );
    const arc = fitArc(order);
    placed = [...arc.players];
    stands = arc.stands;
  } else {
    const piano = members.find((m) => m.cast.instrument === 'piano');
    const pianist = piano ? placeAlone(piano, middle) : null;
    placed = members.map((m) => {
      if (pianist && m === piano) {
        return pianist;
      }
      return pianist ? placeInCrook(m, middle, pianist) : placeAlone(m, middle);
    });
  }
  const stage = chamberStage(placed, stands);
  const [dx, , dz] = stage.shift;
  const move = (p: Vec3): Vec3 => [p[0] + dx, p[1], p[2] + dz];
  const places: (PlayerPlace | undefined)[] = members.map(() => undefined);
  for (const p of placed) {
    places[p.index] = p.place;
  }
  return {
    stageSide: stage.side,
    podium: move(CENTER),
    conductor: null,
    players: placesOfCast(places, cast).map((p): PlayerPlace => ({
      position: move(p.position),
      facing: p.facing,
      cast: p.cast,
    })),
    stands: stands.map((stand): StandPlace => ({
      position: move(stand.place.position),
      facing: stand.place.facing,
      deskHeight: stand.place.deskHeight,
    })),
    risers: [],
  };
}

/** The limits of the spread of a row (design 4.5, seat geometry). */
interface SpreadLimits {
  /** The largest angle of a seat from 0°, in radians: 90°. */
  readonly maxAngle: number;
  /** The largest arc between two neighbors of a row, in meters: 1.6. */
  readonly maxArc: number;
}

/**
 * The limits of the spread (design 4.5, seat geometry). In the reference image, the seats reach
 * ±90°, and two neighbors are 1.1 to 1.7 m apart.
 */
export const SPREAD_LIMITS: SpreadLimits = { maxAngle: (90 * Math.PI) / 180, maxArc: 1.6 };

/** The step of the spread factor of one side of a row. */
const SPREAD_STEP = 0.02;

/**
 * Finds if a box keeps the edge margin from the outline of the stage: from the side edges, the
 * front edge, the back edge, and the corner cuts (design 4.5, seat geometry).
 *
 * @param b The box, relative to the podium center.
 * @param stage The stage side and the front distance.
 * @returns True if each corner of the box keeps the margin.
 */
export function boxOnStage(b: PlacedBox, stage: StageSize): boolean {
  // The z of the stage center, relative to the podium center.
  const center = stage.front - stage.side / 2;
  return [-1, 1].every((sx) =>
    [-1, 1].every((sz) =>
      keepsStageMargin(
        b.x + sx * b.halfX * b.cos + sz * b.halfZ * b.sin,
        b.z - sx * b.halfX * b.sin + sz * b.halfZ * b.cos - center,
        stage.side,
        EDGE_MARGIN,
      ),
    ),
  );
}

/**
 * Finds if each box of a row keeps the edge margin from the outline of the stage.
 *
 * @param row The places of the row, relative to the podium center.
 * @param stage The stage side and the front distance.
 * @returns True if each box is inside.
 */
function rowOnStage(row: RowPlacement, stage: StageSize): boolean {
  return obstaclesOfRow(row).every((obstacle) => obstacle.boxes.every((b) => boxOnStage(b, stage)));
}

/**
 * Calculates the angles of a row after the spread of one side. Each arc between two neighbors
 * on that side, and the arc from 0° to the innermost player, grows by a factor up to 1.6 m. An
 * arc that is already longer stays. With no player at 0°, the innermost arc of a centered row
 * grows up to half of 1.6 m, because the innermost player of the other side shares it. The
 * innermost arc of a row with no players around 0° is the gap of the conductor, and it grows with no limit.
 *
 * @param row The row.
 * @param side -1 for the players left of 0°, 1 for the players right of 0°.
 * @param factor The factor of the arcs, at least 1.
 * @returns The angle of each player.
 */
function spreadAngles(row: FittedRow, side: -1 | 1, factor: number): number[] {
  const { radius, angles } = row;
  const { maxArc } = SPREAD_LIMITS;
  const order = angles
    .map((angle, i) => ({ arc: angle * side * radius, i }))
    .filter((p) => p.arc > 1e-9)
    .toSorted((a, b) => a.arc - b.arc);
  const middle = angles.some((a) => Math.abs(a) <= 1e-9);
  let innerLimit = maxArc / 2;
  if (middle) {
    innerLimit = maxArc;
  } else if (row.split) {
    innerLimit = Infinity;
  }
  const grow = (arc: number, limit: number): number =>
    arc >= limit ? arc : Math.min(limit, arc * factor);
  const next = [...angles];
  let previous = 0;
  let at = 0;
  order.forEach((p, k) => {
    at += grow(p.arc - previous, k === 0 ? innerLimit : maxArc);
    previous = p.arc;
    next[p.i] = (side * at) / radius;
  });
  return next;
}

/**
 * Spreads the players of one side of a row with the largest factor, in steps of 0.02 down from
 * 1.6 / 0.95, that keeps the limits (design 4.5, seat geometry). Each seat stays within ±90°,
 * each box keeps 0.3 m from the edges, and each footprint keeps its gaps from the other items
 * ({@link rowClear}). {@link spreadAngles} keeps the arcs at most 1.6 m. The spread only makes the
 * arcs of a row longer, so the items of the row stay apart. The overlap test of the layouts checks
 * all pairs.
 *
 * @param row The row.
 * @param side -1 for the players left of 0°, 1 for the players right of 0°.
 * @param clearance The other items on the stage.
 * @param stage The stage side and the front distance.
 * @returns The row with the new angles, or the same row if no factor above 1 fits.
 */
function* spreadSideSteps(
  row: FittedRow,
  side: -1 | 1,
  clearance: RowClearance,
  stage: StageSize,
): Steps<FittedRow> {
  const { maxAngle, maxArc } = SPREAD_LIMITS;
  for (let k = maxArc / SEATED_ARC; k > 1 + 1e-9; k -= SPREAD_STEP) {
    yield;
    const next = spreadAngles(row, side, k);
    if (next.some((a) => Math.abs(a) > maxAngle + 1e-9)) {
      continue;
    }
    const placement = placeRow(row.members, next, row.radius);
    if (rowOnStage(placement, stage) && rowClear(placement, clearance)) {
      return { ...row, angles: next, placement };
    }
  }
  return row;
}

/**
 * Spreads each instrumental row inside the stage, from the front (design 4.5, seat geometry). The
 * packed rows end at ±43° to ±74°, so the front corners of the stage stayed empty. The left side
 * and the right side of a row each get their own factor. A row keeps its left side left of 0°
 * and its right side right of it. The stage side does not change.
 *
 * @param rows The packed rows, from the front.
 * @param fixed The obstacles that do not move: the podium with the conductor, the soloist, the
 *   risers, and the singers.
 * @param soloPianos The obstacles of the piano soloists, which are also in `fixed`.
 * @param stage The stage side and the front distance.
 * @returns The rows after the spread.
 */
function* spreadRowsSteps(
  rows: readonly FittedRow[],
  fixed: readonly Obstacle[],
  soloPianos: readonly Obstacle[],
  stage: StageSize,
): Steps<FittedRow[]> {
  const done: FittedRow[] = [];
  for (const [n, row] of rows.entries()) {
    const behind = rows.slice(n + 1);
    const clearance: RowClearance = {
      placed: [
        ...fixed,
        ...done.flatMap((r) => obstaclesOfRow(r.placement)),
        ...behind.flatMap((r) => obstaclesOfRow(r.placement)),
      ],
      pianosInFront: [...soloPianos, ...done.flatMap((r) => pianosOfRow(r.placement))],
      playersBehind: behind.flatMap((r) => r.placement.players.map((p) => p.obstacle)),
    };
    const left = yield* spreadSideSteps(row, -1, clearance, stage);
    const next = yield* spreadSideSteps(left, 1, clearance, stage);
    done.push(next);
  }
  return done;
}

/**
 * Gives the string wedge of a row group, or `null` for a group that is not a string section.
 *
 * @param group The row group.
 * @returns The wedge.
 */
function wedgeOf(group: RowGroup): StringWedge | null {
  const wedge = group.replace(/-b$/u, '');
  return [...STRING_WEDGES.left, ...STRING_WEDGES.right].find((w) => w === wedge) ?? null;
}

/**
 * Divides the players of one string wedge over the string rows, desk by desk (design 4.5, seat
 * geometry): the two players of a desk share a row, and the desks spread evenly from the front, or
 * from the back for the contrabasses.
 *
 * @param players The players of the wedge, in the order of the cast.
 * @param rowCount The number of string rows.
 * @param fromBack True to fill the rows from the back.
 * @returns The players of each row, from the front.
 */
function wedgeRows(players: readonly Member[], rowCount: number, fromBack: boolean): Member[][] {
  const desks: Member[][] = [];
  for (const member of players) {
    const last = desks.at(-1)?.[0];
    const sameDesk =
      last &&
      last.cast.seatIndex === member.cast.seatIndex &&
      Math.floor(last.cast.player / DESK_SIZE) === Math.floor(member.cast.player / DESK_SIZE);
    if (sameDesk) {
      desks.at(-1)?.push(member);
    } else {
      desks.push([member]);
    }
  }
  const rows: Member[][] = Array.from({ length: rowCount }, () => []);
  const used = Math.min(rowCount, desks.length);
  desks.forEach((desk, d) => {
    const k = Math.floor((d * used) / desks.length);
    rows[fromBack ? rowCount - 1 - k : k]?.push(...desk);
  });
  return rows;
}

/**
 * Gives the rows of an orchestra from the front, each with its players from left to right and the
 * side of each player (design 4.5, seat geometry): the string rows, with the string wedges on the
 * sides and {@link MIDDLE_ROWS} in the middle, and then {@link BACK_ROW}.
 *
 * @param members The players.
 * @param groups The row group of each player, by its index.
 * @returns The rows.
 */
function orchestraRows(
  members: readonly Member[],
  groups: readonly RowGroup[],
): { readonly member: Member; readonly side: RowSide }[][] {
  const inGroup = (group: RowGroup): Member[] => members.filter((m) => groups[m.index] === group);
  const inWedge = (wedge: StringWedge): Member[] =>
    members.filter((m) => wedgeOf(groups[m.index] ?? 'choir') === wedge);
  const count = (wedges: readonly StringWedge[]): number =>
    wedges.reduce((sum, wedge) => sum + inWedge(wedge).length, 0);
  const fuller = Math.max(count(STRING_WEDGES.left), count(STRING_WEDGES.right));
  const stringRows = Math.min(MAX_STRING_ROWS, Math.ceil(fuller / STRING_ROW_PLAYERS));
  const split = (wedges: readonly StringWedge[]): Member[][][] =>
    wedges.map((wedge) => wedgeRows(inWedge(wedge), stringRows, wedge === 'contrabass'));
  const left = split(STRING_WEDGES.left);
  const right = split(STRING_WEDGES.right);
  const rowCount = Math.max(stringRows, MIDDLE_ROWS.length);
  const tag = (side: RowSide) => (member: Member) => ({ member, side });
  const rows = Array.from({ length: rowCount }, (...[, k]) => [
    ...left.flatMap((wedge) => wedge[k] ?? []).map(tag(-1)),
    ...(MIDDLE_ROWS[k] ?? []).flatMap(inGroup).map(tag(0)),
    ...right.flatMap((wedge) => wedge[k] ?? []).map(tag(1)),
  ]);
  rows.push([
    ...BACK_ROW.left.flatMap(inGroup).map(tag(-1)),
    ...BACK_ROW.center.flatMap(inGroup).map(tag(0)),
    ...BACK_ROW.right.flatMap(inGroup).map(tag(1)),
  ]);
  return rows;
}

/**
 * Checks that each player of the cast has a place, and gives the places in the order of the cast
 * (design 5.1).
 *
 * @param places The place of each player in the order of the cast, or `undefined` for a player
 *   that no row placed.
 * @param cast The cast, for the message of the error.
 * @returns The places.
 * @throws {Error} If a player has no place, because then `SceneLayout.players` no longer
 *   follows the order of the cast.
 */
export function placesOfCast(
  places: readonly (PlayerPlace | undefined)[],
  cast: readonly PlayerCast[],
): PlayerPlace[] {
  return places.map((place, i) => {
    if (!place) {
      const c = cast[i];
      throw new Error(
        `The layout has no place for player ${i} (${c?.species} ${c?.instrument}, seat ${c?.seatIndex}).`,
      );
    }
    return place;
  });
}

/**
 * Calculates the positions of the stage, the players, the music stands, and the risers for a
 * score (design 4.5, 5.1). The sections sit in rows around the podium. The footprints of the
 * players, their instruments, their seats, and the stands keep 0.05 m from each other: a seat
 * arc grows for a wide footprint, and a row moves back until it is clear of the items in front.
 * A player behind a piano case keeps {@link PIANO_REACH_GAP} from it.
 *
 * @param score The score.
 * @param models The player models of the score. The pose plan and the scene can share this cache,
 *   so that each kind of player builds its model one time. A new cache by default.
 * @returns The layout, with the players in the order of `castScore()`.
 * @throws {Error} If a player has no place.
 */
export function layoutScene(score: Score, models = new ModelCache()): SceneLayout {
  return runAll(layoutSceneSteps(score, models));
}

/**
 * Calculates the layout of a score as {@link layoutScene} does, in steps (design 7.2). The steps
 * build each player model that the layout needs.
 *
 * @param score The score.
 * @param models The player models of the score.
 * @returns The steps, which return the layout.
 * @throws {Error} If a player has no place.
 */
export function* layoutSceneSteps(score: Score, models: ModelCache): Steps<SceneLayout> {
  const cast = castScore(score);
  const form = chamberFormOf(score.seats);
  const groups: RowGroup[] = [];
  const members: Member[] = [];
  for (const [index, c] of cast.entries()) {
    yield* models.getSteps(c.species, c.instrument, c.kettles, c.support);
    yield;
    const seat = score.seats[c.seatIndex];
    if (form === 'solo' || form === 'recital') {
      // A player alone or in a recital has the place of a soloist, with no turn and no stand.
      groups.push('soloist');
    } else if (form === 'arc' && seat?.section === 'piano') {
      groups.push('piano');
    } else if (form === 'arc') {
      groups.push(seat ? groupOf(seat, c.player) : 'choir');
    } else if (c.seatIndex === score.soloist) {
      groups.push('soloist');
    } else if (c.seatIndex === score.vocalSoloists) {
      groups.push('vocal-soloists');
    } else {
      groups.push(seat ? groupOf(seat, c.player) : 'choir');
    }
    const section = !seat || seat.section === 'sound-only' ? 'choir' : seat.section;
    members.push(memberOf(c, index, section, models, groups.at(-1) ?? 'choir'));
  }
  yield* models.getSteps(CONDUCTOR.species, CONDUCTOR.instrument);
  yield;
  if (form) {
    return layoutChamber(form, members, cast, groups);
  }
  const inGroup = (group: RowGroup): Member[] => members.filter((m) => groups[m.index] === group);
  const players: (PlayerPlace | undefined)[] = members.map(() => undefined);
  const fixed: Obstacle[] = [conductorObstacle(CENTER, models)];

  let soloistFront = -Infinity;
  const soloPianos: Obstacle[] = [];
  for (const member of inGroup('soloist')) {
    const soloist = placeSoloist(member);
    players[member.index] = soloist.place;
    fixed.push(soloist.obstacle);
    if (member.cast.instrument === 'piano') {
      soloPianos.push(soloist.obstacle);
    }
    soloistFront = Math.max(soloistFront, soloist.front);
  }

  const rows: FittedRow[] = [];
  let radius = FIRST_ROW_RADIUS - ROW_STEP;
  for (const [n, parts] of orchestraRows(members, groups).entries()) {
    const row = parts.map((part) => part.member);
    if (row.length === 0) {
      continue;
    }
    const sides = parts.map((part) => part.side);
    const fit = yield* fitRowSteps(row, sides, n, radius + ROW_STEP, {
      placed: [...fixed, ...rows.flatMap((r) => obstaclesOfRow(r.placement))],
      pianosInFront: [...soloPianos, ...rows.flatMap((r) => pianosOfRow(r.placement))],
      playersBehind: [],
    });
    radius = fit.radius;
    rows.push(fit);
  }
  const withRows = (fitted: readonly FittedRow[]): (PlayerPlace | undefined)[] => {
    const places = [...players];
    for (const p of fitted.flatMap((r) => r.placement.players)) {
      places[p.index] = p.place;
    }
    return places;
  };
  const obstacles = [...fixed, ...rows.flatMap((r) => obstaclesOfRow(r.placement))];
  const stands = rows.flatMap((r) => r.placement.stands.map((stand) => stand.place));

  const empty: ChoirPlacement = { singers: [], risers: [], obstacles: [] };
  let choir = empty;
  let draft: Draft = { players: withRows(rows), stands, risers: [], obstacles, soloistFront };
  const singers = inGroup('choir');
  const soloSingers = inGroup('vocal-soloists');
  const choirLevels = RISER.levels - (soloSingers.length > 0 ? 1 : 0);
  // The count of levels that gives the smallest stage wins, and fewer levels win a tie.
  let best = Infinity;
  for (let levels = 1; levels <= Math.min(choirLevels, singers.length); levels++) {
    yield;
    const candidateChoir = fitChoir(singers, levels, radius + ROW_STEP, obstacles, soloSingers);
    const withChoir = withRows(rows);
    for (const s of candidateChoir.singers) {
      withChoir[s.index] = s.place;
    }
    const candidate: Draft = {
      players: withChoir,
      stands,
      risers: candidateChoir.risers,
      obstacles: [...obstacles, ...candidateChoir.obstacles],
      soloistFront,
    };
    const { side } = stageOf(candidate);
    if (side < best - 1e-9) {
      best = side;
      draft = candidate;
      choir = candidateChoir;
    }
  }

  const stage = stageOf(draft);
  // The rows spread inside the stage, and the stage side stays (design 4.5, stage origin).
  const spread = yield* spreadRowsSteps(rows, [...fixed, ...choir.obstacles], soloPianos, stage);
  yield;
  const places = withRows(spread);
  for (const s of choir.singers) {
    places[s.index] = s.place;
  }
  const others = [...fixed, ...spread.flatMap((r) => obstaclesOfRow(r.placement))];
  const risers = widenRisers(draft.risers, others, stage);
  const podium: Vec3 = [0, 0, stage.side / 2 - stage.front];
  const move = (p: Vec3): Vec3 => [p[0] + podium[0], p[1] + podium[1], p[2] + podium[2]];
  return {
    stageSide: stage.side,
    podium,
    conductor: conductorOn(podium),
    players: placesOfCast(places, cast).map((p): PlayerPlace => ({
      position: move(p.position),
      facing: p.facing,
      cast: p.cast,
    })),
    stands: spread
      .flatMap((r) => r.placement.stands)
      .map((stand): StandPlace => ({
        position: move(stand.place.position),
        facing: stand.place.facing,
        deskHeight: stand.place.deskHeight,
      })),
    risers,
  };
}
