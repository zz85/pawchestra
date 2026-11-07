# 4. Stage, cast, and look

## 4.1 Look

- Low-poly shapes with flat facets and matte colors from the reference images. The fur of a
  studio body shades smooth across the small angles between its faces and keeps its larger
  edges. The props and the plain parts of the instruments keep flat faces. The glossy parts of
  the instruments shade soft (4.5, materials).
- A cinematic stage light. The key light goes from the front of the stage to the back, so the
  shadows fall back. Rim lights behind the stage light the heads and give the visible beam, with
  haze and dust motes (4.5, light and render).
- A dark concert hall with two balcony tiers and rows of small warm lamps around the stage, as
  in `scene.png`. The lamps of the balcony rails go all around the hall. The low row of wall
  lamps has a gap at the back, so that no lamp floats above the orchestra. The lamps bloom, and
  in a close shot they become soft discs.
- A square stage of glossy walnut planks with cut corners, a raised lip, and no steps, as in
  `orchestra-latest.png`. Yellow chairs and black music stands.
- Post effects make the image of a film: a bloom, a depth of field in the close shots, a warm
  color grade, a vignette, and a fine grain (4.5, post effects).
- The bear conductor stands on a podium at the front center. A chamber group of at most 5
  players has no conductor and no podium (4.2).

These product choices apply to each area:

- **Reference images first.** The reference images win over the values in the code. The
  values that 4.5 to 4.7 name describe the current models, and they are no targets. Design 1
  says which image wins where two images differ. A newer product choice wins over an image, and
  its section names it.
- **Happy faces.** Each animal has a happy face. A face rule of the rig removes a sad look, such
  as raised inner brows or a crease that goes down over the eyes (4.4, mesh rig). The faces have
  no blush.
- **Natural balance.** A body that stands, or that plays with no chair, keeps its center of mass
  over the middle of its soles, where a real stance is most stable (4.4, seat).
- **No fur shading.** The material has no fur shader, no tufts, and no shells (4.5, materials).

## 4.2 Layout

The sections go into arcs in the standard order, with no gaps between the used sections. The
stage size follows the player count. Thus a string quartet sits close together on a small stage.

The standard order is the seating plan of a modern orchestra that the user gave: the strings
in wedges on both sides, the woodwinds in the middle, and the brass and the percussion at the
back. The diagram shows it from above.

```text
                          back of the stage
┌──────────────────────────────────────────────────────────────────┐
│                        choir (on risers)                         │
│ last: keyboard harp percussion | timpani trumpets | trombones tuba│
│ row 3:  violins          |       horns        | cellos  basses   │
│ row 2:  violins          | clarinets bassoons | violas cellos    │
│ row 1:  1st vl  2nd vl   |   flutes  oboes    | violas cellos    │
│ row 0:  1st vl  2nd vl   |                    | violas cellos    │
│     soloist (piano)        [bear on the podium]                  │
└──────────────────────────────────────────────────────────────────┘
                        front of the stage
```

- The strings sit in wedges (`STRING_WEDGES` of `models/layout-scene.ts`): from the left edge,
  the first violins, then the other violins; from the winds to the right edge, the violas, the
  cellos, and the contrabasses. Each wedge spreads over the string rows from the front, desk by
  desk, so the two players of a desk share a row and a stand. The contrabasses fill their wedge
  from the back. The count of string rows follows the fuller side (`STRING_ROW_PLAYERS`), up to
  `MAX_STRING_ROWS`. The rows spread to the side edges (4.5, seat geometry).
- The woodwinds and the horns sit in the middle of the string rows (`MIDDLE_ROWS`), with no wind
  in the row of the conductor. The last row (`BACK_ROW`) holds the rest.
- A keyboard of the orchestra (a celesta, a harpsichord, or an organ that is not the soloist of
  3.8) sits at the left of the harp, as the celesta of a professional orchestra. With no harp and
  no woodwinds, it sits in the middle behind the strings, as a continuo harpsichord.
- The vocal soloists of 3.8 stand in front of the choir, on the lowest level of the risers,
  because a place beside the conductor covers the first violins or the cellos.
- The soloist of 3.8 stands or sits at the front left of the conductor, as in a concerto. A
  piano seat is always the soloist (3.8), so the piano stands there. Another soloist leaves its
  section row and stands next to the podium (4.5, seat geometry). It has no music stand, because
  a soloist plays from memory.
- **Chamber group.** A score with at most 5 players has no conductor and no podium, because a
  conductor for one pianist looks wrong. The players sit in a small arc at the stage center and
  face each other a little, as a real chamber group does. A score with no players keeps the
  conductor, so that the stage is not empty. `chamberFormOf()` of `models/cast.ts` gives one of
  three forms:

  ```text
     solo              recital                     arc (a string quartet)
                    ┌───────────────┐
                    │ (P)    piano   )                  (V2)  (Va)
      (X)           └──────────────(  )            (V1)            (Vc)
                               (S)
   ────────────────────────────── audience ──────────────────────────────
   X: the player alone, P: the pianist, S: the partner in the crook of the piano,
   V1, V2, Va, Vc: the first violin, the second violin, the viola, and the cello
  ```

  - **Solo.** One player at the stage center faces the audience, with no music stand.
  - **Recital.** A pianist and a partner in the crook of the piano, as in a recital.
  - **Arc.** Two to five players in one arc, in the order of the rows, so a string quartet sits
    in the classic half circle. The players of an arc sit.
  - No player leaves the group as a soloist. A player alone and the partner of a pianist stand
    when their instrument stands as a soloist (4.5, supports).

- Larger species sit farther back, so that a big animal hides no smaller animal. In the default
  view, a large species hides less than 10% of the head of each smaller animal.

## 4.3 Species

Each species has one `SpeciesParams` in `SPECIES` of `models/species.ts`, and each species has a
studio body of its own (4.4). The table gives the species of each section.

| Section             | Species                                       | Section  | Species                    |
| ------------------- | --------------------------------------------- | -------- | -------------------------- |
| Violin, first seat  | rabbit (reference)                            | Flute    | fox, light tan (reference) |
| Violin, second seat | fox, red-orange with a white face (reference) | Oboe     | mouse                      |
| Viola               | cat                                           | Clarinet | wolf (`animals.webp`)      |
| Cello               | dog                                           | Bassoon  | beaver                     |
| Contrabass          | hippo                                         | Horn     | pig                        |
| Harp                | deer                                          | Trumpet  | monkey                     |
| Piano               | polar bear                                    | Trombone | panda                      |
| Timpani             | elephant                                      | Tuba     | rhino                      |
| Percussion          | badger                                        | Choir    | penguin                    |
| Conductor           | bear (reference)                              |          |                            |

- The fox plays in two sections, in the two colors of the reference image (`fox-red` and
  `fox-tan`). The two foxes share one mesh and one rig, and the tan fox takes another palette of
  the same faces (`palette`).
- The polar bear plays the piano and each keyboard seat of 3.8. The wolf is the gray clarinet
  player of `animals.webp`. The penguins look like a choir in robes.
- The mouse, the beaver, and the monkey play with no chair (`noChair`), as a real mouse, beaver,
  or monkey stands on its hind legs (4.4, seat).
- Further seats of a section alternate their species variants: a third violin seat uses rabbits
  again.

```typescript
/** The parameters of one species (`SPECIES` of `models/species.ts`). */
interface SpeciesParams {
  /** The head height `H` of the studio body, in meters. */
  headHeight: number;
  /** The height of the seat above the floor, in H: the length of the seated legs. */
  seatHeight: number;
  /** The fur, the belly, and the accent colors (4.5). The UI seat dots read them. */
  colors: SpeciesColors;
  /** The studio body of the species (4.4): `'studio-rabbit'`, `'studio-fox'`, and so on. */
  body: StudioBodyName;
  /** Another palette of the faces of the body (`StudioBody.palettes`): the tan fox. */
  palette?: StudioPalette;
  /**
   * The scale of an instrument of `SCALED_INSTRUMENTS` for the species (4.6), 1 by default.
   * Also `violaScale`, `celloScale`, `bassScale`, `fluteScale`, `oboeScale`,
   * `clarinetScale`, `bassoonScale`, `trumpetScale`, `cymbalScale`, and `harpScale`.
   */
  violinScale?: number;
  /** `'suspended'` for a species whose arms cannot hold hand cymbals (4.6). */
  cymbalForm?: CymbalForm;
  /** The lengths of the longer lead pipe of the tuba, back and left, in meters (4.6). */
  tubaPipe?: readonly [back: number, left: number];
  /** True for a species that plays with no chair (4.4, seat). */
  noChair?: true;
  /** The place and the turn of the bow stick in the right paw (4.6). */
  bowGrip?: BowGrip;
  /** A seated tail that lies on the seat, and does not sway (5.1): the cat. */
  seatedTail?: 'curl';
  /** Ears that hang beside the head, and do not twitch (5.1): the dog. */
  hangingEars?: true;
}
```

The head height `H` is the unit of the body. The head height and the seat height of a species
come from its studio body (`StudioBody.headHeight`, `StudioBody.seatHeight`). The bear has no
studio seat, so it uses a seat of 0.75 H. The holds of 4.6
give their offsets in `H`, so one hold serves the species of different sizes.

## 4.4 Models

Code builds the instruments and the props from low-poly shapes with vertex colors. Each species
has a studio body: a source mesh, rigged into the studio format. The app reads only the modules
of `src/models/studio/`, and the tools make them from the meshes:

```text
user mesh (GLB)  ->  pnpm mesh-intake (keep faces | needs rebuild)
  ->  tools/blender/arm_rebuild.py [--keep-faces]  ->  <a>-arms.glb + <a>-weights.json
  ->  pnpm rig-mesh <a> (tools/mesh-rigs/<a>.json, Blender)  ->  <a>.rig.glb
  ->  pnpm studio-body <a> (no Blender)  ->  src/models/studio/<a>.ts (the app reads only this)
```

A body with a hand rig makes `<a>.rig.glb` with `pnpm rig-export` in place of the two middle steps
("Hand rig").

The rebuild applies only to a body whose arms or legs get new quad faces. A clean quad mesh
(`keep faces`, "Source meshes") keeps its faces, and the step adds only the arm segments and the
weights. The rig of another body reads the source mesh. The rebuild takes its settings from the
joints of the config and from the mesh, so that a new mesh gets clean arms with no work by hand.
Each face takes one color, so a face across a color edge of the old arm gives a saw-tooth edge.
The rebuild thus puts a ring at each color edge across the arm. A species script
`tools/blender/<a>_arms.py` replaces it only for a fault that it does not fix. An arm that the
mesh joins to the trunk down to the elbow has no free section. A species script frees it with a
side wall on the trunk (`tools/blender/cat_arms.py`), or splits it from the trunk along its crease
in a copy (`tools/blender/beaver_edit.py`). An arm that joins the trunk only near the shoulder has
a free section, but the shoulder line then lies far down the upper arm, and the long thin faces
above it fold when the arm lifts. So the badger copy splits its crease too
(`tools/blender/badger_edit.py`), and the tube starts near the shoulder joint. The flipper of the
penguin joins the trunk in a deep crease down to the elbow, so its copy splits the crease too
(`tools/blender/penguin_edit.py`). A flat arm has rays of different lengths with no trunk in the
section, so the free test of the rebuild takes a larger ratio for the flipper (`--spec` key
`free`). The old faces keep their colors, so that the black and white edge of the trunk stays.
The new faces of the side wall take the black of the flipper, except forward of one straight
edge along the flank line under the flipper, where they take the white of the side. Reason: the
flank rule of the rig made the wall faces white one by one, with a saw-tooth edge. The `README.md` of
`assets/models/<a>/` gives the source and the steps of each file.
[`docs/agents/rigging.md`](../agents/rigging.md) gives the details and the traps of the rig.

### Source meshes

- **Fidelity.** A source mesh stays as it is. The rig adds no stretch of a limb, unless a
  product choice sets an arm or a leg factor. The props and the instruments fit the body: each
  chair fits the legs, and a species with short arms plays a smaller instrument in place of
  longer arms (4.6). Each edit goes into a copy that a script of `tools/blender/` makes, so the
  source file stays unchanged and a run gives the same bytes again. A point edit of a rig file
  goes into an edit file, and `pnpm glb-point-edits` writes it into the rig file of a base commit.
  The cat has such edits, because a run of `pnpm rig-mesh cat` no longer gives its rig file.
- **Replacing body.** A new body of a species keeps three things of its old body in the app view:
  the chair, the seat height, and the leg length. The source mesh sets the head, the face, the
  girths of the arms and the legs, the paws, and the tail. Reason: rules that copied the old body (a
  smaller head, thinner arms) made the cat differ from its own mesh, and its paws then looked too
  large. The leg factors stretch the legs to the old seat, so the stretched legs take a girth
  across their axes (`legGirth`) that keeps more of the stocky look of the legs of the mesh: of the
  girth variants, the one whose mid thigh and mid shin widths, as a share of the head height and of
  the hip width, are nearest to the mesh. The leg turns of the seat (`studio.legTurns`) keep the
  knees of the old body. The trunk length and the trunk shape stay a
  product choice of the form keys of "Mesh rig" (`trunkFactor`, `girthProfile`). `pnpm body-shape` measures the seated bind: the width and the
  depth of the trunk at 10 heights from the seat to the neck joint, the girths of the limbs at their
  middles, the knee and the ankle gaps from the front, the distance of the shoulder joints, and the
  bulge of the back line behind the line from the waist to the neck. A width row of `girthProfile`
  at the shoulder joints moves the joints and the arm roots in together, so the arm root keeps its
  form. The arms then hang nearer to the trunk, and the hold turns the elbows out where they go into
  the body (5.3). On a T-pose body, the cut near the armpits goes through the level arm roots, and
  the trunk share of the painted weights (`weights.paintedBelow`) counts them as trunk. So that
  width row measures the arm roots, and a width row of `girthProfile` does not change it: the images
  of the app view judge that height.
- **Colors.** The texture shows as one color for each face. A color rule of the rig can move the
  fur toward the color of the species in the reference images.
- **Color edges.** A large face across a sharp color edge gives a saw-tooth edge, or an angular
  eye patch. A script cuts such faces along the edge in a copy (`tools/blender/penguin_edge.py`,
  `panda_edge.py`), and each new vertex lies on an old face. The rig takes the weights of the mesh
  before the cut (`weightSource`). Where the weights change fast, such as at the clavicles, the
  skin moves a new vertex off the line of its old edge, and a small new face turns over in the
  play. There the cut adds few and large faces: it splits no face at the middles of its edges, and
  a change near a corner goes through that corner. The texture has a soft gray step at each edge,
  so a face of the edge takes the larger half of its samples (`colors.split`).
- **Intake spec.** A new mesh comes with clean quad faces, so that its arms keep their faces: the
  rig adds only the arm segments and the weights (`arm_rebuild.py --keep-faces`). `pnpm
  mesh-intake` checks each point of the intake table below with the limits of
  `tools/blender/mesh_intake.py`, and gives the verdict `keep faces` or `needs rebuild`. The rig
  fixes the meshes that exist.
- **Triangle budget.** The budget of a studio body allows round forms, such as a round tube for
  each arm (`STUDIO_TRIANGLE_BUDGET`, `STUDIO_MESH_GZIP_BUDGET` of `tools/studio-budgets.ts`).
  The first download of 1 MB and the frame time of 9.7 stay the limits.
- **Licenses.** The project author made the meshes with Meshy on a paid plan, and holds their
  rights. The files of `assets/models/` and `src/models/studio/` are under CC BY-NC 4.0 (the
  `README.md` of the repository), with no entry in the third-party license file (7.3).
- **Test mannequin.** `tools/blender/mannequin.py` makes an original test body for the rig chain
  and for the Mixamo route (`assets/models/mannequin/README.md`). The preset `human` has the
  proportions of an adult of 1.8 m, and the preset `animal` the mean proportions of the wolf and
  the rabbit. A band and a front stripe on each limb show a twist. The palm and the back of the
  hand have two colors, and the two sides have two tints. Each joint has quad rings of 16
  vertices. The species `mannequin` has the animal preset with its own faces as its body
  (`arm_rebuild.py --keep-faces`), and no section casts it.
  The role tools test it with a recast role, such as `violinist@mannequin`. A test body loads
  apart from the bodies of the app (`loadTestBodies()` of `models/studio-body.ts`), so the first
  download does not grow by it.

| Intake point | Target | Reason |
| --- | --- | --- |
| Pose | An A-pose: each upper arm 30° to 45° below the horizontal (`POSE`). | A hanging arm and a raised arm then bend the shoulder about the same angle from the bind. |
| Arm gap | A gap between each arm and the trunk: the arm is free of the trunk from a shoulder line before `FREE_ARM` of the upper arm, and the free arm stays `GAP` arm radii from the trunk and the legs. | An arm that touches the trunk needs a cut with a flat cap, and bone heat then spreads the arm weights into the trunk. Both give flaps at the armpit. |
| Limb rings | Each arm and leg is a quad tube. Its rings have 16 vertices (at least `RING_VERTS`), stand at a right angle to the bone (`TILT`), and lie about 0.45 to 0.5 radii apart (at most `SPACING`). | Short arm segments keep each turn step small, and close rings keep the faces between them from a spiral fold. A ring of fewer vertices shows a flat side when the arm twists. |
| Joint rings | At least 3 rings within one radius of each elbow and knee, and 2 of each wrist (`JOINT_RINGS`). | The helper bone of a joint spans these rings, so that the bend spreads over several faces. |
| Color edges | Each color edge of the texture lies on a ring or another edge, and no arm face crosses one (`COLOR_FACES`). | Each face takes one color, so a face across a color edge gives a saw-tooth edge. |
| Faces | At least `QUAD_SHARE` of the triangles in quads, and at most `STUDIO_TRIANGLE_BUDGET` triangles. | A triangle stops an edge ring. The budget keeps the download and the frame time. |

The check reads the rings along each arm, and the rings across each knee. A GLB file holds only
triangles. The glTF exporter writes the two triangles of a quad one after the other, so the check
joins each such pair into a quad again.

### Rules of each body

- The animal faces -z, with its left side at -x. The mouth is near the middle plane, below the
  eyes. The bones have the names of 4.7, so that the pose code of section 5 drives each body.
- Each player is one `SkinnedMesh`: the body, the instrument, and the bow merge into one mesh,
  with one draw call. One `Mesh` for each part gives about 25 draw calls for each animal, which
  is too many for an integrated GPU. The static props merge into a few meshes.

### Export

`pnpm studio-body <animal>` reads the rigged GLB file with no Blender and writes the module. The
entry of the animal in `ANIMALS` of `tools/studio-body.ts` gives its settings. A hand rig holds
the facts of its body in its `.blend` ("Hand rig").

- It turns the animal to face -z and scales it. It drops the props and the clips of the GLB file,
  because the app keeps its own, and it joins the digits of a paw into one `fingers` bone.
- It drops the eyes of the mesh, and puts the pea eyes of the app on eye bones of their own, so
  that they blink. A body can scale, level, move, or turn its eyes (`eyeSize`, `eyeLevel`,
  `eyeShift`, `eyeNormal`). A hand rig gives its eyes with objects of its `.blend` ("Hand rig"),
  with no rule. An old eye that stands out as a ball in a groove shows a light rim
  around the pea eye, so the head fills it first (`eyeFill`). Each eye bends to the head surface
  (`eyeBend()`), so its rim lies at the fur. Both eye lights show on the upper left, as the reflection of one lamp does.
- The tip of the nose comes from the vertices near the middle plane (`NOSE_PLANE`), or below a
  horn (`noseTop`). The head measures leave out a long nose, the whiskers, and the antlers
  (`headFloor`, `headCeiling`), because the holds in `H` start at the head.
- **Scale.** The scale keeps a landmark that the scene depends on: the shoulders of the bear for
  the conductor stand, and the shoulders, the ear tips, or the head top at the chosen size for
  each other body. A longer leg raises the landmark, so the trunk, the head, and the arms keep
  their size in meters.

### Mesh rig

`pnpm rig-mesh <animal>` rigs a source mesh with Blender: one mesh of faces with one color each,
the skeleton of a studio body (`STUDIO_BONES`), a skin of up to four bones for each vertex,
and up to `RAISE_LIMIT` corrective shapes. The config `tools/mesh-rigs/<animal>.json` gives the
joints and the rules, each with a note. The rig file holds only the animal, so that other tools
can read it, and a role-neutral body holds no prop of a role. The seat of the config goes into the
extras of the asset as numbers ("Seat"), and only the preview images show a chair.

| Group | Config keys | Purpose |
| --- | --- | --- |
| Form | `armFactor`, `legFactor`, `shinFactor`, `headFactor`, `neckFactor`, `trunkFactor`, `trunkTop`, `girthFactor`, `girthProfile`, `armGirth`, `legGirth`, `proportions` | Change a part to a product choice or to the sheet. The head can keep its form. A long thigh can keep its width. A trunk can shorten only below the chest joint (`trunkTop`), so that the arm roots keep their form: the shoulders fold when the chest under them shortens. The trunk can change its width, its front, and its back by bands along its axis (`girthProfile`), so that the back on the chair keeps its place. The arms can become thinner across their axes (`armGirth`). The legs and the tail keep their places. |
| Seat | `studio.legTurns`, `sit`, `studio.trunk`, `chair.front`, `crease`, `sitPose` | Bind a seated role in its pose of 5.2, with the haunch on the seat, or give a standing bind a sit pose. |
| Weights | `weights.*`, `refine.rings`, `refine.pointFlip`, `heatSource`, `weightSource` | Bone heat, with rules and rings that keep the faces at the joints from a fold. A planar split of the faces takes the weights of the mesh before it. The trunk under a T-pose arm root keeps a trunk share of the painted weights (`weights.paintedBelow`), so that a raised arm does not pull the side out. That share also holds the front of the root with the chest, so a hanging arm leaves a dark notch there. A shape of the rest takes the front of the root along with the arm (`raise` with `follow`), and the play keeps the share. |
| Shapes | `raise` | Give the source back in the standing pose, and relax the faces of a bent arm. |
| Arms | `upperTwist`, `armSegments`, `studio.bindSupination`, `studio.bindArms`, `studio.straightArms`, `armSmooth` | Spread the roll of an arm along the arm, so the skin does not twist. |
| Splits | `weights.armSplit`, `weights.armFree`, `weights.armCrease`, `cut` | Free an arm that the mesh joins to the trunk, so a raised arm pulls no flap out. |
| Normals | `cut.skinNormals`, `cut.bodyNormals`, `rootNormals` | Shade a bent arm root, elbow, wrist, or knee soft, with no dark slot. |
| Colors | `colors.tone`, `colors.shift`, `colors.dark`, `colors.border`, `colors.split`, `colors.flank` | Move the face colors toward the reference, and keep the black borders clean. |
| Face | `colors.patch`, `colors.smile`, `soften`, `eyeShell` | Give a happy face: round eye patches, a thin smile line, and no brow crease. |
| Tail, ears, jaw | `studio.tailCurl`, `studio.tailBind`, `tailBall`, `sit.carryTail`, `sit.tailSpread`, `earFlap`, `noseFront`, `weights.jaw` | Lay a tail on the seat or the floor, move a tail ball down with the haunch, let a trunk or a hanging ear follow the head, and open a beak. |

**Arms.** A hold with the elbow out and level rolls the upper arm far, and the linear blend at
the shoulder then twists the skin and squeezes the arm flat. So a body takes a twist bone of each
upper arm (`upperTwist`), or arm segments with a helper bone at the elbow and at the wrist
(`armSegments`). The arms of a body with segments are quad tubes that a script of
`tools/blender/` builds on the arms of the mesh. The bind paw sets the zero of the paw twist, so
the rig turns it toward supination where a hold supinates far (`studio.bindSupination`).

**Straight bind.** A bind that bends a thick elbow or paw (`studio.bindArms`) makes the rest shape
a linear blend of that bend, with the skin on the inner side already pressed. Each pose then blends
its own bend on top of it, and the bent wrists of the bear showed a dark slit that no weight rule
removed. So a body can bind its arms as straight as the source (`studio.straightArms`): the skin
blends one time, from the source. A straight arm has no elbow plane, so the body gives the elbow
axis of each arm (`StudioBody.hinges`). The axis is the axis of the bent bind of
`studio.bindArms`, so that the upper arms and the paws keep their world turns in each pose. The
inner elbow then bends further from its bind, so a `raise` shape of a bent elbow relaxes its faces.
The linear blend of the larger bend also narrows the bent elbow, and a shape cannot widen it.
Weights that keep the forearm and the elbow helper off the upper arm keep the elbow wide, but the
whole bend then falls on the rings at the joint, and the inner skin folds. A fold-free inner
elbow needs a turn ramp about as long as the elbow radius times the bend angle. The relax of a
shape moves only the faces that turn over in the pose of its rule, so the fold can move to the
next faces of the elbow ring. Thus a rule of a bent elbow can turn further than the mean turn of
its folded samples (`--further` of `pnpm raise-fit`), so that its pose also turns over the next
faces.

**Role-neutral bind.** The target of each body is a bind that fits no single role: straight bind
arms, and one bind supination of each paw for all roles. A bind bent for one hold gives a rest
shape that fits only that hold, and each other hold blends its own bend on top. So a body with
the role-neutral bind takes a new role with no new rig, which is the way to one skeleton for each
species and each instrument (Cast matrix). Each body of the app has this bind, except the cat:
its A-pose body keeps the bind of the viola hold, with the elbows bent. A body with `raise` shapes
also fits each shape against all its roles, because a shape fits only the poses near its hold. A
pose gives the bend of a paw off its forearm as an angle (`pawBendR`), so that a new bind keeps
the paw in the world.

The bind supination of each paw is the value that makes the largest paw twist p95 of any role
smallest. The roles are the roles of the cast matrix (`CAST_ROLES`) and the own roles of the body,
each on the sample of the matrix (`CAST_SAMPLE`). A value from two roles only can put the paw twist
of a third role near 180°, where the skin folds and the twist measure flips. A change of the
supination moves each signed paw twist of its side by the same angle, so the signed twists of one
rig give the value of each side (`pnpm bind-supination <species>`). A twist that passes 180° on the
probed rig flips, and its shifted value is then wrong. So a value from a rig with such a twist is a
first value: the body rigs it, and a probe of the new rig gives the change that remains. When the
value of a side makes a clearance of the own role of the body grow in the concert, or dents its
skin in the 2x crops, the own role wins, and the value of that side stays smaller: the concert
plays the own role, and a recast role is only a test.

The forearm segments share the bind supination, so the rest shape holds a twisted forearm. On a
thick forearm, the edges of its thin faces then turn more than the crease angle, and a hold near
the twist of the source shows a dark saw-tooth line under the wrist. So the forearm faces of such
a body take the skin normals with no crease angle (`rootNormals.wrist`, from the elbow side of
the forearm to the paw). A normal rule cannot change the form: on a thick forearm, the
supination can dent the side of the forearm near the wrist, or push the forearm near the elbow
deeper into an instrument.

**Arm gate.** A fold count does not see a twisted or a flat arm. So `pnpm arm-check` reads all
arm measures of each arm against one table of limits (`ARM_LIMITS`), and each change of a pose,
a hold, or a body runs it. The paw twist, the paw swing, and the flat share measure the skin, so
they count from the bind. The grip turn asks if the paw holds its prop in the accepted way of the
role (`ACCEPTED_GRIPS`), which is a question of the pose. So it reads the twist of the paw in the
frame of the posed forearm (`GripFrames`): the axis from the elbow to the wrist, and the elbow
axis of the retarget. The palm comes from the hand of the player, and the zero is its hanging arm
with the palm inward. A new bind of the same pose then keeps each grip, and one entry of a role
holds for each body. A paw that faces its tube in a shared wind hold with the elbow rule (the flute,
the clarinet, and the right paw of the trumpet, design 5.3) has the palm turn in place of the grip turn: the angle between its
palm and the palm of the accepted player of the role, both in the axes of the instrument
(`ACCEPTED_PALMS`). Reason: the hold keeps such a paw on its keys while the elbow rule turns the
forearm of a round body, and a real player keeps the turn of the hand on the instrument with any
build of the arm. The left paw of the shared trumpet keeps the grip turn, because the hold does not
roll it to the tube, so it turns with its forearm. The bowed holds keep it too: no bowed cell of the
cast matrix fails on it, and the bow paw holds the bow.

A new bind of the same bone pose moves the zero of the lines that count from the bind
(`BIND_MEASURES`), so their margin against the base would fail a body for its bind alone. So the
gate keys the bind of each body (the bind heads of the arm bones, the palms, and the elbow axes).
When the key differs from the base, these lines take only their limits, and `REBIND` marks a line
that the margin alone fails. The gate then compares the elbow and wrist ring widths in meters,
because the flat share counts from the bind ring. A body with the same bind keeps the margin, so a
round that keeps the binds stays as strict as before. A rebind must keep the pose of the bones, so
`pnpm arm-check --world --base` compares the posed arm joints and palms of the two trees at the
samples of the gate.

```typescript
/** The bind frames of the grip of one arm (`tools/arm-check.ts`). */
interface GripFrames {
  /** The turn from the frame of the player (down, +x) to the bind forearm and its elbow axis. */
  readonly fore: Quaternion;
  /** The turn from the frame of the player (down, inward palm) to the bind paw and its palm. */
  readonly paw: Quaternion;
}
```

**Cast matrix.** The goal is one skeleton with which each species can play each instrument.
`pnpm cast-matrix` measures the way to it: it recasts each species into each role (a recast role,
see "Retarget and render"), and runs the arm gate and the clearance sweep with its note targets
on the shortest demo of the role. A recast pair plays the shared hold of the instrument, because an
own hold would hide a fault of the body. A violin or a viola takes the size of the rule of a violin
shop, a cello the cello rule, and a trumpet, a clarinet, or a flute the size rule of the winds,
each clamped to the real sizes (4.6). Each other instrument keeps the size of the app. The recast
roles of `pnpm arm-check`, `pnpm pose-depth`, and `pnpm close-views` take the same size
(`tools/recast-scale.ts`), so that a run of one pair measures its cell. `--quick` takes a coarse
sample, so that a round finds the faults of a pair early.
`--set` and `--variant` change the holds in memory, as the other hold tools do, so that a try
needs no edit of the source. A value over its limit fails, unless the own pair of the role has the
same open item. The grip of each pair counts from
the accepted grip of the role, because the frame of the grip does not move with the bind. Run the
matrix after a change of a shared hold, a bind rule, or the skeleton, and compare the counts of
each verdict. A shared hold can turn a hanging bind arm 110° or more from the bind, while the
clavicle turns little. The linear blend then crushes the front of the arm root. A `raise` shape of
that hold relaxes the root, because rigid faces or a Smooth of the weights only move the fold. A
body has few shapes (`RAISE_LIMIT`), so a shape goes to the recast holds with the most folds.

### Hand rig

A body can also come from a rig that a person or an agent makes by hand in Blender, saved as
`assets/models/<s>/<s>.blend`. `pnpm rig-export <s>` (`tools/blender/export_rig.py`, headless
Blender) reads it and writes `<s>.rig.glb` in the format of "Mesh rig". Thus `pnpm studio-body`,
the app, and the gates (`arm-check`, `cast-matrix`, `pose-depth`, `close-views`) do not change.
Reason: `pnpm rig-mesh` calculates each rig again from the source on each run, so a rule for one
fault also moves vertices that the rule was not written for. A fix by hand is local, and it shows
in Blender before the export. A pose in Blender skins from the T-pose and the app from the bind, so
`pnpm pose-preview` and `tools/blender/studio_preview.py` show the app pose of each moment on an
export of the open `.blend`, with the bind as its rest.

The polar bear has the one hand rig of the app (`assets/models/polar-bear/polar-bear.blend`), from
a Tripo retopology of its mesh. Each other body comes from `rig-mesh`. The hand rigs of the cat and
the rabbit are trials that the app does not use. Reason: they gave a thin, faceted arm root and
other faults, so the cat and the rabbit keep the A-pose bodies that production shows. A trial
keeps its `.blend`, its export, and its summary in `assets/models/<s>/hand-rig/`, so that no tool
takes the trial for the body of the app: `pnpm rig-export <s> --blend <file> --out <file>`
exports it there.

```text
source mesh  ->  edits by hand in Blender (loop edges, smoothed vertices)  ->  mesh of <s>.blend
  ->  add_surface(..., eye_fans=False) of tools/blender/studio_armature.py (face colors, gloss nose)
  ->  armature, weights, bind, and shape keys by hand (studio_armature.py can start them)
  ->  eye objects (place_eyes() of tools/blender/studio_eyes.py)
  ->  pnpm rig-export <s>  ->  <s>.rig.glb + <s>.rig.json (a text summary for diffs)
  ->  pnpm studio-body <s>  ->  src/models/studio/<s>.ts
```

The mesh of the `.blend` is the source of truth, and no tool makes it again from the source file.
`add_surface()` runs one time on that mesh: each face takes the color of the base color texture
of the source (the GLB file, or the image file of an FBX source) through the UVs of the mesh, by
the color rules of "Mesh rig" (`face_colors()`, `palette()`). The faces of the old eyes take the
fur color, and with `eye_fans=False` the mesh gets no gloss fan on them, because the eye objects
give the eyes. Then a person edits the colors in Blender, and the export reads
them only from the face attribute `color`. The `.blend` holds the data that a person draws. The
export calculates only the measures, with the functions of `tools/blender/rig_mesh.py`, so that
each measure has one definition. It checks each point of the layout below, and stops with the
name of the first fault.

Each value of a hand rig, such as the bind, the joints, the weights, the keys, the pea eyes, and
the facts of the body, lives only in its `.blend`. The pea eyes are objects of the `.blend`, so
that Blender shows the eyes of the app, and no rule of `pnpm studio-body` moves or sizes them. The
facts of the body (`BODY_FACTS` of `tools/studio-body.ts`), such as the scale, the crease angle,
and the width of the chair, are custom properties of the armature, so that each fact has one
place beside the rig that it fits. `ANIMALS` keeps only the settings of the app: the landmark,
the role, the constant, and the GLB file. A tool reads each value from the export
(`<s>.rig.glb` or its summary `<s>.rig.json`), never from the rig config
`tools/mesh-rigs/<s>.json`, which keeps the values of the old chain. `pnpm rig-mesh <s>` stops
for a body with a `.blend` beside its GLB file (`handRigOf()` of `tools/glb-swap.ts`).

| GLB item | Hand rig |
| --- | --- |
| Joints and parents | The bones of the armature, in the order of `STUDIO_BONES`, with the parents of `STUDIO_PARENTS`. |
| Bind nodes, inverse bind matrices | The world frames of the bones in the Action `bind`. |
| `POSITION` | The mesh in the bind: the basis and the shape keys `bind*`, moved by the linear blend of the bones. |
| `JOINTS_0`, `WEIGHTS_0` | The vertex groups. |
| `COLOR_0`, `COLOR_1` | The face attributes `color` and `color_base`, in linear RGB. |
| Materials `fur` and `gloss` | The material slots. |
| Targets `arm_raise_*` | The shape keys of these names: the move of the bind mesh from the key at 0 to the key at 1. |
| Targets `arm_down_*`, `legs_straight_*` | Calculated: the moves that give the source back in the pose of the sheet (`correctives()`, `split_shapes()`). |
| Clip `reference` | The rest pose of the armature: the pose of the sheet. |
| `seat` | The custom property `seat` of the armature. The export measures the top (`seat_masks()`). |
| `raise` | The custom property of the mesh that has the name of each key `arm_raise_*`. |
| `hinges` | The custom property `hinges` of the armature. |
| `eyes` | The eye objects `eye_L` and `eye_R` in the bind: the middle, the unit direction, and the size of each eye (`eyes_of()`). |
| `body` | The custom properties of the armature that hold the facts of the body (`BODY_FACTS`). |
| `caps`, `rim` | The boolean face attributes `cap` and `rim`. |
| `trunk` | Calculated: the largest turn of a trunk bone from the pose of the sheet to the bind. |
| `headFactor`, `neckFactor`, `headShift`, `upperTwist` | None. The mesh holds the form, and the arm segments replace the twist bone. |

The layout of the `.blend`:

- **Units and axes.** One Blender unit is one unit of the studio: the T-pose source is 1 unit from
  the soles to the top (`load_mesh()`), with the soles at z = 0. The animal faces -Y, with its left
  side at +X. A form change in the mesh, such as longer legs, keeps the units, so that the facts
  in units, such as `headFloor`, keep their meaning. The mesh and the armature have no transform.
- **Objects.** One mesh, one armature, and the eye objects `eye_L` and `eye_R`. The export skips
  the objects of other types. The custom properties of the armature are on the armature object,
  and the export also reads them from the armature data.
- **Armature.** The rest is the T-pose of the source. The bones are the bones of `STUDIO_BONES`
  with no eye bones: the body bones, the optional `tail_tip` and `jaw`, and all or none of
  `ARM_SEGMENT_BONES`. The Z axis of each bone points to its hint, at a right angle to the bone,
  as `frame()` of `rig_mesh.py` does: up (+Z) for `root`, the feet, the toes, the tail, and the
  jaw, the palm for the arm bones and their segments and helpers, and forward (-Y) for the other
  bones. Each bone has one B-Bone segment, the quaternion rotation mode, and no constraint.
- **Bind.** The Action `bind` holds the seated, role-neutral bind ("Role-neutral bind") at its
  first frame. A bone with no key keeps its rest, and no bone scales. The arm segments and the
  helpers turn by the rule of the app (`driven_turns()`): the helper keys them, and the export
  checks them.
- **Mesh.** The material slots are `fur` and `gloss`. The mesh has no gloss faces of an eye, and
  `pnpm studio-body` stops for a file with eye fans. The nose has gloss faces on the head bone
  alone ("Export"). The face attribute `color` gives one color to each face. Each vertex has 1 to
  `STUDIO_INFLUENCES` weights that add up to 1. The mesh has one Armature modifier, with no
  envelopes and no preserve volume, and no other modifier. A face can have more than three
  corners, and the export divides it as Blender does.
- **Eyes.** Each eye object is a mesh with the bone `head` as its parent. In the bind, its origin
  is the middle of the eye, its Z axis the direction in which the eye faces, its Y axis up along
  the plane of the eye (the turn of `addEye()`), and its even scale the head height `H` of the
  eye. Both eyes have one size. The mesh of the object is a preview of the eye of the app: the
  oval of `EYE` and its light, bent to the head surface by the rule of `eyeBend()`. The export
  reads only the transform. `pnpm studio-body` measures the bend where the axis of the eye meets
  the head surface, so that an eye can stand in front of the surface, and it reports a front of
  an eye that the head covers (`eyePush()`).
- **Shape keys.** `Basis` is the T-pose source. A key `bind*`, such as `bind_sit`, is a fix of the
  bind at the weight 1, such as the haunch on the seat or a crease. A key `arm_raise_<side>`, then
  `arm_raise_<side>2`, is a corrective shape of "Mesh rig", at most `STUDIO_RAISES`, in the order
  of the keys. A rig that comes from a GLB file can also hold the pose of the sheet as the Action
  `reference`, and the four shapes of the source as drawn keys.

```typescript
/** The custom properties of the armature object of a hand rig (`tools/blender/export_rig.py`). */
interface HandRigArmature {
  /** The palm hint of the left arm bones, in Blender axes. The right side mirrors it. */
  readonly palm: Vec3;
  /** `SeatExtras` with no top, in the units and the axes of the studio. */
  readonly seat: Omit<SeatExtras, 'top'>;
  /** The unit elbow axes of straight bind arms, in Blender axes (`StudioBody.hinges`). */
  readonly hinges?: Readonly<Record<Side, Vec3>>;
  /** The height of the landmark in the app, in meters: it sets the scale. */
  readonly height: number;
  /** The crease angle of the fur, in degrees. */
  readonly crease: number;
  /** The width of the seat of the chair, in meters. Each other fact of `BODY_FACTS` is optional. */
  readonly seatWidth?: number;
  /** The room behind the back on the chair, in meters. */
  readonly backRoom?: number;
  /** The lowest height of the head measures, in units. */
  readonly headFloor?: number;
}

/** An entry of the extras `eyes`, in the bind, in the units and the axes of the studio. */
interface EyeExtras {
  /** The middle of the eye: the head of its eye bone. */
  readonly middle: Vec3;
  /** The unit direction in which the eye faces. */
  readonly direction: Vec3;
  /** The head height `H` of the eye. */
  readonly size: number;
}

/** The custom property of the mesh for each key `arm_raise_*`, under the name of the key. */
interface HandRigRaise {
  readonly side: Side;
  readonly bone?: 'forearm' | 'hand';
  /** `StudioRaise.turn` as w, x, y, z, in Blender axes. */
  readonly turn: readonly [number, number, number, number];
  /** `StudioRaise.fade`, in degrees. */
  readonly fade: readonly [full: number, none: number];
}
```

The rest of the armature is the T-pose, and the app blends each pose from the bind. So a pose in
Blender differs from the same pose in the app where a vertex has bones with different turns, and
a key `arm_raise_*` too. An import of the GLB file into Blender shows the skin of the app, because
its rest is the bind.

### Seat

- A seated role binds its mesh seated. The export puts the soles on the floor and the haunch on
  the seat. The chair fits the body (`StudioBody.seatHeight`, `chairDepth`, `chairWidth`,
  `backRoom`), so the feet touch the floor. The seat is level, and it ends where the thighs leave
  it at the haunch (`chair.front`).
- The rig writes the seat of its config into the extras of the asset (`seat`, `SeatExtras` below),
  and the export fits the seat of the app to it.
- The sit lowers the underside of the haunch onto the seat, most at the back of the haunch, and
  less with the height. A tail ball stays on its bone, so the faces under it stretch into a
  column. So the ball moves down with the mean drop of the ring of the haunch around it
  (`sit.carryTail`). The ring drops by different amounts, so the haunch near the ball also moves
  with the ball, with a share that falls to 0 over a band (`sit.tailSpread`). The change of the
  drop then spreads over several faces, and the ball keeps its round form.
- The polar bear is the largest player, as a real polar bear is larger than the other animals of
  the cast. The piano grows only a little with it (`PIANO_SCALE`), because a larger piano hides
  the players behind it. It stands on longer legs (`PIANO_LIFT`) with its lid on the short prop
  stick (`PIANO.lidAngle`), so that the keys stand at the height that the upright trunk of the
  bear needs, and the faces of the players behind it show over the lid.
- The polar bear sits on a bench that fits its haunch and legs (`benchFitOf()`), as a real
  pianist sits on the front half of the bench: the whole haunch sits on the seat, the thighs slope
  a little down from the hips to the knees, the knees open past 90°, the shins stand near
  vertical, and the feet stand flat. Its legs keep the length of the mesh, so the body keeps the
  part ratios of the mesh, and only the slope of the thighs in the bind sets the height of the
  bench. The thighs slope down at most about 25°. Reason: thighs that slope further down put the
  haunch on the front edge of the bench, and the bear looks as if it stands up. A smaller slope
  lowers the hips, and below about 25° the thighs set the seat top in place of the haunch. The
  bench reaches back from the front edge of its fit to at least `PIANO_BENCH.studioDepth`, so the
  round haunch sits on the bench with a little room behind it. The deer sits on the stool of the
  harp.
- The cat and the rabbit sit on the chairs of their A-pose bodies. The wider haunch of the cat
  sits on a wider chair (`seatWidth`), and its tail lies curled on the seat around the left side
  of the haunch (`studio.tailCurl` of the rig config). Point edits make the curled tail a round
  tube and the legs thicker (`assets/models/cat/cat-edits.json`), because the rig left the tail a
  flat, crumpled sheet and the long legs looked thin. They also flatten the belly of the left
  forearm, which showed as a bump on the top of the arm in the play pose. The rabbit sits with more room behind the
  back (`backRoom`), so that its back keeps off the chair back.
- The panda sits on the chair of the panda of its old mesh, as a product choice: the seat top and
  the chair depth of that panda, with legs about as long. A front edge of the seat under the sloped
  thighs puts the seat top far below the hips joint, so the seat ends under the haunch, as on the
  old panda. The vertical shin lifts the seat by its full length and the sloped thigh by less
  than half, so the shin grows more than the thigh (`shinFactor`). Its head is smaller than the
  head of the mesh (`headFactor`), so that the head has the width of the old head for its height.
  The smaller head moves the mouth back, so the trombone hold of the panda puts the
  right elbow further out and the rest place further forward (5.2, 5.3).
- The mouse, the beaver, and the monkey have no chair (`noChair`). Each keeps its seated pose at
  the seat height of its legs, with its feet on the floor. The mouse of the oboes and the beaver
  of the bassoons are small, and the rows in front hid them, so in a row each stands on a wooden
  box (`STANDING_BOXES` of `models/layout-scene.ts`, `STANDING_BOX` of `models/props.ts`). The box
  reaches back under the tail. A soloist keeps the floor. The monkey has short legs under a
  large head, so its feet stand under its hips and its trunk leans forward with the head level.
  Its center of mass thus stays over its soles.
- The hippo, the elephant, the badger, the rhino, and the penguin stand to play, in the standing
  pose of their meshes. The rhino stands as a real tubist on a strap does.
- A seated body that also stands as a soloist (`soloist` of `ANIMALS`) keeps the leg shapes of
  its sheet pose (`standingBody()` of `models/studio-rig.ts`).
- A standing body that also sits takes the mirror (`StudioBody.sitting`, `seatedBody()`), so that
  one bind serves the standing and the seated roles. The rig makes a sit pose with the steps of
  a seated bind (`sitPose` of the config): the leg turns, the sit, and the creases. The shapes
  `sit_L` and `sit_R` give that skin back from the standing bind. A seated player of the body
  takes the leg turns and the shapes at their full weight, and sits on a chair that fits the sit
  pose. The weight comes from the stance alone, so the pose stays stateless. The trunk and the
  tail keep the bind, because a recline would also need the arm shapes again
  (`StudioStanding.armTurns`). No body of the app has a sit pose yet.

```typescript
/** The seated pose of a standing studio body that also sits (`models/studio-format.ts`). */
interface StudioSitting {
  /** The move from the standing place to the seat: soles on the floor, chair fronts aligned. */
  readonly drop: Vec3;
  /** The world turn of each leg bone from the bind pose to the seated pose. */
  readonly turns: Readonly<Record<StudioLegBone, Quat>>;
  /** The seat height and the chair depth of the seated body. */
  readonly seatHeight: number;
  readonly chairDepth: number;
}

/** The seat of a rig in the extras of its GLB file, in the units of the studio (`studio-body.ts`). */
interface SeatExtras {
  /** The seat of the app that takes its place: `chair`, or `bench` for the piano bench. */
  readonly prop: string;
  /** The height of the seat top: the lowest point of the body over the seat. */
  readonly top: number;
  /** The z of the front edge and of the back edge of the seat. */
  readonly front: number;
  readonly back: number;
  /** The half width of the seat on x, around the middle plane. */
  readonly halfWidth: number;
}
```

### Retarget and render

```text
 src/models/studio/<a>.ts: StudioBody (packed mesh, heads, palms, sheet arms)
        | studioRig() (models/studio-rig.ts)
        v
 StudioRig: the skeleton of the player (arms straight down), the constants of the arms
        |                                   |
 buildStudioBody(): the body in the         poseAt() pose of the player (5.1), each frame
 bind pose of the player, two bones of          |
 the player for each corner (footprints,        v
 hanging arms, tests)                       poseStudioBones(): the studio bones from the
                                            bones of the player, the corrective weights
                                                |
                                                v
                                            the scene: one SkinnedMesh, 4 bones and morph
                                            targets (scene/player.ts)
```

- **Retarget.** The app keeps its own motion (5.3, 5.4), so it drives the studio bones from the
  pose of the player in each frame. The skeleton of the player has each arm straight down,
  because the pose code reads a hanging arm in the bind pose (5.2). Each paw turns toward the
  forearm up to `PAW_TURN`, because the skin bends well only near its clips. A pose can give a
  paw its own turn (`pawTurnL`, `pawBendR`). Each shape takes its weight from the pose alone
  (`raiseWeight()`), so the rule of stateless poses holds.
- **Render.** The fur gets smooth normals within the crease angle of the body (`crease` of
  `ANIMALS`, `studioNormals()`). The bears and the penguin take a larger angle and a color blend
  (`colorBlend`), so they look round with soft facets, and the edges of the muzzle and the claws
  stay sharp. The other bodies share one angle. The colors hold the baked occlusion of the rig.
- **Bind mesh.** `buildStudioBody()` gives the mesh in the bind pose of the player, with two
  bones for each corner, for the footprints, the budgets, and the tests.
- **Recast role.** A role tool tests a body in a role that is not its own with a recast role
  `<role>@<species>` (`recastScene()` of `pose/test-scene.ts`). The species takes the seats and
  the instrument of the role in the test scenes only, and the cast of the app does not change.

### Clips

A clip of a person, such as a Mixamo animation, can move a player in a moment with no play: a
walk on, a bow, applause, or an idle. A clip cannot follow the notes, so the concert keeps
`poseAt()` (5.1). Only the gallery plays a clip now (`clip`, 7.1). Design 8.1 gives the license
rule of the Mixamo files.

```text
 Mixamo FBX or GLB file (outside git, 8.1)
   | pnpm mixamo-import (headless Blender: no prefix, meters, one animation for each take)
   v
 <dir>/<name>.glb --> readSourceFile() (models/source-clips.ts): the rest pose and the keys
   | retargetClip() (pose/retarget.ts), one time for each body, on clipTarget()
   v
 PlayerClip: the rotations of BONE_NAMES and the root offset at CLIP_RATE frames a second
   | clipPoseAt() (pose/clip-pose.ts), in each frame, with no state
   v
 AnimalPose --> poseStudioBones()
```

```typescript
/** A clip on the skeleton of a player: plain data that the clip layer reads with no state. */
interface PlayerClip {
  readonly name: string;
  /** The frames for each second (`CLIP_RATE`). */
  readonly rate: number;
  readonly frames: number;
  /** One quaternion for each bone of `BONE_NAMES` in each frame, relative to the parent. */
  readonly rotations: Float32Array;
  /** The offset of the root bone in each frame, in meters, in the model axes. */
  readonly rootOffsets: Float32Array;
  /** The depth of the lowest sole under the floor before the floor rule, in `H`. */
  readonly floorDepths: Float32Array;
}
```

- **Bone map.** `MIXAMO_BONES` gives the bone of the player of each Mixamo bone, or none. Of
  several bones that drive one bone, the last bone of the chain gives the turn: `spine` takes
  `Spine1`, and `chest` takes `Spine2`, which carries the arms and the neck. The roll of a Mixamo
  forearm turns its hand, and the turn of the hand reaches the twist bone (`TWIST_SHARE`). The
  four long fingers give one curl of the `fingers` block (`FINGER_CURL_SHARE`).
- **World turns.** A clip stores each turn relative to the T-pose of the source, so a rename of
  the bones alone does not work. The retarget reads the world turn of each source bone from its
  rest pose. Thus the rolls of the source bones do not matter.
- **Rest compensation.** Each limb bone of the player first turns from its bind pose to the
  direction of its source bone in the rest pose of the source: the hanging arm goes to the T-pose
  with the palm down, and a seated thigh goes down. The trunk, the head, and the feet keep their
  bind form, because both rest poses stand upright with the head forward and the feet flat. Thus
  each animal keeps its own lean.
- **Axes and size.** The left side of the source goes to -x, and its up to +y. The up of the
  source is the axis of the file nearest to the line from the hips to the head, because that line
  leans forward a little, and the floor rule then reads a forward walk as a rise. The source has
  no chin, so its `H` is its height over `HUMAN_HEADS`, the canon of figure drawing.
- **Hanging arm rule.** A human arm that hangs at the side goes straight down into the round
  trunk of an animal. Thus each arm bone blends its rest compensation toward the turn to the side
  arm of the body, by the share of the source arm that hangs (`HANG_FADE`, the angle of the line
  from the shoulder to the wrist). The side arm is the arm of `hangingArm()` (5.2) with no forward
  swing and no elbow bend: the smallest angle out to the side at which it clears the torso and
  the legs. The hanging arm of the source points straight down, so the source gives the swing and
  the elbow bend, and the arms hang along the sides. The full rest arm of 5.2 with the bend of the
  source held the forearms straight forward. A raised arm, a clap, and a T-pose keep the plain
  retarget.
- **Meeting paw rule.** The shoulders of an animal are wider in `H`, so the paws of a human clap
  stay apart. Thus a wrist near the middle plane of the source chest (`MEET_FADE`) keeps its
  distance from the plane in `H`, by a two-bone swing of the arm (`meetPaws()`).
- **Clearance rule.** The large head of an animal fills the place of a raised human hand, and its
  round trunk the place of a clap. Arms that reach in front of the chest (`FRONT_FADE`) first
  lift together about the side axis of the chest, up to `LIFT_LIMIT` (`liftArms()`). This turn
  keeps the distance of each wrist from the middle plane, so the paws of a clap meet above a round
  belly. Then each upper arm that is still in the body turns about the shoulder joint by the
  smallest turn that moves the deepest arm point out (`clearArms()`). The forearm and the paw keep
  their turns, so a wave still waves beside the head. The body of the rule is a stack of
  horizontal slices of each body bone, with a radius for each angle bin (`clipBody()`), one time
  for each body. The root of the upper arm lies in the shoulder in each pose, so the rule does not
  test it.
- **Walk rule.** A standing foot moves back under the hips by the turns of the leg, and these
  scale with the leg length. Thus the hips move across the floor by the ratio of the leg lengths,
  from the hip joint over the knee to the ankle, and a standing foot keeps its place. A move in
  `H` slid the short feet of the animals.
- **Floor rule.** The legs of an animal are shorter in `H` than human legs, so a move of the hips
  puts the soles under the floor or in the air. Thus the lowest sole of the player keeps the
  height of the lowest sole of the source, in `H` (`solePoints()`). A foot on the floor of the
  source stays on the floor, and a jump stays a jump.
- **Gallery.** The animals of a clip stand, and the bones of the instrument hide, because a clip
  cannot hold an instrument. The dev and preview servers serve the clip files from a local folder
  (`PAWCHESTRA_CLIPS`, `scratch/clips/` by default), so `dist/` gets no Mixamo file (8.1).
  `pnpm clip-views` shows a clip from the four sides, and measures the floor depth and the depth
  of each arm part in the body.
- **Models.** `pnpm mixamo-model` reads a Mixamo-rigged mesh, and writes the inputs of
  `pnpm rig-mesh`: the mesh alone as the source, the joints and the palm of the config, and a
  `paintedWeights` file from the skin. Mixamo has no twist bone, so the forearm weight moves to
  the twist bone along the forearm (`TWIST_RAMP`). Mixamo has no ears and no tail, so the rigger
  adds their joints. The rig then adds the eyes, the palms, and the seat.

## 4.5 Visual values

One world unit is one meter. The code files that each block names hold the values. The colors
come from samples of the reference images. Tune the light first, and change a base color only
when no light value can match the lit pixels of the reference.

**Colors**

- **Scene colors.** `SCENE_COLORS` of `models/colors.ts` (chairs, stands, sheets), `STAGE_COLORS` of
  `models/props.ts` (stage, risers, podium), and `HALL_COLORS` of `scene/hall.ts`. The hall is a
  dark, warm room. The stage is an amber wood with a tone for each plank and dark seams, and a baked
  light (`SIDE_GLOW`) keeps its sides from black. The chairs are a honey wood. The music stands are
  black with a warm gray desk, because black desks were the largest shapes of some close shots.
- **Species colors.** `SPECIES_COLORS` gives each species the fur, the belly, and the accent color.
  A studio body keeps the face colors of its rig (4.4). The UI seat dots read the fur color, and a
  color rule of a rig can move the fur toward it. All eyes are black with a light.
- **Instrument colors.** `INSTRUMENT_COLORS`. The bowed strings are varnished wood with a lighter
  top and darker edges. The clarinet is black lacquer with silver keys, the flutes are silver, the
  brass is gold with lit bells, and the timpani are copper. The piano is black lacquer with a dark
  well and a dark gold plate in its open case (`PIANO_INSIDE`).

**Materials**

All meshes share the values of one `MeshStandardMaterial` with vertex colors and crease normals
(`models/shading.ts`), so each player has one material and one draw call. Each program variant
of the players (skin, morph count) gets its own copy of the material and a depth material
(`scene/variants.ts`), and the scene pass draws the players of one copy together. A pass draws a player only when its camera sees the sphere of the pose
(`scene/bounds.ts`). The corners with the same values share one vertex, and the depth passes and
the shadow maps draw a depth geometry with only the positions, the skin, and the morph positions
(`scene/shared-corners.ts`). The GPU then skins each vertex one time in place of each corner, and
the pixels do not change. The stage computes the bone matrices from the pose with the products
of three.js in the same order, so each bit stays (`FrameSkeleton` of `scene/player.ts`). Each triangle has a finish (`FINISHES` of `models/mesh.ts`):

| Finish    | Parts                                                     | Intent                                                                |
| --------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `matte`   | Cloth, raw wood, the stage, the props, and the bodies.    | No gloss. A studio body smooths the angles below its crease angle.    |
| `varnish` | The varnished wood of the bowed strings.                  | A soft gloss.                                                         |
| `lacquer` | The black lacquer of the piano and the clarinet, the eyes. | A sharp gloss.                                                        |
| `metal`   | Brass, copper, and silver.                                | Sharp highlights. The hall is dark, so a high metalness looks black.  |

The studio bodies smooth their fur, because their many small faces showed a crumpled pattern
under the hard key light.

The stage has its own wood material (`createStageMaterial()` of `scene/stage.ts`). A test of its
shader must not make a line thinner than one pixel inside a face. Reason: MSAA smooths only the
edges of the triangles, so such a line breaks into dashes that move with the camera. Thus:

- The baked light of the skirt and the lip (`SIDE_GLOW`) finds a plank by its face: a face that
  points up at y = 0. A test of y alone left a band of 2 mm on the outer face of the lip with no
  light.
- A point with no texel of the bake for its surface takes the rule of an overhang (no key light,
  half the sky), except on a slope of the lip. There it reads the bake 4 cm beside it. The inner
  bevel rises more across one texel than the height test allows, so thin lines of it found no
  texel and were dark.

**Light and render**

`scene/lights.ts` holds the lights, `scene/light-pool.ts` the pool, `models/beam.ts` and
`scene/beam.ts` the light places and the beams, and `scene/solo-light.ts` the solo light.

```text
          rim light (behind, high, no shadow) ── visible beam in the haze
                          │
   back   ┌───────────────v───────────────┐
          │   players: lit rims, shadows  │  shadows fall to the back right
          │     ◄ side light  side light ►│  (weak cross lights)
   front  └───────────────────────────────┘
                    ^
                    │ key light (front left, high, the only stage shadow)
                 audience and default camera
```

- **Key light** (`KEY_PLACE`). A warm `SpotLight` far in front of the stage, high and to the
  left, acts as the front light of a concert hall. The shadows fall back, beside the players in
  the default view. Each body keeps a lit side and a shade side. The intensity grows with the
  square of the distance, so each stage size gets the same light.
- **Rim lights** (`RIM_LIGHT`, `RIM_PLACE`). Warm spotlights far behind and high light the heads
  and the shoulders, so the players stand out of the dark hall. They cast no shadow, so the
  shadows keep one direction. The vertex shaders calculate them (`scene/rim-light.ts`), because a
  spotlight costs GPU time on each lit pixel (9.7).
- **Side and back-row lights** (`SIDE_LIGHT`, `BACK_ROW_LIGHT`). Weak cross lights from the
  front corners. They cast no shadow (2.6), so the key light alone casts the shadows. The
  back-row lights keep the back rows almost as bright as the front rows. These lights are a warm
  white, so white, gray, and purple fur keep their colors.
- **Pool** (`LIGHT_POOL`, `addLightPool()`). A factor in the shaders makes a pool on the
  conductor and the middle of the orchestra, because a separate light costs GPU time. A hot spot
  holds only the podium on the players, so the white fur of the front rows does not clip.
- **Beam** (`BEAM_LOOK`). The haze cone leans toward its rim light, which stands at the x of the
  beam, so the beam has a visible source and stands upright. The camera dims it in a close shot.
- **Other terms.** Each layout bakes the soft key shadow on the stage one time
  (`scene/stage-bake.ts`), because the props and the stage do not move. A close shot adds a soft
  key and a kicker on the shade side of the subject (`scene/shot-light.ts`, 5.6). Room haze gives
  the back rows an aerial depth (`ROOM_HAZE`). A solo turns the key light, the pool, and the beams
  to the soloed players (`soloAim()`, 2.4). A captured cube of the lit hall gives the reflections
  (`captureEnvironmentSteps()`).
- **Tone.** AgX tone mapping, because ACES moved the dark wood to red. Its exposure (`STAGE_TONE`)
  keeps the lit floor and the white fur below the shoulder of the curve, so the stage does not
  look over-exposed. With reduced motion, the noise, the motes, and the grain stand still (2.5).

**Hall**

The concert hall (`HALL` of `scene/hall.ts`) scales with the stage side. The balcony rails carry
lamps all around. The low wall lamps skip the back (`HALL.wallLamps.backGap`), because lamps
there floated above the orchestra and near the title of the first screen (2.8). Each lamp has a
soft glow disc. The shell and the floor hold a baked light, because lights cost GPU time on large
surfaces.

**Post effects**

The scene renders into a target with MSAA, then the post effects make the image of the canvas
(`scene/post.ts`, `POST_LOOK`).

```text
scene ──> [scene target, MSAA] ──┬──> bloom down 1/2 ... ──> bloom up ──────────┐
                                 └──> blur prepare 1/2 ──> blur gather 1/2 ──┐  │
scene ──> [depth 1/2] ──────────────────────^ (only with a shallow focus)    v  v
          [scene target] ───────────────────────────────────────────────> final pass ──> canvas
```

- With no float target, the scene renders with no post effects. The bloom levels follow the tier
  (2.6).
- The depth of field is a thin lens focused on the subject of the shot (5.6). The aperture
  closes for a far focus, so the wide views stay sharp and skip the blur. Free mode has none.
- The bloom keeps a small part of all light, as a diffusion filter, with a warm halation.
- The final pass does the tone mapping, a grade (`gradeColor()`, `GRADE` of `scene/grade.ts`), a
  vignette, and a grain. `pnpm look-lab` fits the grade to `orchestra-latest.png`. The curve
  keeps the soft shoulder of AgX, because a steep shoulder clipped the floor and the white fur.
- **Letterbox** (2.5). Each target keeps the size of the canvas, and a scissor limits each pass to
  the letterbox (`cropTarget()` of `scene/letterbox.ts`): the scene pass, its MSAA resolve, the
  depth passes, the bloom, and the blur. Each sample stays in the written part of its source
  (`SOURCE_CLAMP` of `scene/post-shaders.ts`), and the final pass writes the black bars with no
  sample. Thus no pass renders the scene under the bars, and the move of the bars allocates no
  target. A canvas of the size of the letterbox would allocate each target again in each frame of
  the move. The blur of the depth of field is a part of the height of the letterbox.
- **Vignette.** Free mode has a round vignette from the middle of the canvas (`POST_LOOK`). It
  darkens the middle of the top edge by only about 12%, where the hall is dark already. The
  letterbox has an oval vignette with the shape of the frame (`FRAME_VIGNETTE`), so that the top
  and the bottom edges darken as much as the sides, and the vignette shows on the lit stage. A
  close shot gets the stronger vignette of `SHOT_LOOK`, and the letterbox takes the same ratio as
  a boost (`vignetteOf()` of `scene/stage-scene.ts`). The strength is the middle of a lineup of
  three strengths.

**Camera**

`shots/view.ts` holds the field of view (30°), the default view, the screen rules, and the orbit
limits. `shots/frame.ts` holds the frame.

- The default view stands on the audience axis behind the conductor, as `orchestra-latest.png`,
  and looks down at `DEFAULT_ELEVATION` at `DEFAULT_TARGET`. It looks a little less steeply down
  than the image. This product choice wins over the image. The wide shots of 5.6 look at the same
  target, and Free mode turns around it (2.5).
- The default distance (`DEFAULT_DISTANCE_IN_SIDES × S`) is the unit of the wide shots, the
  planner, and the beam fade. A portrait viewport gets a lower and more frontal view
  (`PORTRAIT_RULE`). Each player stays whole in each wide shot (`wideView()`), and the frame
  centers on the free area of 2.8 (`viewFrame()`).
- In Cinematic mode, `setViewOffset()` puts the image of the camera into the letterbox of 2.5,
  with the aspect `CINEMA_ASPECT`. The canvas keeps the size of the window.

**Supports.** The players of the timpani, the percussion, the contrabass, the tuba, the choir,
and the conductor stand. The soloist of 3.8 also stands when it plays the violin, the viola, the
flute, the oboe, the clarinet, the horn, the trumpet, or the trombone, as in a concerto
(`supportOf()` of `models/player.ts`).

**Props and stage**

`models/props.ts` holds the chairs, the stools, the music stands, and the risers.
`models/stage.ts` holds the stage, the podium, and the conductor stand.

| Item            | Rules                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Chair           | A level seat, two back posts, one wide top rail, and four legs (`CHAIR`). It fits the body (4.4, seat).   |
| Stool           | For the harp, with no back (`STOOL`). It fits the legs, so the knees and the hooves stay out of it.       |
| Piano bench     | A padded seat with four tapered legs (`PIANO_BENCH`), as in `polar-bear-views.png`. It fits the legs and holds the whole haunch. |
| Music stand     | A tripod and a tilted desk with a sheet (`MUSIC_STAND`), below the eyes of its players.                   |
| Podium          | A box with cut corners and framed panels (`PODIUM_SIZE`, `PODIUM_TRIM`), as in `bear-views.png`.          |
| Conductor stand | A desk on a post in front of the podium (`CONDUCTOR_STAND`), with its top edge at the bear shoulders.     |
| Stage           | A slab of side `S` with cut corners (`STAGE_CORNER_CUT`), a raised lip (`STAGE_LIP`), and lacquered planks. |
| Choir risers    | Up to three arc levels behind the orchestra, with three steps in front (`RISER`).                         |

**Stage origin**

The world origin is the stage center, on the top of the stage. The axes are the right-handed
axes of Three.js: +x points to the right as the audience sees it, +y points up, and +z points to
the audience (the front).

1. Place the soloist, then the seats in arcs around the podium center.
2. Calculate the half width `L`: the largest `|x|` of a seat or a footprint, plus a chair and a
   margin.
3. Set the front distance `F` from the front edge to the podium center (`PODIUM_FROM_FRONT`).
4. Calculate the depth `D`: `F`, plus the largest distance of a seat behind the podium, plus a
   chair and a margin.
5. The stage side is `S = max(5, 2 × L, D)`. Any extra depth goes to the back.
6. Spread the instrumental rows inside the stage. `S` does not change.
7. Move all items so that the stage center is the origin.

**Seat geometry**

The seats stand in arcs around the podium center (`models/layout-scene.ts`), and all players
face the podium, except the pianist. An angle of 0° points from the podium to the back (-z), and
negative angles are on the left. A seat at the angle `a` and the radius `r` is at
`podium + (r × sin a, 0, -r × cos a)`.

- A seated player uses at least `SEATED_ARC`, and neighbors keep `FOOTPRINT_GAP` between their
  footprints. Two string players share one stand (`STAND_DISTANCE`). Each wind player has a
  stand.
- Each row has a left side, a middle, and a right side. The middle of the players of the middle is
  at 0°. A row with no middle has its left side left of 0° and its right side right of it, so no
  string player sits behind the conductor. Each side spans at most 80°.
- Each row stands at least `ROW_STEP` behind the row in front, and then moves back until its
  footprints clear the items in front. A player behind a piano case keeps `PIANO_REACH_GAP`,
  because it reaches toward the case in play.
- The choir risers stand behind the last row, each level higher, so the back row hides no singer.
- After the stage size, each row spreads to the side edges (`SPREAD_LIMITS`), because the packed
  rows left the front corners empty.

```typescript
/** The limits of the spread of a row. */
interface SpreadLimits {
  /** The largest angle of a seat from 0°, in radians: 90°. */
  readonly maxAngle: number;
  /** The largest arc between two neighbors of a row, in meters: 1.6. */
  readonly maxArc: number;
}
```

The **footprint** of a player is one box for the parts of each bone in each band of height, in
the bind pose, and the box of its seat. A bowed string and its bow count a simple box model
(`InstrumentPiece.footprint`), so the detail of the model does not move the seats.

| Row | Sections, from left to right                                                   |
| --- | ------------------------------------------------------------------------------ |
| 0   | the first desks of: first violins, other violins, violas, cellos               |
| 1   | the other desks of: first violins, other violins, violas, cellos               |
| 2   | a keyboard of the orchestra (4.2), harp, flutes, oboes                         |
| 3   | horns, clarinets, bassoons, trumpets                                           |
| 4   | percussion, contrabasses, timpani, trombones, tuba                             |
| 5   | choir, on the risers                                                           |

**Soloist.** The soloist of 3.8 stands at the front left of the conductor (`SOLOIST_PLACE`) and
turns to the conductor (`SOLOIST_FACING`), so the default view sees its face. A piano soloist
sits at `PIANO_CENTER` and faces the conductor, so the lid opens to the audience. A keyboard of
the orchestra turns a quarter turn, so that its case lies along row 2.

**Chamber group** (`CHAMBER`). The players of an arc stand in one row around the podium center
and face the center. A solo player stands at the middle. In a recital, the partner stands at the
curved side of the piano and turns a little to the pianist.

## 4.6 Model inventory

Each body is a module of `src/models/studio/` (4.4). The instruments are in
`models/instruments/`.

| Section    | Species         | Body file             | Support         |
| ---------- | --------------- | --------------------- | --------------- |
| violin     | rabbit, red fox | `rabbit.ts`, `fox.ts` | chair           |
| viola      | cat             | `cat.ts`              | chair           |
| cello      | dog             | `dog.ts`              | chair           |
| contrabass | hippo           | `hippo.ts`            | stands          |
| harp       | deer            | `deer.ts`             | stool           |
| piano      | polar bear      | `polar-bear.ts`       | bench           |
| flute      | tan fox         | `fox.ts`, tan palette | chair           |
| oboe       | mouse           | `mouse.ts`            | no chair        |
| clarinet   | wolf            | `wolf.ts`             | chair           |
| bassoon    | beaver          | `beaver.ts`           | no chair        |
| horn       | pig             | `pig.ts`              | chair           |
| trumpet    | monkey          | `monkey.ts`           | no chair        |
| trombone   | panda           | `panda.ts`            | chair           |
| tuba       | rhino           | `rhino.ts`            | stands          |
| timpani    | elephant        | `elephant.ts`         | stands          |
| percussion | badger          | `badger.ts`           | stands          |
| choir      | penguin         | `penguin.ts`          | stands on riser |
| conductor  | bear            | `bear.ts`             | stands, podium  |

`castScore(score)` of `models/cast.ts` gives each player its species (4.3), its instrument, and
its support. A drum player gets the instrument of the first key group that it plays, in the
order of 3.8. The kettle count comes from the highest note of the timpani seat.

```typescript
/** The species and the instrument of one player. */
interface PlayerCast {
  /** The index of the seat in `Score.seats`. */
  seatIndex: number;
  /** 0 is the principal player of the seat. */
  player: number;
  species: SpeciesId;
  instrument: InstrumentId;
  /** The kettle count of the timpani. The other instruments ignore it. */
  kettles: 2 | 3 | 4;
  /** The support of the player. The soloist of a wind or of a violin stands (4.5). */
  support: Support;
}

/** Pure. One entry for each player, in the order of `ScenePose.players` (5.1). */
declare function castScore(score: Score): PlayerCast[];
```

### Sizes and holds

The instruments follow the reference images, and their sizes fit the animals. The chairs, the
stands, and the podium keep their sizes in meters. The arms of each body keep their chosen
length, and a species with short arms plays a smaller instrument (`SCALED_INSTRUMENTS`, the scale
fields of `SpeciesParams`), as a child plays a fractional violin or a small lever harp. A smaller
instrument shrinks toward the mouth or the base, so the mouth keeps its place. A violin shop
sizes a violin so that, with the left arm extended, the scroll lies in the middle of the palm
(`pnpm hold-reach`). The cello rule (`celloRule()` of `tools/cello-size.ts`) sizes a cello as a
cellist does: the largest cello at which the left paw reaches the first position with the elbow
bent to at most `CELLO_ELBOW`, the end pin fits the chest, and the lower bout is not below the
knees, clamped to the real sizes (`REAL_CELLOS`, from a 1/10 to a 4/4). The cast matrix gives
this size to a recast cellist, and a new cellist species takes it as its `celloScale`. Each cello
gets the end pin of its body (`celloPinOf()`), so that the top of its back rests on the chest at
the lean of `CELLO_PLACE`, as a cellist sets the end pin.

The size rule of the winds (`windRule()` of `tools/wind-size.ts`) sizes a trumpet, a clarinet, or
a flute for the arms: the largest size at which each palm reaches its grip in the playing pose
with at most `WIND_REACH_SHARE` of the arm, so that each elbow keeps a bend, as the monkey at its
trumpet. The size stays between the smallest real instrument with the same hold and fingering (a
pocket trumpet, an E-flat clarinet, a piccolo) and the size of the app (`REAL_WIND_SIZES`), because
a player with long arms bends the elbows more and plays the standard instrument. When no real size
passes, the rule takes the real size with the nearest grips. The cast matrix gives this size to a
recast wind player. A smaller wind does not bring a mouth that is far in front of the shoulders
nearer, so a long muzzle or a deep body still misses its grips at the smallest size.

The hold gives the place of each piece in the bind pose of 4.7, in the axes of the model: the
player faces -z, and its left is -x. An offset in `H` uses the head height of the player. Where
the body sets the hold, the instrument fits the body, as the table names.

| Instrument | Model and hold |
| --- | --- |
| Violin, viola | An arched body with f-holes, a scroll, a bridge, four strings, a chin rest, a shoulder rest, and a bow. Under the chin on the left shoulder. The shared violin hold places the violin on the left collarbone from the body (5.3). The cat plays a small viola near the neck. |
| Cello, contrabass | The violin form with an end pin (`celloPinOf()`, `endPinLength()`). The cello leans back between the knees, at a place from the body (5.3). The contrabass has sloped shoulders and machine heads, and stands at the left side. |
| Harp | Leaned back onto the right shoulder. The deer plays a smaller harp on a box (`HARP_PLACE`, `HARP_STAND`). |
| Piano | Larger than a real grand piano (`PIANO_SCALE`), on longer legs (`PIANO_LIFT`), so the forearms of the polar bear are almost level with the keys. The keys stand in front of its belly (`PIANO_FRONT_H`). |
| Flute, oboe, clarinet, bassoon | The lip plate, the reed, or the mouthpiece at the mouth. The flute points to the right, and the bassoon crosses the body to the left. The shared flute and clarinet holds take their arms from the body (5.3). A recast flute or clarinet takes the size rule of the winds. |
| Horn, trumpet, trombone, tuba | The mouthpiece at the mouth. The pig turns its horn back toward the body (`PIG_HORN`), and the rhino has a longer lead pipe (`tubaPipe`). A recast trumpet takes the size rule of the winds. |
| Timpani | Kettles of the real size in an arc. The kettles of the elephant move to its short arms, with a gap for its trunk (`TIMPANI`). |
| Percussion | Drums, a xylophone, a triangle, and a tambourine within the reach of the badger, and a suspended cymbal (`cymbalForm`, `SUSPENDED_CYMBAL`). |
| Choir folder | In both flippers, in front of the chest (`CHOIR_FOLDER`). |
| Baton | Along the index finger, with its grip in the palm, as a conductor holds it (`BATON_ALONG`). |

Each mallet, stick, and beater slants down toward the line of the forearm, as a real player holds
the shaft along the thumb (`malletTilt`). No vertex of a player is below the floor.

**Bowed strings** (`models/instruments/strings.ts`). The strings stay at one height over the
board (`VIOLIN`), because the holds and the play targets read that height. The neck under the
first positions is open below the board (`NECK_OPEN`), so the left paw of the hippo does not go
through it. The chin rest of the violin and the viola is at the left of the tailpiece, on the side
of the G string (`CHIN_REST`), because a violinist rests the left side of the jaw on it. The
shoulder rest is a bent bar under the back of the lower bout, with a foot on each rib
(`SHOULDER_REST`), because a violinist holds the instrument between the chin rest and the shoulder
rest. Its high end is on the side of the E string, because the left shoulder and the upper arm
lie under that side in the hold. The strings of the violin and the viola have a triangle section
(`STRING_SECTION`), because they are about 1 mm thick on the stage, so the shoulder rest fits in
the triangle budget. The layout reads a simple box of each bowed string (`addLayoutSpace()`), so a
change of the detail does not move the seats.

**Piano** (`models/instruments/piano.ts`). 88 separate keys, a lyre, and three brass pedals in the
sizes of a real grand piano (`PIANO_PEDALS`). The lift raises the case, the keys, the lid, and the
bar of the lyre, and the pedals stay on the floor. Each key turns down with its notes
(`PIANO.keyDip`), and the damper pedal goes down under the right foot (5.3).

### Instrument data

`buildInstrument(id)` gives an `InstrumentModel` as pure data, with no scene-graph object (7.1).

```typescript
interface InstrumentModel {
  id: InstrumentId;
  /** The parent of the `instrument` bone: `chest` or `root` (4.7). */
  parent: 'chest' | 'root';
  /** The rigid pieces. The main piece is first. */
  pieces: readonly InstrumentPiece[];
  /** The palms, the mouth, and the chin, as points on the pieces. `null` if not used. */
  grips: InstrumentGrips;
  /** The points and lines that the arms and the mallets aim at. */
  targets: readonly PlayTarget[];
  /** The size of the box around the main piece, in meters. */
  size: Vec3;
}

interface InstrumentPiece {
  /** One bone of 4.7: `instrument`, `slide`, `bow`, `malletL`, `malletR`, or `baton`. */
  bone: InstrumentBone;
  /** Corner lists with a color and a finish, in the piece axes, in meters. */
  parts: readonly InstrumentPart[];
  /** The place of the piece in the bind pose: an anchor, an offset in `H` and in meters. */
  hold: PieceHold;
  /** The corners of a simple box model for the layout, in place of the parts. */
  footprint?: readonly number[];
}
```

- Each piece is rigid and follows one bone. The origin of the piece axes is the bind position of
  its bone, so a mallet turns around the palm and a bow around its grip.
- `holdInstrument(model, body)` places the pieces on the points of one body, and
  `attachInstrument()` adds them to the mesh of the player.
- `pianoKeyPosition()`, `xylophoneBarPosition()`, and `harpStringPosition()` give the point of
  each key, because a pitch is not linear along the evenly spaced keys, bars, and strings.
- The trombone slide and the damper pedal move along a line, which a bone rotation cannot do, so
  the pose moves the `slide` bone (`AnimalPose.slideOffset`, 5.1).
- The piano keys are parts of the `instrument` piece, in MIDI order. A bone for each key adds 88
  bones, so the scene turns the keys in the positions of the mesh (`applyKeys()` of
  `scene/player.ts`). Each pianist has positions of its own and shares the other attributes.

## 4.7 Rig

Each player has one skeleton with the bones of `BONE_NAMES` (`models/rig.ts`). Each skeleton has
all bones, so a bone has the same index in each player. A bone with no part, such as the trunk of
a rabbit, moves nothing.

```typescript
type BoneName =
  | 'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  /** Opens for the choir. */
  | 'jaw'
  /** Scale on Y for blinks. */
  | 'eyeL' | 'eyeR' | 'earL' | 'earR'
  /** Only if the species has a tail. */
  | 'tail1' | 'tail2'
  /** Only for the elephant. */
  | 'trunk1' | 'trunk2' | 'trunk3'
  | 'shoulderL' | 'upperArmL' | 'forearmL' | 'handL' | 'fingersL'
  | 'shoulderR' | 'upperArmR' | 'forearmR' | 'handR' | 'fingersR'
  | 'thighL' | 'shinL' | 'footL' | 'thighR' | 'shinR' | 'footR'
  /** Parent: `chest` for the violin, the viola, and the winds, `root` for floor instruments. */
  | 'instrument'
  /** Children of `handR` or `handL`, as the instrument needs. */
  | 'bow' | 'malletL' | 'malletR' | 'baton'
  /** Child of `instrument`, for the trombone slide and the damper pedal. */
  | 'slide';
```

- **Studio bones.** A studio body has a skeleton of its own: the body bones of the mesh rig, two
  eye bones for the pea eyes, and the optional bones (`OPTIONAL_STUDIO_BONES`): a tail tip
  (`tail_tip`), the jaw of a beak (`jaw`), and the arm segments and helpers
  (`ARM_SEGMENT_BONES`). The optional bones come after the other bones, so that a new one keeps
  each other index. The scene gives the mesh the studio bones and the bones of the player, and
  `poseStudioBones()` writes their matrices from the pose of the player. A pose also holds the
  twist bones of the upper arms (`UPPER_TWIST_BONES`).
- **Arm segments.** `poseArm()` writes each segment from the turns of its arm, around the joint at
  the start of its part. The readers of the bind mesh read the upper arm or the forearm of the
  player for them (`STUDIO_FOLLOWS`).
- **Jaw.** The `jaw` of a studio body is a child of `head` at the hinge of the beak, and the choir
  pose opens it (5.3). A body with no jaw keeps the `jaw` of the player with no vertex on it.
- **Arms.** Analytic two-bone IK (upper arm and forearm). `poseAt()` calculates the hand targets
  on the instrument: the bow frog, the fingerboard position of the pitch, the keys, and the
  mallet heads. `fingersL` and `fingersR` curl as one block.
- **Legs.** The legs keep a seated or a standing pose. The right leg of a pianist on the damper
  pedal and the legs of a side move of the hips turn (5.3), and the feet stay on the floor. The
  idle motion moves only the spine, the head, the ears, the eyes, and the tail.
- **Torso.** A rotation of `chest` moves the shoulders, the arms, and a violin together.
- **Bind mesh.** The readers of the bind mesh read the main bone of each corner: the
  footprints, the chair clearance, the silhouettes, and the budgets. `posedCorner()` of
  `pose/test-skin.ts` poses a corner in the tests as the GPU does.
- **Bind pose.** No bone has a rotation. The body sits on its seat or stands, and the arms hang
  down beside the body. The instrument is in its playing place on its bone, and the bow lies in
  the hanging right paw.
