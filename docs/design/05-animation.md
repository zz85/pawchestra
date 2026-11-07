# 5. Animation

## Pose index

A role is a kind of player with a pose of its own: an instrument with the species of its section
(`SECTION_SPECIES` of `models/cast.ts`). A species with a hold of its own is a role of its own.
The code holds the values of each hold. These product rules apply to each pose:

- **Real players.** Each role pose and its motion follow a real musician. The technique
  references give the source of each fact, and their section "Use in the app" gives the rules of
  the app and where the app differs: [strings](../reference/string-technique.md),
  [winds](../reference/wind-technique.md), [percussion](../reference/percussion-technique.md),
  [harp](../reference/harp-technique.md), and [piano](../reference/piano-technique.md).
- **Bodies stay.** The app keeps the mesh of each animal with no stretch of a limb. When a short
  arm does not reach, the app prefers a smaller instrument, a nearer place, or a hold of its own
  to longer arms.
- **Natural balance.** A standing pose, and a seated pose with no chair, keep the center of mass
  over the soles. The monkey trumpeter has no chair.
- **Grasp.** Each paw wraps its instrument as a real player does: the finger tips are on the
  instrument, the palm faces the tube or the shaft, and the paw is on the side that the
  technique names.
- **Arms close to the body.** The arms hang close to the sides, the elbows stay near the trunk,
  and the players hold their instruments close, as in the reference images. An arm can touch the
  body up to `ARM_CONTACT_DEPTH` of `pose/test-arm-clearance.ts`, and it does not have to touch.
- **Contact of the instruments.** A held instrument can press the fur where a real player touches
  it, as the contrabass on the lower belly, and it goes no further in. A rested instrument or bow
  can touch the body, and it never crosses it.

The roles and their holds:

- **Conductor:** bear, `CONDUCTOR_HOLD` (5.4).
- **Strings** (`pose/bowed-rig.ts`, strings 3): violin rabbit `SHOULDER_HOLD`, violin red fox
  `FOX_HOLD`, viola cat `CAT_HOLD`, cello dog `DOG_HOLD`, contrabass hippo `HIPPO_HOLD`.
- **Winds** (`pose/winds.ts`, winds 4): flute tan fox `FOX_FLUTE`, oboe mouse `MOUSE_OBOE`,
  clarinet wolf `WOLF_CLARINET`, bassoon beaver `BEAVER_BASSOON`, horn pig `PIG_HORN`, trumpet
  monkey `MONKEY_TRUMPET`, trombone panda `PANDA_TROMBONE`, tuba rhino `RHINO_TUBA`.
- **Percussion** (`pose/percussion-rig.ts`, percussion 10): timpani elephant, and the badger with
  the bass drum, the snare drum, the suspended cymbal, the small percussion, and the xylophone
  (`PERCUSSION_HOLDS`, `SUSPENDED_CYMBAL_HOLD`).
- **Piano and harp** (`pose/hands.ts`, `HANDS_HOLDS`): piano polar bear (piano), harp deer
  (harp 6).
- **Choir:** penguin, `CHOIR_HOLD` (5.3).

`INSTRUMENT_SUPPORTS` and `supportOf()` of `models/player.ts` give the supports (4.5). The
pianist sits on a bench, and the harpist on a stool. The conductor, the contrabass, the trumpet,
the tuba (as on a strap), the percussion, and the choir stand. The oboe and the bassoon have no
chair and sit in the seated pose at the seat height of their legs. The others sit on a chair. The
violins, the viola, the flute, the oboe, the clarinet, the horn, and the trombone stand as a
soloist, a player alone, or the partner of a pianist (4.2). The generic holds
`BOWED_HOLDS.violin`, `BOWED_HOLDS.cello`, `WIND_HOLDS.flute`, and `WIND_HOLDS.trombone` are for a
new species of these sections. `pnpm close-views <role> <dir>` renders a role with the views of
`ROLE_VIEWS` (7.1). Each new role or hold adds its entry here.

## 5.1 Pose function

The pose of each animal is a **pure function**. `poseAt()` calculates each pose only from the
score, the scene layout, the song time, the wall time, the transport, the audibility of the seats,
and the seed. The app keeps no state that events change. Thus seek, pause, speed, mute, and solo
changes are always correct, and the animation cannot drift from the audio.

```typescript
/** The play state. It changes only on play, pause, and stop. */
interface Transport {
  playing: boolean;
  /** Wall clock seconds of the last change. `null` before the first play. */
  changedAtWall: number | null;
  /** The transport before the last change, or `null` for the rest pose (5.2). */
  before: Transport | null;
  /** The song time of the first sound of the last play: 0, or the pause point (6.5). */
  startSec: number;
  /** The time that the instruments stay up after a pause (`REST_TIMES.hold`), or 0. */
  holdSec: number;
  /** The wall clock seconds from a play to its first sound. */
  leadSec: number;
}

/** The mute and solo result of one seat (6.6). */
interface SeatAudibility {
  audible: boolean;
  changedAtWall: number;
  before: SeatAudibility | null;
}

/** The pose of one animal for one frame. Optional fields add the paw turns and the keys. */
interface AnimalPose {
  /** One quaternion (x, y, z, w) for each bone, in the order of `BONE_NAMES` (4.7). */
  rotations: Float32Array;
  rootOffset: Vec3;
  /** The move of the `slide` bone: the trombone slide and the damper pedal (4.6). */
  slideOffset: Vec3;
  /** The move of the `instrument` bone, such as the violin at rest (5.2). */
  instrumentOffset?: Vec3;
  /** 0 is open eyes, 1 is closed eyes. */
  blink: number;
}

interface ScenePose {
  /** One entry for each player, in the order of `SceneLayout.players`. */
  players: AnimalPose[];
  /** `null` for a chamber group, which has no conductor (4.2). */
  conductor: AnimalPose | null;
}

/** The data of one `Score` that each frame needs. */
interface PosePlan {
  players: readonly PlayerPlan[];
  conductor: PlayerPlan | null;
  /** The player that leads a chamber group, or `null` with a conductor (5.4). */
  leader: number | null;
  /** The conducted beats and the beats of the felt pulse, in song seconds. */
  beats: Float64Array;
  pulses: Float64Array;
  /** The song end. The conductor bows after it (5.4). */
  endSec: number;
}

/** The places of the scene for one `Score` (4.5). */
interface SceneLayout {
  stageSide: number;
  podium: Vec3;
  /** The bear on the podium top, or `null` for a chamber group. */
  conductor: { position: Vec3; facing: number } | null;
  /** `facing` is radians around y, and 0 faces -z (the back). */
  players: readonly { position: Vec3; facing: number; cast: PlayerCast }[];
  stands: readonly StandPlace[];
  risers: readonly RiserLevel[];
}

declare function layoutScene(score: Score, models?: ModelCache): SceneLayout;
declare function preparePoses(score: Score, layout: SceneLayout, seed: number): PosePlan;
declare function poseAt(
  plan: PosePlan,
  songTime: number,
  wallTime: number,
  transport: Transport,
  /** One entry for each seat. A missing entry sounds. */
  audibility: readonly (SeatAudibility | undefined)[],
  out?: ScenePoseBuffer,
): ScenePose;
```

The app calls `layoutScene()` and `preparePoses()` one time for each `Score`. Each frame then only
looks up the song time in sorted lists and writes into one buffer, so 60 players fit in the frame
budget (9.7). `poseAt()` also solves the IK of 4.7. The app poses each demo with the seed 1, so a
demo shows the same motion on each visit.

| Layer | Clock | Motion |
|---|---|---|
| Note | song time | Bow strokes, fingers, breath, mallets, hands (5.3) |
| Beat | song time | A sway with the felt pulse, and the conductor (5.4) |
| Idle | wall clock time | Breath, eye blinks, ears, tail, looks at the conductor |

- **Motion families.** Each instrument has a family with its own note layer: `bowed`,
  `woodwind`, `brass`, `keyboard`, `harp`, `percussion`, `choir`, or `conductor`.
- **Beat layer.** In a passage, a player sways from side to side with the felt pulse
  (`beatSway()`). A real player sways with a slow level of the meter, so the pulse is the
  conducted beat (5.4) up to `PULSE_TEMPO`, the preferred tempo of a listener, and 2 or 4
  conducted beats above it (`markPulses()`).
- **Clips.** A clip of a person (4.4) gives a pose from the clip and the clip time alone
  (`clipPoseAt()`), so it keeps the rule of stateless poses. Only the gallery plays a clip now.
- **Idle layer.** The idle layer uses the wall clock, so the animals stay alive while the music
  stops. Its motions come at seeded times in windows of the wall clock, so they need no state
  (`IDLE_MOTION`). Hanging ears do not twitch, as a real hanging ear does not
  (`SpeciesParams.hangingEars`).

## 5.2 Rest pose

Before the first play, the players are in the rest pose, because a real orchestra lifts the
instruments only when the conductor signals the start. The players lift their instruments in the
count-in (5.4, 6.5), and lower them when the hold of `transport.holdSec` after a pause ends.

- **Natural motion.** Each player has its own seeded lift and lowering (`restMotion()`,
  `REST_MOTION` of `pose/rest.ts`). The principal of a seat moves first, and the others follow in
  a ripple, as real players watch their leader. The winds lift sooner, because they also breathe
  before the first note. The conductor gives the count-in, so its motion does not vary.

  ```typescript
  /** The timing of one move of the instruments: a lift or a lowering. */
  interface RestMove {
    delaySec: number; // wall clock seconds
    durationSec: number;
    skew: number; // the seeded skew of the curve, near 1
  }

  /** The seeded lift and lowering of one animal (`PlayerPlan.motion`). */
  interface RestMotion {
    lift: RestMove;
    lower: RestMove;
    fitSec: number; // the longest lift of the group, with its delay
  }
  ```

- **No jump.** A move starts from the height of each player at the change, from
  `transport.before` (`changeTransport()` of `app/transport.ts`).
- **Count-in.** The slowest lift ends before the downbeat. A shorter count-in scales all lifts by
  one factor (`liftScale()`). A pause in the count-in lowers the instruments at once.
- **No wrist flip.** A paw does not turn past 180° on its forearm in a move, because the twist
  bone (`TWIST_SHARE` of `models/studio-rig.ts`) then turns over in one frame. The arm gate checks
  each move (`probeMoves()` of `tools/arm-check.ts`). The carried left paw of a violin or a viola
  turns on the way on which its twist from the bind of the studio body stays between -180° and 180°
  (`studioPawTwist()`). On a supinated bind paw, this way is a supination, as a real forearm turns.
  On a pronated bind paw, the playing grip lies past 180° in the supination, so the paw turns the
  other way, through the direction of no paw twist. Reason: the change of the hold cannot change
  the bind of the body, and the other way flips the paw on six recast bodies.
- **Seated posture.** Each seated player sits tall off the chair back, with the hips above the
  knees, vertical shins, and the soles flat, as real seated string players sit: "The main point
  is that your hips are higher than your knees" (violinist.com, discussion 9372). The seat stays
  level, and its height fits the legs (`seatHeights()` of `models/props.ts`, 4.4). The polar bear
  sits on a bench that holds its whole haunch, with the thighs at most about 25° down (4.4, seat),
  as a pianist sits on the front half of the bench (piano 2).
- **Hanging arms.** A standing player with free hands hangs its arms (`HANG` of `pose/hang.ts`),
  with the palms at the height of the hips. The slim standing tan fox bends the free left elbow
  less (`FOX_HANG`), because the full bend points its forearm forward into the air.

The rest of each family:

- **Violin and viola.** A seated player rests as a seated violinist (strings 2.9): the instrument
  upright on the left thigh, the neck through the closed left paw, and the bow upright at the
  right side (`restHandAt()`, `UPRIGHT_BOW`). In a move, the instrument turns with the left paw as
  one rigid object (`carryLift()`), and the bow tip turns through the front (`BowVia`). A
  standing player hangs the bow with the tip down (`HANGING_BOW`). In the shared violin hold, the
  arms at rest hang out to the sides until they clear the body, with a forward swing and an elbow
  bend of each arm (`BowedHold.restArms`, `hangingArm()`). The left paw holds the upright violin at
  its hanging wrist, and the right paw the upright bow. Reason: a rest place on the thigh puts the
  upper arms of the recast bodies into the trunk, and the bind elbow keeps the bind overlap of the
  arm root. The cat and the rabbit rest the instrument upright on the left thigh or knee, with
  the elbows near the sides, as a seated violinist does. The cat rests the viola at the outer side
  of the left thigh. Reason: with the viola on the top of the thigh, the elbow had to point out to
  clear the round belly, and the left upper arm then turned far about its axis from the bind and
  read as bent.
- **Cello and contrabass.** The instrument stays at its playing place. The dog holds the bow over
  the right knee with the tip up, as a cellist does. Its grip lies low and out, and both elbows
  point out, so that the round upper arms stay off the chest (5.3, "Free round arms"). The hippo
  hangs the bow out from the side of the belly, because its short knee is under the belly, and the
  round upper arm then stays off the trunk. Its left paw holds the neck nearer to the nut
  (`restPlace`), because the idle sway of the rest takes the thick left forearm into the neck lower
  down.
- **Winds.** The head lifts, and the instrument moves off the mouth. Both paws keep their grips
  (`restAim`), so no paw slides along the tube. A real player can rest the instrument on a leg,
  but the round bellies of the mouse, the wolf, the beaver, and the pig cover their thighs. So
  these instruments stay in front of the belly. A shared hold with rest arms
  (`WindHold.restArms`, `armRest()` of `pose/winds.ts`) rests from the hanging arms of the body:
  the right paw holds the flute or the clarinet nearly upright at its side, at the hanging palm,
  as a flutist rests the flute vertically on the right leg (winds 2.4), and the free left paw
  hangs with the roll of its grip (`freeRoll()`). Reason: a rest place in `H` from the mouth fits
  one body only, and with both paws on the clarinet at the middle of the hanging palms, the arms
  went into the body. The panda holds the trombone upright in front of the body, below the mouth,
  with the slide down and a little forward (`PANDA_TROMBONE`), as a seated player holds the slide
  vertical in front of the knee (winds 1.7). Both paws keep the grip of the play on the instrument
  (`restAim`), and the left paw slides down its tubes (`restGripShiftL`). Reason: with a rest grip
  of its own, the right hand turned about 180° from the rest to the play, and each mix of the move
  turned the right paw past 180° on its forearm. The elbows point out and down.
- **Piano and harp.** The polar bear sits tall with a small lean to the piano and the head up, as
  a pianist before a performance (`restLean`). The paws rest on the front of the belly with the
  palms back, because the belly covers the thighs and the thighs lie out of the reach of the arms.
  The deer sits up with each hand near a string.
- **Percussion.** A ready player keeps its mallets over the instrument (`PercussionHold.ready`),
  because a lift from hanging arms sweeps them through the body or the kettles. The snare sticks
  rest level across the waist, as a snare drummer between entries (`PercussionHold.set`).
- **Choir.** The penguin keeps the folder in front of the chest, as a choir between two pieces.

## 5.3 Instrument motion

- **Timing.** The motion of a note starts before the note and ends at the note start, because the
  app reads the full file first. Each player has a small seeded offset in timing and amplitude
  (`PLAYER_OFFSETS`), so that players in unison do not move as copies.
- **Loudness.** The size of a gesture comes from the velocity, CC 7, and CC 11 at the note start
  (`pose/loudness.ts`), from `Score.synthEvents`, so the sound and the gestures use the same
  events.
- **Chords.** Notes of a player that start within `CHORD_SEC` form one stroke, strike, or chord
  (3.8).
- **Arms in the body.** A turn of the elbow about the line from the shoulder joint to the wrist
  (a swivel) keeps the paw on its target, but it cannot clear an arm that the cast matrix puts
  into the body. Reason: at the deepest moment, the arm is straight because the paw target of
  the lift or the lowering is out of reach, or the clip is at the root of the upper arm. Both
  points lie on the line of the swivel, so it does not move them. A shared hold lifts the
  shoulder bones of a round body, and keeps a free paw bent in the moves ("Free round arms in a
  shared hold", "Bent arms in the moves"). A clip at the root of the upper arm of a bent arm comes
  from the arm root of the mesh, so the rig fixes it. A larger elbow turn up to the stop of
  `turnPoleOut()`, a larger lift of the shoulder, an elbow out in the middle of the moves, and a
  larger forward turn of the shoulder each took only a small part of the depth, and a larger turn
  moves the grip line of the arm gate past its limit. The root domes of the pig shrink
  toward the shoulder joints (`pig_root.py`), because their depth swings with their distance from
  the joint, and some of them come out of the shoulder in another pose.
- **Free round arms.** A rebuilt arm that the mesh joined to the trunk (the panda, the pig, the dog,
  the beaver, the badger, the penguin) is a round tube with its full inner half width. With the
  bone pose of a thinner arm, the inner side of the upper arm goes into the trunk. So the hold of such a body keeps the elbows away from the sides, as a brass player
  does (winds 1.8). A violinist keeps the left elbow under the instrument and the bow arm free of
  the body (strings 1.8, 2.3), and a cellist starts a stroke open at the shoulder (strings 2.2). At
  rest, the arms of such a body hang out until they clear the body (`restArms`). A hanging bow
  arm turns its elbow out in the middle of the lift and the lowering (`liftPoleR`), because the
  corrective shape of the bow arm keeps the arm root out only near the elbow bend of the play.
  Each elbow turns out about the line from the shoulder joint to the grip, and the shoulder turns
  forward when the arm reaches forward. A grip nearer to the shoulder bends the elbow, so each
  degree of the turn moves the upper arm further from the trunk. When the forearm and not the upper
  arm lies on the trunk, a nearer grip pushes the forearm in. A grip away from the shoulder frees
  the forearm, but moves the paw off its keys, so the pig keeps the grip of the play and moves only the grip of the
  rest (`restGripShiftL`). The grip turn of the arm gate counts from the posed forearm, so the turn
  of the elbow adds to it (`ACCEPTED_GRIPS`). A large forward turn of the shoulder folds the
  shoulder. Reason: on a bent arm, the swivel moves the arm root off the trunk, and each paw keeps
  its grip.
- **Free round arms in a shared hold.** An own hold sets the elbows for its body. A shared hold
  (the flute, the clarinet, the trumpet, the violin, the cello) takes the rule from the body
  (`roundArms`): the out swing that an arm needs is the smallest swing of the hanging upper arm
  out to the side at which the upper arm and the elbow clear the trunk of the bind pose
  (`armOut()`). The hold keeps the swing of its accepted player (`ROUND_ARMS_FIT`), and a body that
  needs more turns each elbow of the play, the moves, and the rest out by `TURN_PER_SWING` times
  the difference (`elbowOutTurn()`), toward the side around the forward axis (`turnPoleOut()`). A
  thin body keeps the elbows of the hold. The paws keep their grips: in the 2x crops of the dog
  and the rabbit flutists and the hippo clarinetist, each paw stays on its keys with and without
  the turn, and the world pose of the palms changes much less than the elbows. So the arm gate
  counts a paw that faces its tube in such a hold from the instrument (the palm turn,
  `ACCEPTED_PALMS`, design 4.4). The percussion holds have no
  rule, because the badger plays them as its own holds. Reason: the sweep measures the inner half
  width of each arm against the trunk, so a body needs no value of its own.
- **Lifted shoulders in a shared hold.** The elbow turn cannot clear a clip at the root of the upper
  arm, where the round arm root goes into the trunk or into the shoulder of the mesh. So a hold with
  the rule also lifts each shoulder bone of a body with a large swing, up and out around the forward
  axis, in each pose (`shoulderLift()`): `LIFT_PER_SWING` times the swing above the larger of
  `LIFT_FROM` and the swing of the accepted player, up to `MAX_LIFT`. The shoulder joint goes up,
  and the paws keep their grips, so the upper arm turns less against the shoulder. A free hanging
  arm keeps its direction from the lifted joint. Reason: the arm root turns against the shoulder by
  the swing from the hanging bind, so a body with a small swing keeps its shoulders, and a lift from
  the fit of the hold alone turned the paw of a thinner body past its accepted grip. A real player
  keeps the shoulders down, and the clavicle rises only a little when the arm rises (winds 1.8), so
  the lift stays in that range and does not read as a shrug. Thus it clears only a part of the deep
  root clips, as on the pig (`TODO.md`).
- **Bent arms in the moves.** In the lift and the lowering of a shared wind hold with the rule,
  the wrist of the free hanging paw stays within `BENT_REACH` of the length of the arm from the
  shoulder joint (`keepBent()`). The limit fades to the whole length at the rest and at the play,
  so the paw keeps its places there. Reason: the straight line from the hanging wrist to the grip
  went out of reach of a short arm, as on the dog, and a straight arm puts the round root of the
  upper arm into the chest. A bent elbow follows its pole, so the elbow turn of the rule holds the
  upper arm off the trunk. A real player keeps the upper arm away from the torso (winds 1.8). A paw
  that holds the instrument or the bow keeps its path: a limit would move it off the instrument,
  and on the bow arm of the cat it cleared no clip.
- **Far mouth in a shared hold.** A long snout or a big head puts the mouth far in front of the
  shoulder joints, so the paws of a heavy body miss the valves of the trumpet, also at the smallest
  size. The shared trumpet hold takes the rule of the far mouth (`WindHold.farMouth`): the mouth
  share of a body is the mean distance from the bind shoulder joints to the mouth, as a share of
  the arm (`mouthShare()`). A body with a larger share than the accepted monkey (`FAR_MOUTH_FIT`)
  bows the head in the play by `BOW_PER_SHARE` times the difference, up to `MAX_BOW`
  (`headBow()`). The neck and the head share the bow as they share a look, the mouthpiece follows
  the mouth, and the trumpet turns down with the head (`bowedPlay()`). Reason: a real player brings
  the instrument to the mouth, the neck flexion follows the downward angle of the instrument, and
  the trumpet keeps its angle to the face (winds 1.4, 2.1). A forward lean of the chest does not
  help, because the head and the instrument move with the chest. The shared flute has no rule: a
  bow put the left grip of the wolf and the beaver past the accepted grip, and neither a bow nor a
  lift moved the left forearm of a heavy body out of its turned head (`TODO.md`). The bow does not
  clear the snout clips of the trumpet, and the heaviest bodies still miss the valves at
  `MAX_BOW`.
- Version 1 has no extra effects, for example no music-note particles.

**Bowed strings** (`pose/fingering.ts`, `pose/strokes.ts`, `pose/bowed.ts`, strings 3):

- A search (Viterbi) gives each stroke its string, position, and finger before the play
  (`planHand()`, `FINGERING_COSTS`), in the orchestral style: low positions and open strings. The
  hand shifts only when the notes leave its position. Vibrato keeps the width of a real player.
- The bow changes direction on each note, and short notes in one beat join into one slur
  (`slurSizes()`), because the MIDI files have no slurs. Pizzicato plucks the string, and tremolo
  makes short fast strokes (`BOW_MOTION`).
- The arms are a little short for the instruments. So the right shoulder turns forward and the
  stick leans, so that the bow reaches the full hair (`bowRangeOf()`).
- **Cello hold from the body.** The shared cello hold (`BOWED_HOLDS.cello`) reads the landmarks of
  the body in place of fixed values (`BowedHold.fit`, `fitCelloPlace()`). The end pin stands on
  the floor right of the middle, the cello leans back and to the left (`CELLO_PLACE`), the top of
  its back stands at the height of the chest, and the middle line of its back stands a gap in
  front of the trunk and the thighs, the room of the arms. The arms take the values of the
  accepted dog cellist, as directions and in `H`. The right elbow points out and down, near the
  body, so the bow paw stays near the direction of no paw twist. At rest, the right upper arm
  hangs as in the bind pose, and the grip lies at the end of the forearm (`forearmGrip()`), so
  the rest elbow stays near the play elbow on each body. In the high positions, the left paw tilts
  further over the neck (`highTilt`), so the wrist comes up beside the upper bout. Reason: a hold
  with fixed values fits one body only. With the old shared hold, the elbow pointed out and up, and the bow paw of
  12 recast bodies flipped through 180° (cast matrix, 4.4). The dog keeps its own place
  (`DOG_HOLD`). The other instruments can take this pattern: a place from the landmarks, and the
  arm values of an accepted player.
- **Violin hold from the body.** The shared violin hold (`BOWED_HOLDS.violin`) takes the arm
  values of the accepted rabbit violinist, as directions and in `H`, and its place from the
  landmarks of the body (`BowedHold.chinFit`, `fitViolinPlace()`). The tail end lies on the left
  collarbone: a share of the way from the middle line to the left shoulder joint, above the base of
  the neck, and behind the front of the upper chest (`chestFront()`), the depth of the chest. The
  violin keeps the turn of the hold. Then the head turns down or up in a small range until the jaw
  touches the chin rest and the strings at the bow (`jawGap()`), and the violin moves up or down
  for the rest of the gap, as a violinist rests the jaw on the chin rest with a straight head
  (strings 1.10). Reason: a place in `H` from the head fits one body only. With the chin hold, the
  arms of each recast body went into the body, and with the head turn of the rabbit, the jaw went
  into the violin of six bodies. The rabbit and the red fox keep their own holds (`SHOULDER_HOLD`,
  `FOX_HOLD`).
- **Thick wrist on a floor neck.** The left paw of a floor instrument puts the middle of its finger
  block on the strings. The rebuilt round wrist of the hippo then goes into the back of the neck,
  so its paw lies a little off the strings along the normal of its palm (`BowedHold.gapL`), as a
  real bassist keeps the wrist off the neck (strings 2.8). Reason: a larger tilt of the paw over
  the neck alone turns the paw past the accepted grip of the role.
- **Grip clearance from the girth.** The shared cello hold takes the gap of the left paw from the
  body (`BowedHold.girthFit`, `GIRTH_FIT`). It keeps the girth of the left paw of its accepted
  player, and a thicker paw lies further off the neck by the difference (`pawGirth()`, added to
  `gapL`), in the play, at rest, and in the moves. Thus the paw keeps the free gap of the accepted
  player. A thinner paw keeps the gap of the hold, and the own holds have no rule. Reason: a real
  player holds the neck with the fingers and keeps the forearm free of the body of the instrument
  (strings 1.9), and the gap of the hold fits a thin paw. The shared violin hold has no gap rule,
  and takes the wrist clearance in its place. Reason: the paw at rest keeps its hanging wrist, so a
  rest gap from the girth of the wrist moved the violin into the belly of the heavy bodies, and a
  gap along the normal of the palm does not move the thick wrist out of the upper bout in the play.
- **Wrist clearance from the girth.** The shared violin hold takes the rest grip of the left paw
  from the body (`BowedHold.wristFit`, `wristGirth()`). The girth of the wrist end of the left
  forearm counts as a share of the length of the fingerboard, so a smaller violin of the size rule
  (4.6) counts as a thicker wrist. A wrist thicker than the wrist of the accepted rabbit holds the
  neck at rest nearer to the nut, in proportion up to a limit. The violin keeps the rest place and
  the path of the grip of the hold (`RigPoints.restCarryPlace`), and the paw slides up the neck
  in the moves. A thinner wrist and the own holds keep their grip. Reason: a real player keeps the
  forearm free of the body of the instrument (strings 1.9), and at the grip of the hold, the thick
  wrist end goes into the upper bout. With the violin hung from the new grip, the violin went into
  the belly of the heavy bodies. The play keeps its grip. Reason: a move of the wrist down from the
  back of the violin or toward the scroll, and a turn of the elbow, did not move the thick wrist
  end out of the upper bout. A further tilt of the paw over the neck moved the violin into the
  belly in the moves (`TODO.md`).
- **Cello rest grip on the neck.** At rest, the left paw of the shared cello hold holds the neck
  near the nut (`restPlace`), and the dog keeps its own place. Reason: at the place of the dog,
  the paw holds the fingerboard at the top of the upper bout, and the left forearm or the paw of
  most recast bodies goes into the upper bout at rest and in the moves.
- **Cello left elbow of the dog.** In the play, the left elbow of the dog points out to the side
  and a little down (`DOG_HOLD.poleL`), so that the forearm rises from the elbow to the neck. It
  goes up for each lower string (`elbowPerString`), as a cellist raises the elbow for the lower
  strings (strings 1.8), and further in the high positions (`highElbow`). Reason: with the
  nearly level elbow of the shared hold, the upper arm stood out level from the shoulder, and the
  elbow made a sharp point behind the forearm. A lower elbow bends the skin of the inner elbow of
  the dog over into a dark wedge, and an elbow further back folds the back of the left armpit.
  The elbow turn of the high positions keeps the forearm out of the upper bout. The shared hold
  keeps its nearly level elbow until a cast matrix run checks the new elbow on the recast bodies
  (`TODO.md`).

**Woodwinds and brass** (`pose/wind-notes.ts`, `pose/winds.ts`, winds 4):

- A wind player shows one note, and breathes in before a phrase. The mouthpiece stays at the
  mouth, so the look at the conductor does not turn the head.
- Each paw closes around its tube (`WindHold.faceTube`, `gripShiftL`). `pnpm wind-grip` measures
  the grasp in each phase.
- **Flute and clarinet holds from the body.** The shared flute and clarinet holds (`WIND_HOLDS`)
  take the arm values of the accepted tan fox and wolf, as directions and in `H`, with the lip
  plate or the mouthpiece at the mouth landmark of the body. Each paw keeps the side sign of its
  accepted player (`WindHold.aimSigns`). The shoulders turn forward only in the play
  (`turnShare()`). The rest comes from the hanging arms (5.2). Reason: the sign from the geometry
  turned the right flute paw of 7 recast bodies about 180°, and the lip shift of the wolf under
  its long muzzle put the forearms of short snouts into the body. The tan fox and the wolf keep
  their own holds (`FOX_FLUTE`, `WOLF_CLARINET`). The shared trumpet hold turns both shoulder bones
  forward (`reach`, `reachL`), as the shoulder blades of a real player slide forward. Reason: with
  square shoulders, the paws of most recast bodies miss the valves, also with the smallest trumpet
  of the size rule (4.6). A body with a far mouth also bows the head ("Far mouth in a shared
  hold"). The right palm faces the valve tops, and the right paw points a part of the way across
  them (`faceTube`, `aimSide`), as the monkey holds them. The right shoulder turns a little more
  than the left. Reason: with the roll of the shoulder, the right paw of each recast body stood up
  behind the valves, with its palm to the mouthpiece and its finger tips up, and a real player
  rests the finger tips on the valves (winds 2.1). The side aim moves the wrist off the line from
  the shoulder to the grip, so a short arm reaches the grip only with the larger turn, and a larger
  aim or turn made the arm of a slim body fold. The left paw keeps the roll of its shoulder.
- A brass player presses the valves of the pitch (`BRASS_FUNDAMENTALS`), and the partials skip
  the flat seventh partial, as real players do (`PARTIALS`).
- The trombone slide takes the position of the pitch, mapped into the travel that the arm
  reaches (`slideTravel()`). The arms do not grow for the slide.

**Percussion** (`pose/strikes.ts`, `pose/percussion.ts`, percussion 10):

- Each paw holds its mallet in the closed fingers, with the head out of the front of the fist,
  and keeps one roll on the shaft through the stroke (`MalletSpot`, `gripRoll()`).
- A mallet lifts before a strike, comes down at full speed at the note start, and rebounds
  (`STRIKE_MOTION`). A chord takes both hands, a fast repeat takes the other hand, and a hand
  does not cross the other.
- The paws of the elephant rest above the near rims, as in the reference images, so its mallets
  strike further in than a real timpanist (`PercussionHold.rim`). The short arms of the badger
  cannot hold hand cymbals out of the round body, so it plays a suspended cymbal
  (`SpeciesParams.cymbalForm`). The xylophone bars are smaller than real bars, so the short arms
  reach each one. At the xylophone, the right elbow of the badger points far out, and each mallet
  points from a place out from its shoulder (`PercussionHold.home`), so that the freed round arms
  stay out of the leaning belly. A home further out misses the bars.
- **Snare drum from the body.** The shared snare drum hold takes the place of the drum from the
  body (`PercussionHold.fit`, `fitDrumPlace()`). The drum goes forward until its near rim stands a
  room in front of the trunk on the middle line, from the head up to the shoulder joints. A deep
  body also sets the head higher, toward a drop below the elbows of the hanging upper arms, as a
  real player sets the head below the elbows (percussion 6). The raise grows with the move that
  the bind place needs, and it is full at a move of one room. The targets and the mallet homes
  move with the drum. The drum does not go down or back, so the badger and each thin body keep
  the bind place. Reason: at the bind place, the forearms and the paws of a deep body went into
  the belly. A move forward alone put the targets further out of the reach of the short arms, and
  a full raise for each body put the sticks of thin bodies into the drum in the lowering.

**Piano** (`pose/hands.ts`, `pose/piano-keys.ts`, piano):

- The left hand plays low notes and the right hand high notes. A narrow chord goes to the nearer
  hand, so a melody stays in one hand (`HANDS_HOLDS`, `splitHands()`). Each paw plays only to a few keys past
  the middle of the keys (`reach`), because a paw that crosses further puts its elbow in front of
  the round chest.
- The wide paws keep apart (`apart`). When the two parts of a wide chord, such as a bass and a
  melody, come nearer, each paw plays a few keys away from its part (`HandNote.shift`). Thus the
  two parts stay in two paws, and one paw does not jump between them.
- The paw lifts less before a near note (`HAND_MOTION.liftGapSec`), because the motion of a
  pianist gets smaller as the speed rises (piano 7).
- Each key goes down with its notes, from the note start to the note end (`keyLevelsAt()`), so a
  seek and a mute give the correct keys at once.
- The paw moves in for a black key, so the claws lie on it, as a pianist moves the hand in toward
  the fallboard (piano 5, `pianoKeyFront()`).
- The piano is larger than a real grand piano (`PIANO_SCALE`), because the bear is large. The keys
  stand near the bear (`PIANO_FRONT_H`), because farther keys pull the haunch into the bench, and
  nearer keys fold the shoulders.
- The trunk leans toward the piano, less than the flexion of a posture that is not neutral, and
  the shoulders turn down (`lean`, `shoulderDrop`), as a pianist keeps the shoulders low (piano 3).
  The trunk sits tall with a small lean (piano 3). Reason: a larger lean puts the trunk of the bear
  over its knees, as if it stood up. The keys stand on a lifted piano at the height that the
  upright trunk needs (4.6), so the paws reach their keys.
- The elbows point out and a little down (`poleL`, `poleR`), so the arms stay clear of the round
  trunk, as the elbows of a pianist do not touch the torso (piano 4), and the forearms are almost
  level with the keys (piano 1). Reason: elbows that hang far down by the wide belly put the arms
  deep into the trunk, and elbows that point up slope the forearms down to the keys.
- The trunk leans toward the keys of the paws over a window of song time (`sideLeanAt()`), so it
  moves smoothly toward the register of a passage, as a real pianist.
- The right foot presses the damper pedal with the sustain pedal of the score (CC 64,
  `pedalLevelAt()`), and the synth reads the same events.

**Harp** (harp 6): the palm faces the string of its note and pulls away to pluck. The left palm
also faces a little down (`HANDS_HOLDS.harp.faceL`), so that the left wrist stays near straight,
as the wrists of a harpist go only a little down (harp 4). Reason: the short upper arm of the deer
cannot bring the left elbow near the plane of the strings, so the left forearm points into the
strings. With the palm square to the strings, the left wrist bent back past the paw swing limit of
the arm gate in the rest, in the lift, and in the play. The turned paw comes nearer to the
strings at the knuckles, so the left palm stays further from the strings (`palmL`), and the
knuckles stay out of the neck of the harp.

**Choir** (`pose/choir.ts`): the `jaw` bone opens the beak for each note and closes it to half
between two notes, so that each note shows (`CHOIR_MOTION`). Neighbor voices sway to opposite
sides, so that the choir does not move as one block. The flippers hold the outer edges of the
folder with the elbows down and out (`CHOIR_HOLD`), on a wide folder (`CHOIR_FOLDER`). Reason:
the rebuilt flippers are free round arms, and with the elbows of the old flippers the upper arms
went into the chest. A larger turn of the elbows turns the grips off the accepted grip.

## 5.4 Conductor

The bear beats real beat patterns from the time signatures and the tempo map. A conductor beats a
fast bar in fewer beats, so the baton beats no faster than `ONE_BEAT_TEMPO` of `score/beats.ts`.

| Time signature | Pattern (`barPattern()`) |
|---|---|
| 2/x, 3/x | 1 from `ONE_BEAT_TEMPO`, else 2 or 3 |
| 4/x | 1 from twice `ONE_BEAT_TEMPO`, 2 from `ONE_BEAT_TEMPO`, else 4 |
| 6/8, 6/4 | 2 from `TWO_BEAT_TEMPO`, else 6 |
| 9/8, 12/8 | 1 or 2 from `ONE_BEAT_TEMPO` in dotted beats, else 3 or 4 |
| others, such as 5/4 | `generic`: one down-up motion for each beat unit |

- At each beat, the baton tip is at the point of the beat (`BEAT_PATTERNS`). Between two beats,
  the tip rises in an arc and comes down at full speed. The size follows the loudness.
- **Count-in.** A click on play does not start the music at once: the conductor first signals the
  players to get ready. The transport starts before the start point (6.5), so the count-in is a
  set of poses at those song times (`COUNT_IN`): a ready pause, then one preparatory beat.
- **Baton.** The bear holds one baton, in the right paw, with the palm down (`CONDUCTOR_HOLD`).
- **Bow.** At the song end, the bear bows to the orchestra (`END_BOW`).
- **Chamber group.** A chamber group has no conductor, so its leader gives the count-in with a
  breath and a nod, as in a string quartet (`leaderOf()`, `LEADER_NOD`).
- **Cues.** The conductor cues each section entry, as a real conductor does (`findCues()`,
  `cueStateAt()`). A strong entry gets the baton, and each other entry the left hand. A cue to
  silent seats does not show (5.5).

  ```text
  time (s)    -1.1        -0.5      0           0.6         1.2
  head, body  |--- turn --|--- on the section --|--- back --|
  left hand     |-- rise -|-- down -|-hold|--- down --|
  baton       the beat pattern goes on in a beat plane that turns half as far as the upper body
  ```

  ```typescript
  /** One cue of the conductor (`pose/cues.ts`). */
  interface Cue {
    entrySec: number; // the first note of the cued entry
    landSec: number; // the entry, or the downbeat of the count-in
    beatSec: number;
    kind: 'hand' | 'baton';
    seats: readonly number[];
    torsoYaw: number;
    headYaw: number;
    headPitch: number;
    handYaw: number;
    batonLift: number; // the extra height of the arc of the baton, in meters
  }
  ```

- **Left hand between the cues** (`pose/conductor-left.ts`). A real conductor uses the left hand
  for the dynamics, for held notes, and for a mirror of the beat (`LEFT_HAND_PLACES`). The places
  stand at the left of the head, so the hand shows from behind.

  ```text
  quiet place --mirror--> --swell--> --fade--> --hold--> --cue or ready--> wrist and fingers
   (always)    (level)    (trend>0)  (trend<0)  (chord)    (5.4 cues)
  each arrow mixes the next place in by its weight, from 0 to 1. A later place wins.
  the playing pose (5.2) then mixes the hanging arm into the result.
  ```

  ```typescript
  /** The data of the left hand that the pose looks up at each frame. */
  interface LeftHandTrack {
    /** The conducted beats, and the weight of each place at each beat, from 0 to 1. */
    beats: Float64Array;
    mirror: Float32Array;
    swell: Float32Array;
    fade: Float32Array;
    /** The held chords, sorted by start, and their starts for the search. */
    holds: readonly Hold[];
    holdStarts: Float64Array;
  }

  /** A held chord: a time with sound and with no new note. */
  interface Hold {
    startSec: number;
    endSec: number;
    /** The sound stops before the next notes, so the fingers close to cut it off. */
    cutOff: boolean;
  }
  ```

## 5.5 Silent seats

A muted seat, or a seat that a solo makes silent, rests: its instruments go down, and only the
idle motion continues. Thus what the user sees agrees with what the user hears. Each player
lowers and lifts with its seeded motion (5.2), with no hold and no scale. A change starts from
the height of each player at the change, from `SeatAudibility.before`
(`changeAudibility()` of `app/transport.ts`).

## 5.6 Camera shots

The cinematic camera of 2.5 films the piece as a concert film does. `cameraAt()` calculates the
camera only from the shot plan, the song time, the transport, and the view. `prepareShots()` makes
the plan one time for each score. Thus a seek, a pause, and a speed change are always correct, and
the same piece gives the same film. `pnpm shot-trace` prints the choice at each cut.

```text
 score ──> layoutScene() ──> layout ──┬──> preparePoses() ──> PosePlan ──> poseAt() ───┐
   │                                  │                                                │
   └──────────────────────────────────┴──> prepareShots() ──> ShotPlan ──> cameraAt() ─┤
                                       (one time for each score)          (each frame) │
                         songTime, transport (6.7, 5.1) ──────────────────────────────>│
                                                                                       v
                                         StageScene.pose() and StageScene.follow(camera)
```

```typescript
type ShotKind = 'wide' | 'high' | 'conductor' | 'side' | 'section' | 'solo';

interface ShotKey {
  azimuth: number;   // radians around y, from +z (the audience) to +x
  elevation: number; // radians above the stage plane
  zoom: number;      // a factor of the frame distance, or of the wide distance
  fov: number;       // the vertical field of view, in degrees
}

interface Shot {
  kind: ShotKind;
  startSec: number;    // the first shot starts at -Infinity
  endSec: number;      // the last shot ends at Infinity
  moveEndSec: number;
  seats: readonly number[];
  part: readonly number[] | null; // the players of a choir part, such as the sopranos
  target: Vec3;        // the camera turns around it
  halfHeight: number;  // half the frame height at the target, or 0 for a wide or a high shot
  composition: { eyes: Vec3; third: -1 | 0 | 1 } | null; // look room and headroom
  from: ShotKey;
  to: ShotKey;
  blendSec: number;    // 0 is a hard cut
}
```

Each camera stands on a sphere around its target. Cinematic mode always shows a frame of
`CINEMA_ASPECT` (21:9, design 2.5), so the planner fits and tests each shot at that aspect. A wide
or a high shot takes `WIDE_FOV`: at 21:9 it shows the horizontal angle of the stage view of a
desktop, so the stage fills the width of the frame. The wide camera cannot come nearer, because
the beam fade of Free mode starts there (4.5).

| Kind | Camera | Shot size |
|---|---|---|
| wide | the default view of 4.5, or a variant (`WIDE_VARIANTS`) | the full stage |
| high | high, near the front | the full stage |
| conductor | behind the bear: close, or over the shoulder at the players | a thigh shot, or a long shot of the players |
| side | low, from the front of one side | a group shot of its front half |
| section | low, from the front of one group | a group shot |
| solo | low, from the front of one player | a knee shot |

- The shots follow the views of `scene.png`. The conductor shows only from behind, as in the
  reference images (1).
- All shots stand low, near the eye height of the players, as the cameras on the railings of a
  concert hall. The wanted camera of each kind stands at `CAMERA_LOWER` of the height above the
  stage top that its nominal elevation gives (`SHOT_KEYS`, `WIDE_VARIANTS`). Free mode and its
  default view keep `DEFAULT_ELEVATION`.
- The section and solo shots have a nominal elevation of 17° and 18°. The rows of a dense layout
  stand near each other, and a higher camera shows the subject apart from the players behind it.
- A close camera first tries the wanted elevation with each azimuth of the grid (the low band).
  Only then it rises in steps up to the tops of `KEY_SEARCH.bands`, because a low camera sees
  more heads in the foreground. Each candidate gets the low band and the first band before a
  candidate gets a higher band, except the best candidate at its entry.
- Each move blends its keys with a smoothstep over the full shot and turns around the target, so
  it starts and ends at rest and never cuts through the subject.

**The frame of a close shot.** A 21:9 frame that fits the height of one player shows about 2.3
times its width. Thus a close shot fits the width of its subject with the shot size of its kind
(`SHOT_SIZES`, `shots/shot-size.ts`), from `camera-technique.md`:

- The outline of the subject fills a share of the frame width, seen from each camera, with the
  perspective of its distance. The outline is the hull of the footprints of the subject players,
  with their instruments and seats, up to `SUBJECT_SIZES.outlineReach` from each player.
- Each rule of the frame holds at the end of the push-in, the closest moment of the move, so a
  move never ends closer than its shot size. The low-poly animals show their facets and the seams
  of their meshes from near. Thus a solo is a knee shot and a conductor shot a thigh shot, 1.25
  times larger than a waist shot at the end of its push-in.
- A solo, a section, or the conductor stays inside the side edges, with the target on its third
  line and the look room on the other side. A side view and the view over the shoulder fit a
  sphere, and the frame cuts its deep part. A side view holds the heads and the hands of the
  players in its sphere.
- A side view is a group-shot, so it shows one clear group. Only the players in its sphere are
  subject players: a head of another player in front of them counts in the foreground rule. Their
  eyes and their look set the composition, because the frame holds only them. The eyes of the
  players out of the frame would move the eyes of the group off the upper third line. The side
  camera stays at or below `KEY_SEARCH.sideCeiling`, because views 03 and 04 film the side low,
  and a higher camera looked down on the side over the heads of the front rows.
- At the push-in of the end of the move, the frame then grows until it holds the top of each
  head and the hands and the instruments, with the eyes on the upper third line
  (`FRAME_MARGINS`). The head has no ears (`HEAD_BONES`): a closer shot needs less headroom, and
  a close shot can cut the top of the head (`camera-technique.md`). With the ears, a waist shot
  of a rabbit or a fox showed about seven players. The fit reads each point with the perspective of the camera: a near head
  looks larger, and a high camera sees a back row higher in the frame. A last test reads the
  tops of the heads with the composed camera at the push-in, because the fit does not tilt the
  camera (`HEAD_TEST_PASSES`).
- The shot keeps half the height of its frame (`halfHeight`). The camera stands at the distance
  at which its field of view shows that frame, so the camera does not depend on the aspect of
  the view.

**Cuts and choice.** A cut falls on a downbeat or on the middle beat of a bar, with a bonus for a
phrase line (`CUT_BONUS`). The camera films the player who just started to play: a cut at an
entry gets the largest bonus. The first shot starts at the default view, as the establishing shot
of a concert film, and it cranes down to the low wide view while it pushes in and zooms in to
`WIDE_FOV`. The last shot cranes up from the low wide view into the default view, so a play from
the start after the end makes no cut. The planner reads the music after the cut (`MUSIC_RULES`): the share of each group, the
entries, a tutti, and the lead, because a concert film follows the melody. Then these rules apply,
in this order (`CHOICE_WEIGHTS`, `SHOT_TIMES`):

1. No repeat of the kind and the subject of the previous shot.
2. No section or solo shot of the group of the previous shot.
3. Spacing: a wide, high, conductor, or side shot waits some shots since the last one.
4. Variety: a subject that the film showed lately loses score.
5. Seeded jitter.
6. The best candidate with a clear camera wins. Else the previous shot holds.

A score with fewer than `SMALL_GROUP_SEATS` seats gets no conductor shot, because the back of the
bear gives weak frames of a solo. Mute and solo do not change the plan.

**Film grammar.** The shots obey the rules of a concert film of
`docs/reference/camera-technique.md`, with the limits of `FILM_GRAMMAR` (`shots/grammar.ts`).
`pnpm shot-trace --rules` counts the breaks of each rule over all demos.

- **The line.** The default view is the master shot. Each camera looks at most `lineAzimuth` away
  from the audience axis, so the stage keeps its left and right sides on the screen. A close
  camera also keeps the screen direction of the look of its subject in the master shot: its
  seeded offset goes to the side of the front where the master camera stands. A look within
  `neutral` of the camera axis has no direction, so it fits both sides.
- **The 30° rule.** Each shot turns the camera by at least `jumpAngle` around its target from the
  end of the previous shot, or it changes the size of the frame at the target by `jumpSize`. The
  planner tests each shot against the previous shot, also of another subject, so the rule holds
  for two shots of one subject. A wide shot takes the next variant that passes, a high shot takes
  its largest azimuth on the same side, and else the candidate has no camera.
- **Moves across a cut.** A move goes on three axes: an arc to the right or the left, a rise or a
  fall, and a push-in or a pull-out. A part of at least `moveShare` of the distance counts. The
  arc of a shot goes in the direction of the arc of the previous shot, so no move reverses at the
  cut. When that arc would leave the front range, the shot only pushes in. After a still axis,
  the seeded direction holds. The last shot cranes up into the default view, because a pull-out
  reverses the push-in of the shot before it.
- **Look room and headroom.** A close shot of a player, a section, a side, or the conductor has a
  `composition`. Its camera turns with no roll, so that the eyes of the subject stand on the upper
  third line (`thirdLine`) and the target on the third line away from the look. A neutral look
  keeps the target in the middle. The tilt stays within `maxTilt`, so the target stays in the
  frame. The camera still turns around the target, so the moves and the clearance do not change.
  The foreground tests read the frame of the composition, with the middle of the subject at the
  place of the target.

**Clearance.** The camera never stands inside a player, and the subject does not hide. The
planner tests each move and sight line against the boxes of `layoutObstacles()`, at
`CINEMA_ASPECT`, because each view shows that frame. The frame tests (`shots/test-shot-frames.ts`)
copy these numbers of the design:

- The line of sight from 0.3 m outside the target crosses no box, except the boxes within 0.4 m of
  the target.
- No head in the foreground of a close shot has a radius above 0.24 of half the frame height,
  except the blurred head of a dirty frame.
- No other object nearer than 0.9 of the focus depth covers more than 15% of a 20 × 20 grid,
  except the blurred boxes of a dirty frame.
- Each camera keeps 0.6 m from each box, 1.0 m from the podium and the conductor, and 0.6 m above
  the stage top.
- A camera stays on one side of the beam cone for a full shot, because a crossing darkens the
  image at once.
- The instrument of a subject player does not cover its eyes. `shieldOf()` makes boxes of the
  instrument in bands of 4 cm of height (`SHIELD_BAND`). At each sample of the move, the segment
  from 3 cm in front of the eyes to the camera crosses none of these boxes (`HIDDEN_FACES` is 0),
  for each player of the subject. A solo shot tests its principal player only. The refusal is
  `face`.

**The dirty frame.** A low close camera sees the heads of the rows in front of its subject. As
the shoulder of an over-the-shoulder shot (`camera-technique.md`), a near head or a near box of
another object can stand at one side edge of the frame, when the depth of field of 4.5 blurs it
(`FOREGROUND.dirtyBlur`). Its inner edge stays in the outer part of the frame width
(`FOREGROUND.dirtyShare`), and all dirty heads of a frame stay at one side. A head over the
subject always counts. Thus a solo camera can stay low behind the front rows.

**The distance to the animals.** No point of an animal body in the frame of a close camera comes
nearer than `ANIMAL_FLOOR` at a sample of the move (`NEAR_SAMPLES`). The rule holds for each
animal in the frame: the subject, a neighbor, and a blurred head or body of a dirty frame. A
blend keeps the floor at the same samples of its own path, because its camera moves between the
moves of two shots. A blend that cannot keep it becomes a hard cut. The
low-poly animals show their facets and the seams of their meshes from near. The floor is 1.25
times the 5th percentile of the distance of the nearest animal of the side views, the closest
kind of shot of `pnpm shot-trace --rules`. The body is the mesh of the animal in the bind pose,
with no instrument.

**Transitions, beam, and light.** A hard cut is the default. A blend is a short camera move in a
slow or quiet window between two close shots (`BLEND_RULES`, `isCloseShot`), because a true
dissolve needs two renders for each frame.
The beam fades in the close shots, because a close camera sees the additive beam over the full
image. A close shot gets its own soft key, a kicker, and a stronger vignette, as a film crew
lights each setup again (`SHOT_LIGHT`). The weights come from the kind of the shot, so they do not
change in a shot.

```typescript
const SHOT_BEAM_OPACITY = {
  wide: 1,
  high: 1,
  conductor: CLOSE_BEAM_OPACITY,
  side: CLOSE_BEAM_OPACITY,
  section: CLOSE_BEAM_OPACITY,
  solo: CLOSE_BEAM_OPACITY,
} as const satisfies Record<ShotKind, number>;
```

During play, `cameraAt()` uses `t = max(songTime, transport.startSec)`, so the count-in holds the
camera of the start point.
