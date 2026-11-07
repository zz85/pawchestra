import {
  BackSide,
  Group,
  Light,
  Line,
  Mesh,
  PMREMGenerator,
  Points,
  Scene,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type {
  BufferGeometry,
  Camera,
  Material,
  Object3D,
  SkinnedMesh,
  WebGLRenderer,
  WebGLShadowMap,
} from 'three';

import { rimLightPlace } from '../models/beam.ts';
import { CONDUCTOR } from '../models/cast.ts';
import type { SceneLayout } from '../models/layout.ts';
import type { Vec3 } from '../models/tuples.ts';
import { headOf } from '../pose/plan.ts';
import type { ScenePose } from '../pose/types.ts';
import { freeBeamOpacity } from '../shots/beam-opacity.ts';
import type { FrameCover, ScreenBox, ViewFrame } from '../shots/frame.ts';
import type { CameraPose } from '../shots/types.ts';
import type { ModelCache } from '../models/model-cache.ts';
import { buildSceneProps } from '../models/props.ts';
import { STAGE_THICKNESS } from '../models/stage.ts';
import type { Steps } from '../score/steps.ts';
import { StageCamera } from './camera.ts';
import { disposeTree } from './dispose.ts';
import {
  CAPTURE,
  ENVIRONMENT,
  captureEnvironmentSteps,
  createEnvironmentSteps,
} from './environment.ts';
import type { CaptureOptions } from './environment.ts';
import { FREE_LENS, focusOf, freeFocusDistance, freeFocusOf } from './focus.ts';
import type { Focus, FocusSpot } from './focus.ts';
import { createMaterials } from './geometry.ts';
import { createHall, setHallCamera } from './hall.ts';
import { BeamDepth, setBeamFrame } from './beam.ts';
import { letterbox, letterboxShare, mixBox, stepLetterbox, uvRectOf } from './letterbox.ts';
import type { UvRect } from './letterbox.ts';
import { boneSpheres, fitPoseSphere } from './bounds.ts';
import type { BoneSpheres } from './bounds.ts';
import {
  aimKeyLight,
  aimRimLights,
  createLights,
  keyLightPosition,
  setLightsTier,
} from './lights.ts';
import { createPoolUniforms, defaultAim, setPoolAim } from './light-pool.ts';
import type { LightAim } from './light-pool.ts';
import { tierPixelRatio } from './quality.ts';
import type { QualityTier } from './quality.ts';
import {
  applyScenePose,
  createPlayersSteps,
  createStaticMesh,
  holdSkeletons,
  releaseSkeletons,
  sharedGeometryOf,
} from './player.ts';
import type { PlayerSpot } from './player.ts';
import { PostPipeline, targetFormatOf } from './post.ts';
import type { HazeFrame, PostView, TargetFormat } from './post.ts';
import { FRAME_VIGNETTE, POST_LOOK } from './post.ts';
import { createRimUniforms, setRimLights } from './rim-light.ts';
import { SHOT_LOOK, createShotUniforms, setShotLight } from './shot-light.ts';
import { freeShotLight, shotRig } from '../shots/shot-light.ts';
import { gradeLutSteps } from './grade.ts';
import { createRenderer } from './renderer.ts';
import { aimGap, easeAim, easeShare, soloAim } from './solo-light.ts';
import { STAGE_SHADOW, createStage, noBakeUniforms } from './stage.ts';
import { VariantMaterials } from './variants.ts';
import type { StageBakeUniforms } from './stage.ts';
import { bakeStageSteps } from './stage-bake.ts';
import { compileInto, gpuDoneSteps, programsReadySteps } from './programs.ts';
import { depthGeometryOf } from './shared-corners.ts';

/**
 * Gives the strength of the vignette of a frame (design 4.5, post effects). A close shot gets the
 * stronger vignette of `SHOT_LOOK`. In the letterbox, the vignette of the frame takes the same
 * ratio as a boost.
 *
 * @param light The weight of the light of a close shot, from 0 to 1.
 * @param cinema The share of the letterbox, from 0 (Free mode) to 1 (Cinematic mode).
 * @returns The part of the light that the vignette takes from the corners.
 */
function vignetteOf(light: number, cinema: number): number {
  const free = POST_LOOK.vignette + (SHOT_LOOK.vignette - POST_LOOK.vignette) * light;
  const boost = SHOT_LOOK.vignette / POST_LOOK.vignette;
  const frame = FRAME_VIGNETTE.strength * (1 + (boost - 1) * light);
  return free + (frame - free) * cinema;
}

/** The inputs of {@link StageScene}. */
interface StageSceneOptions {
  readonly tier: QualityTier;
  readonly devicePixelRatio: number;
  /** The color format of a render target of the GPU, from the probe of WebGL2 (design 2.6). */
  readonly targetFormat: TargetFormat;
  /** True if the user prefers reduced motion (design 2.5). */
  readonly reducedMotion: boolean;
}

/**
 * Gives the players of a layout and the conductor on the podium (design 4.5, 4.6). The conductor
 * is not in `layout.players`. `layout.conductor` gives its place on the podium top, and a chamber
 * group has no conductor (design 4.2).
 *
 * @param layout The layout of a score.
 * @returns The places of the players, then of the conductor, if the layout has one.
 */
export function playerSpots(layout: SceneLayout): PlayerSpot[] {
  const spots: PlayerSpot[] = layout.players.map(({ cast, position, facing }) => ({
    species: cast.species,
    instrument: cast.instrument,
    kettles: cast.kettles,
    support: cast.support,
    position,
    facing,
  }));
  if (layout.conductor) {
    spots.push({ ...CONDUCTOR, kettles: 4, support: 'stand', ...layout.conductor });
  }
  return spots;
}

/** The top of a head above the middle of its head bone, in meters: the head of the elephant. */
const HEAD_TOP = 0.5;

/**
 * Gives the highest point of the players above the stage top: the top of the stage in the first
 * screen (design 2.8).
 *
 * @param layout The layout.
 * @param models The player models of the layout.
 * @returns The height in meters, or 0 with no players.
 */
function playersTop(layout: SceneLayout, models: ModelCache): number {
  let top = 0;
  for (const place of layout.players) {
    const { species, instrument, kettles, support } = place.cast;
    const head = headOf(models.get(species, instrument, kettles, support), place);
    top = Math.max(top, head[1] + HEAD_TOP);
  }
  return top;
}

/**
 * Gives the players and the conductor of a layout for the focus of Free mode (design 4.5): the
 * middle of each head.
 *
 * @param layout The layout.
 * @param models The player models of the layout.
 * @returns One spot for each player, then the conductor, if any.
 */
function focusSpots(layout: SceneLayout, models: ModelCache): FocusSpot[] {
  return playerSpots(layout).map((spot) => {
    const model = models.get(spot.species, spot.instrument, spot.kettles, spot.support);
    const [x, top, z] = headOf(model, spot);
    return { x, z, top };
  });
}

/**
 * Lets three.js cull the player meshes in each pass (design 4.5): each player whose geometry has
 * bone spheres (`boneSpheres()`) gets a bounding sphere, which the stage fits to the pose of each
 * frame (`fitPoseSphere()`). The players of one model share the spheres of their shared geometry
 * (`sharedGeometryOf()`), also a pianist with positions of its own.
 *
 * @param players The player meshes.
 * @returns The steps, which return the bone spheres of each culled mesh.
 */
function* cullPlayersSteps(players: readonly SkinnedMesh[]): Steps<Map<SkinnedMesh, BoneSpheres>> {
  const byGeometry = new Map<BufferGeometry, BoneSpheres | null>();
  const culled = new Map<SkinnedMesh, BoneSpheres>();
  for (const mesh of players) {
    const geometry = sharedGeometryOf(mesh);
    let spheres = byGeometry.get(geometry);
    if (spheres === undefined) {
      yield;
      spheres = boneSpheres(geometry, mesh.skeleton.bones.length);
      byGeometry.set(geometry, spheres);
    }
    if (spheres) {
      mesh.boundingSphere = new Sphere();
      mesh.frustumCulled = true;
      culled.set(mesh, spheres);
    }
  }
  return culled;
}

/** The flags of a seat that the solo light reads (design 2.4): `SeatFlags` of the app. */
interface SoloFlag {
  /** True if the user soloed the seat. */
  readonly soloed: boolean;
}

/**
 * The layer of the draws of {@link StageScene} that warm a new scene (design 7.2). No object of
 * the stage uses it, so such a draw sees only the objects that the warm step puts on it.
 */
const WARM_LAYER = 31;

/** The difference of two aims below which the ease of the stage lights stops, in meters. */
const AIM_SETTLED = 1e-3;

/** The scene and the camera of one layout. */
interface LayoutView {
  /** The layout of the scene. The solo light reads its players (design 2.4). */
  readonly layout: SceneLayout;
  /** The stage side `S`, in meters. */
  readonly stageSide: number;
  /** The heads of the players and the conductor, for the focus of Free mode (design 4.5). */
  readonly spots: readonly FocusSpot[];
  readonly scene: Scene;
  readonly camera: StageCamera;
  /** The lights of the stage. Their shadows follow the quality tier. */
  readonly lights: Group;
  /** The meshes of the players in the order of `ScenePose.players`, then the conductor, if any. */
  readonly players: readonly SkinnedMesh[];
  /** The bone spheres of each player mesh that a fitted sphere can cull, by mesh. */
  readonly culled: ReadonlyMap<SkinnedMesh, BoneSpheres>;
  /** The hall around the stage. Its cutaway follows the camera. */
  readonly hall: Group;
  /** The light effects that write no depth, such as the visible beam (scene/post.ts). */
  readonly effects: readonly Object3D[];
  /** The bake of the static props, or `null` for a GPU with no target of floats (design 4.5). */
  readonly bake: LayoutBake | null;
  /** The captured environment, or `null` for a GPU with no target of floats (design 4.5). */
  readonly capture: LayoutCapture | null;
}

/** The scene of a layout from {@link StageScene.prepareSteps}, ready to show. */
export interface PreparedLayout {
  /** The scene and the camera of the layout. */
  readonly view: LayoutView;
  /** The aim of the stage lights of the layout with no solo. */
  readonly aim: LightAim;
}

/** The parts of a build that a later build frees if the build does not show. */
interface PendingBuild {
  readonly scene: Scene;
  /** The camera, with the listeners of its orbit controls, or `null` before it exists. */
  camera: StageCamera | null;
  /** The targets of the bake and of the capture. */
  readonly targets: WebGLRenderTarget[];
}

/** The captured environment of a layout, which a restored WebGL context makes again. */
interface LayoutCapture {
  /** The target that holds the environment texture. */
  target: WebGLRenderTarget;
  /** The hall of the layout. */
  readonly hall: Group;
  /** The stage side `S`, in meters. */
  readonly stageSide: number;
  /** The point of the capture and the hidden objects. */
  readonly options: CaptureOptions;
}

/** The bake of the static props of a layout, which a restored WebGL context makes again. */
interface LayoutBake {
  /** The stage side `S`, in meters. */
  readonly stageSide: number;
  /** The stage mesh: a caster and the receiver. */
  readonly stage: Mesh;
  /** The merged props of the layout: a caster. */
  readonly props: Mesh;
  /** The uniforms of the stage material that hold the bake. */
  readonly uniforms: StageBakeUniforms;
  /** The target that holds the bake. */
  target: WebGLRenderTarget;
}

/**
 * Gives the time of the moving light effects (design 2.5, 4.5): the drift of the haze and of the
 * dust motes, and the film grain.
 *
 * @param nowMs The wall time of the frame, in milliseconds.
 * @param reducedMotion True if the user prefers reduced motion.
 * @returns The wall time in seconds, or 0 with reduced motion, so that the effects stand still.
 */
export function effectTime(nowMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : nowMs / 1000;
}

/**
 * Finds the light effects of a scene: the objects whose materials write no depth, such as the
 * visible beam and the light on the floor. The depth pass of the post effects hides them.
 *
 * @param scene The scene.
 * @returns The effects.
 */
export function lightEffects(scene: Object3D): Object3D[] {
  const effects: Object3D[] = [];
  scene.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Points)) {
      return;
    }
    // The haze cone has a list of two materials, one for each side (`createBeam()`).
    const own: readonly Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (own.every((material) => !material.depthWrite)) {
      effects.push(object);
    }
  });
  return effects;
}

/**
 * The 3D scene of the page: the renderer, and the stage, the lights, the camera, the props, and the
 * players of one layout. The page keeps one renderer, so that a new layout does not compile the
 * shader programs again. The players show the bind pose until {@link StageScene.pose} gives them
 * the poses of a frame.
 */
/** The options of one render of {@link StageScene.render}. */
export interface RenderOptions {
  /**
   * The time of the frame, in milliseconds, for the effects and the glides: the time of a frame of
   * a video export (design 2.9). The time of the page when it is not given.
   */
  readonly nowMs?: number;
  /** True to show the shot of Cinematic mode in the full canvas, with no letterbox. */
  readonly fullFrame?: boolean;
}

/**
 * Renders the scene pass of a frame (design 4.5). The depth pass of the beam renders the shadow
 * map of the frame (`BeamDepth.render`), so the scene pass after it does not render the map again.
 * With no depth pass, the scene pass renders the map. The setting of the shadow map comes back
 * after the pass.
 *
 * @param shadowMap The shadow map of the renderer.
 * @param depthPass True if the depth pass of the beam rendered before the scene pass.
 * @param render Renders the scene, with or without the post effects.
 */
export function renderScenePass(
  shadowMap: Pick<WebGLShadowMap, 'autoUpdate'>,
  depthPass: boolean,
  render: () => void,
): void {
  const shadows = shadowMap.autoUpdate;
  shadowMap.autoUpdate = shadows && !depthPass;
  render();
  shadowMap.autoUpdate = shadows;
}

export class StageScene {
  /** The time that the frames add to `performance.now()`, after a video export (`endOwnClock()`). */
  #clockShiftMs = 0;
  /** The time of the last render, in milliseconds. */
  #lastNowMs = 0;
  readonly #canvas: HTMLCanvasElement;
  readonly #renderer: WebGLRenderer;
  /**
   * The environment of the reflections (design 4.5), or `null` before the first build. A restored
   * WebGL context makes it again.
   */
  #environment: WebGLRenderTarget | null = null;
  /**
   * The PMREM generator of the environment and of the captures. It keeps its materials, so each
   * capture compiles no program again (design 7.2).
   */
  #pmrem: PMREMGenerator;
  /** The exposure of the renderer of a wide shot (design 4.5). A close shot adds to it. */
  readonly #exposure: number;
  /**
   * The post effects, or `null` before the first build and for a GPU that cannot render to a
   * target of floats. The first build makes them, because the lookup table of the grade takes
   * steps (design 7.2).
   */
  #post: PostPipeline | null = null;
  /** The color format of the targets of the post effects, or `none` for no post effects. */
  readonly #postFormat: TargetFormat;
  /** The depth of the scene for the haze of the beam (design 4.5). */
  readonly #beamDepth = new BeamDepth();
  #tier: QualityTier;
  readonly #reducedMotion: boolean;
  /** The pool of the stage lights (design 4.5), which the materials of the scene share. */
  readonly #pool = createPoolUniforms();
  /** The light of a close shot (design 4.5, 5.6), which the shared material reads. */
  readonly #shot = createShotUniforms();
  /** The rim lights of the current layout in the materials (design 4.5). */
  readonly #rim = createRimUniforms();
  readonly #materials = createMaterials(this.#pool, this.#shot, this.#rim);
  /** The copies of the shared material for each program variant of the players. */
  readonly #variants = new VariantMaterials(this.#materials);
  #view: LayoutView | null = null;
  /** The build of a layout that does not show yet, or `null`. */
  #pending: PendingBuild | null = null;
  /**
   * The target that is current while a build compiles the programs of a pass into a target. Its
   * size does not change the programs, and no pass draws into it.
   */
  readonly #compileTarget = new WebGLRenderTarget(1, 1);
  #width = 1;
  #height = 1;
  #devicePixelRatio = 1;
  /** The focus distance of the last frame, in meters, or `null` before the first frame. */
  #focusDistance: number | null = null;
  /** The time of the last frame, in milliseconds, for the move of the focus of Free mode. */
  #focusMs = 0;
  /** The solo flags of the last call of {@link StageScene.solo}, or `null` after a new layout. */
  #soloFlags: readonly SoloFlag[] | null = null;
  /** The aim of the stage lights of the last frame (design 2.4, 4.5). */
  #aim: LightAim | null = null;
  /** The aim that the stage lights ease to: the aim of the solo flags. */
  #aimTarget: LightAim | null = null;
  /** The time of the last frame, in milliseconds, for the ease of the stage lights. */
  #aimMs = 0;
  /**
   * The progress of the move of the letterbox bars (design 2.5), from 0 (Free mode) to 1
   * (Cinematic mode).
   */
  #letterbox = 0;
  /** The time of the last move of the letterbox bars, in milliseconds, or `null` before it. */
  #letterboxMs: number | null = null;

  /**
   * Creates the renderer on a canvas. The scene shows nothing until {@link StageScene.show}.
   *
   * @param canvas The canvas of the page. The CSS sets its size.
   * @param options The quality tier and the motion preference.
   */
  constructor(canvas: HTMLCanvasElement, options: StageSceneOptions) {
    this.#canvas = canvas;
    this.#tier = options.tier;
    this.#reducedMotion = options.reducedMotion;
    this.#devicePixelRatio = options.devicePixelRatio;
    // A GPU with no target of floats renders with no post effects, so its canvas has the MSAA
    // (design 2.6).
    const look = options.targetFormat === 'none' ? 'stage' : 'post';
    this.#renderer = createRenderer(canvas, options.tier, options.devicePixelRatio, look);
    this.#renderer.setOpaqueSort(this.#variants.opaqueSort);
    this.#exposure = this.#renderer.toneMappingExposure;
    this.#pmrem = new PMREMGenerator(this.#renderer);
    this.#postFormat = targetFormatOf(this.#renderer);
  }

  /**
   * Makes the post effects in steps on the first build (design 7.2): the lookup table of the
   * grade, then the passes. A GPU that cannot render to a target of floats gets none.
   *
   * @returns The steps.
   */
  *#postSteps(): Steps<undefined> {
    if (this.#post || this.#postFormat === 'none') {
      return undefined;
    }
    yield* gradeLutSteps();
    const post = new PostPipeline(this.#renderer, this.#postFormat, this.#tier, this.#variants);
    const buffer = this.#renderer.getDrawingBufferSize(new Vector2());
    post.setSize(buffer.x, buffer.y);
    this.#post = post;
    return undefined;
  }

  /**
   * Builds the scene of a layout in steps (design 7.2), with no change of the shown layout. The
   * steps compile the shader programs of the scene and wait for the GPU, so that the first frame
   * of the layout compiles nothing. {@link StageScene.show} then shows the scene. A new build
   * frees the scene of a build that did not show.
   *
   * @param layout The positions of the stage, the players, and the stands.
   * @param models The player models of the score, which the layout and the pose plan share.
   * @returns The steps, which return the scene of the layout.
   */
  *prepareSteps(layout: SceneLayout, models: ModelCache): Steps<PreparedLayout> {
    this.#discardPending();
    yield* this.#postSteps();
    this.#environment ??= yield* createEnvironmentSteps(
      this.#renderer,
      this.#pmrem,
      this.#compileTarget,
    );
    const environment = this.#environment;
    const scene = new Scene();
    const pending: PendingBuild = { scene, camera: null, targets: [] };
    this.#pending = pending;
    scene.environment = environment.texture;
    scene.environmentIntensity = ENVIRONMENT.intensity;
    const materials = this.#materials;
    const hall = createHall(layout.stageSide);
    scene.add(hall);
    yield;
    const podium = layout.conductor ? layout.podium : null;
    const aim = defaultAim(layout.stageSide, podium);
    // The capture of the environment renders the stage with the aim and the rim lights of the
    // new layout. A shown layout is under the cover of the stage while a new one builds (PF1).
    setPoolAim(this.#pool, aim);
    const bakeUniforms = noBakeUniforms();
    const stageGroup = createStage(layout.stageSide, podium, this.#pool, bakeUniforms, this.#rim);
    scene.add(stageGroup);
    yield;
    const lights = createLights(layout.stageSide, this.#tier, layout.conductor);
    scene.add(lights);
    setRimLights(this.#rim, lights);
    yield;
    const props = createStaticMesh(buildSceneProps(layout), materials);
    scene.add(props);
    const players = yield* createPlayersSteps(playerSpots(layout), materials, models);
    this.#variants.assign(players);
    const culled = yield* cullPlayersSteps(players);
    const playerGroup = new Group().add(...players);
    scene.add(playerGroup);
    const camera = new StageCamera(
      this.#canvas,
      layout.stageSide,
      this.#reducedMotion,
      playersTop(layout, models),
    );
    pending.camera = camera;
    camera.resize(this.#width, this.#height);
    yield;
    const stage = stageGroup.children.find((child) => child instanceof Mesh);
    const beam = lights.children.find((child) => child instanceof Group);
    // The bake and the capture render the scene, so its programs compile first.
    yield* this.#compileSteps(scene, camera.camera, players);
    let bake: LayoutBake | null = null;
    if (this.#post && stage) {
      bake = yield* this.#bakeSteps(scene, layout.stageSide, stage, props, bakeUniforms, pending);
    }
    const capture = this.#post
      ? yield* this.#captureSteps(
          scene,
          hall,
          layout.stageSide,
          {
            position: [aim.center[0], CAPTURE.height, aim.center[1]],
            hidden: beam ? [playerGroup, props, beam] : [playerGroup, props],
          },
          pending,
        )
      : null;
    // The captured environment can give other programs to the materials that reflect it.
    yield* this.#compileSteps(scene, camera.camera, players);
    yield* this.#warmSteps(scene, camera.camera, players);
    return {
      aim,
      view: {
        layout,
        stageSide: layout.stageSide,
        spots: focusSpots(layout, models),
        scene,
        camera,
        lights,
        players,
        culled,
        hall,
        effects: lightEffects(scene),
        bake,
        capture,
      },
    };
  }

  /**
   * Shows the scene of a layout from {@link StageScene.prepareSteps}. The scene of the previous
   * layout frees its geometries, its own materials, and its lights. The shared material stays for
   * the next layout. The camera returns to the default view of the new stage, at the current size
   * of the canvas: {@link StageScene.resize} during the build resized only the shown camera.
   *
   * @param prepared The scene of the layout.
   */
  show(prepared: PreparedLayout): void {
    const { view, aim } = prepared;
    view.camera.resize(this.#width, this.#height);
    this.#pending = null;
    setPoolAim(this.#pool, aim);
    setRimLights(this.#rim, view.lights);
    this.#variants.useScene(view.scene);
    this.#disposeView();
    this.#focusDistance = null;
    // The lights of a new layout start at the aim with no solo, with no ease from the old stage.
    this.#soloFlags = null;
    this.#aim = aim;
    this.#aimTarget = aim;
    this.#view = view;
  }

  /**
   * Frees the scene of a build that did not show: a later selection replaced it (design 7.2).
   */
  #discardPending(): void {
    const pending = this.#pending;
    if (!pending) {
      return;
    }
    this.#pending = null;
    for (const target of pending.targets) {
      target.dispose();
    }
    disposeTree(pending.scene, new Set([...this.#materials, ...this.#variants.copies]));
    pending.camera?.dispose();
  }

  /**
   * Compiles the shader programs of each pass of a frame of a scene, and waits until the GPU
   * links them (`KHR_parallel_shader_compile`, design 7.2): the scene pass, the depth passes of
   * the beam and of the depth of field, the shadow map, and the post effects. A program then
   * links during the build, and the first frame waits for none. Each pass renders into a target,
   * so each compile has a target too: three.js gives a target other programs than the canvas.
   *
   * @param scene The scene of the layout.
   * @param camera The camera of the layout.
   * @param players The player meshes, which cast the shadows.
   * @returns The steps.
   */
  *#compileSteps(scene: Scene, camera: Camera, players: readonly SkinnedMesh[]): Steps<undefined> {
    const renderer = this.#renderer;
    const target = this.#compileTarget;
    const meshes: Object3D[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points || object instanceof Line) {
        meshes.push(object);
      }
    });
    for (const mesh of meshes) {
      compileInto(renderer, target, () => {
        renderer.compile(mesh, camera, scene);
      });
      yield;
    }
    for (const mesh of meshes) {
      this.#variants.renderDepthOf(mesh, () => {
        compileInto(renderer, target, () => {
          renderer.compile(mesh, camera, scene);
        });
      });
      yield;
    }
    // The shadow map draws each player with its depth material, the other side of its own
    // material (`getDepthMaterial()` of three.js), and its depth geometry: the depth pass of the
    // beam renders the shadow map (`VariantMaterials.renderDepth()`).
    for (const mesh of players) {
      const own = mesh.material;
      const full = mesh.geometry;
      const depth = mesh.customDepthMaterial;
      if (depth) {
        const side = depth.side;
        depth.side = BackSide;
        mesh.material = depth;
        mesh.geometry = depthGeometryOf(full) ?? full;
        compileInto(renderer, target, () => {
          renderer.compile(mesh, camera, scene);
        });
        mesh.material = own;
        mesh.geometry = full;
        depth.side = side;
      }
      yield;
    }
    if (this.#post) {
      yield* this.#post.compileSteps(target);
    }
    yield* programsReadySteps(renderer);
    return undefined;
  }

  /**
   * Draws each player geometry of a scene one time into the target of the compile, each in its own
   * step (design 7.2). The first draw of a geometry uploads its buffers and builds the texture of
   * its morph targets: 25 ms for the default demo on the development Mac. The first frame then
   * does neither. The draws see only one player and the lights ({@link WARM_LAYER}): one draw of
   * the geometry with the program of the scene pass, and one draw of its depth geometry with the
   * programs of the depth passes and of the shadow map. The next frame renders the shadow map
   * again.
   *
   * @param scene The scene of the layout.
   * @param camera The camera of the layout.
   * @param players The player meshes.
   * @returns The steps.
   */
  *#warmSteps(scene: Scene, camera: Camera, players: readonly SkinnedMesh[]): Steps<undefined> {
    const renderer = this.#renderer;
    const view = camera.clone();
    view.layers.set(WARM_LAYER);
    const lights: Object3D[] = [];
    scene.traverse((object) => {
      if (object instanceof Light) {
        lights.push(object);
      }
    });
    const geometries = new Set<BufferGeometry>();
    for (const mesh of players) {
      if (geometries.has(mesh.geometry)) {
        continue;
      }
      geometries.add(mesh.geometry);
      const culled = mesh.frustumCulled;
      mesh.frustumCulled = false;
      for (const object of [...lights, mesh]) {
        object.layers.enable(WARM_LAYER);
      }
      // The scene pass draws the geometry, and the depth passes and the shadow map draw the depth
      // geometry (`VariantMaterials.renderDepth()`).
      const shadows = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      compileInto(renderer, this.#compileTarget, () => {
        renderer.render(scene, view);
      });
      renderer.shadowMap.autoUpdate = shadows;
      this.#variants.renderDepthOf(mesh, () => {
        compileInto(renderer, this.#compileTarget, () => {
          renderer.render(scene, view);
        });
      });
      for (const object of [...lights, mesh]) {
        object.layers.disable(WARM_LAYER);
      }
      mesh.frustumCulled = culled;
      yield;
    }
    yield* gpuDoneSteps(renderer);
    return undefined;
  }

  /**
   * Captures the environment of a layout (`captureEnvironmentSteps()`, design 4.5) in steps: the
   * hall and the lit stage, with no players, no props, and no beam, from above the middle of the
   * pool of light. During the capture, the reflections use the environment of the renderer, and
   * the hall shows in full from the point of the capture.
   *
   * @param scene The scene of the layout.
   * @param hall The hall of the layout.
   * @param stageSide The stage side `S`, in meters.
   * @param options The point of the capture and the hidden objects.
   * @param pending The build that frees the target if it does not show, or `null`.
   * @returns The steps, which return the capture of the layout. The scene then uses it as its
   *   environment.
   */
  *#captureSteps(
    scene: Scene,
    hall: Group,
    stageSide: number,
    options: CaptureOptions,
    pending: PendingBuild | null,
  ): Steps<LayoutCapture> {
    scene.environment = this.#environment?.texture ?? null;
    scene.environmentIntensity = ENVIRONMENT.intensity;
    setHallCamera(hall, stageSide, new Vector3(...options.position), CAPTURE.size);
    const target = yield* captureEnvironmentSteps(this.#renderer, this.#pmrem, scene, options);
    pending?.targets.push(target);
    scene.environment = target.texture;
    scene.environmentIntensity = CAPTURE.intensity;
    return { target, hall, stageSide, options };
  }

  /**
   * Bakes the light of the static props on the stage top (`scene/stage-bake.ts`, design 4.5) in
   * steps. The stage and the props then cast no shadow in the shadow map of each frame, so their
   * shadows come only from the bake, and the players keep the shadow map.
   *
   * @param scene The scene of the layout.
   * @param stageSide The stage side `S`, in meters.
   * @param stage The stage mesh.
   * @param props The merged props.
   * @param uniforms The uniforms of the stage material that get the bake.
   * @param pending The build that frees the target if it does not show, or `null`.
   * @returns The steps, which return the bake of the layout.
   */
  *#bakeSteps(
    scene: Scene,
    stageSide: number,
    stage: Mesh,
    props: Mesh,
    uniforms: StageBakeUniforms,
    pending: PendingBuild | null,
  ): Steps<LayoutBake> {
    scene.updateMatrixWorld(true);
    const target = yield* bakeStageSteps(this.#renderer, {
      stageSide,
      keyPosition: keyLightPosition(stageSide),
      casters: [stage, props],
      receiver: stage,
    });
    pending?.targets.push(target);
    uniforms.uStageBake.value = target.texture;
    uniforms.uShadowLift.value = 0;
    uniforms.uStageBlur.value = STAGE_SHADOW.radius;
    stage.castShadow = false;
    props.castShadow = false;
    return { stageSide, stage, props, uniforms, target };
  }

  /**
   * Copies the poses of a frame to the players of the current layout (design 5.1). With no
   * layout, it does nothing.
   *
   * @param pose The poses from `poseAt()` with the plan of the current layout.
   */
  pose(pose: ScenePose): void {
    if (this.#view) {
      applyScenePose(this.#view.players, pose);
    }
  }

  /**
   * Sets the solo flags of the seats (design 2.4, 4.5). The key light, its pool, and the visible
   * beam move to the players of the soloed seats in the next frames, and back when no seat is
   * soloed. The app gives the flags in each frame. A new list gives a new aim, and the same list
   * keeps the aim. With no layout, it does nothing.
   *
   * @param flags The flags of each seat, by the index of the seat in `Score.seats`.
   */
  solo(flags: readonly SoloFlag[]): void {
    if (!this.#view || flags === this.#soloFlags) {
      return;
    }

    this.#soloFlags = flags;
    this.#aimTarget = soloAim(
      this.#view.layout,
      flags.map((flag) => flag.soloed),
    );
  }

  /**
   * Sets the size of the drawing buffer and of the camera view. A browser zoom or a move to
   * another display changes the `devicePixelRatio`, so the pixel ratio of the tier follows it.
   *
   * @param width The width of the canvas, in CSS pixels.
   * @param height The height of the canvas, in CSS pixels.
   * @param devicePixelRatio The current `devicePixelRatio` of the window.
   */
  resize(width: number, height: number, devicePixelRatio: number): void {
    this.#width = width;
    this.#height = height;
    this.#devicePixelRatio = devicePixelRatio;
    const pixelRatio = tierPixelRatio(this.#tier, devicePixelRatio);
    if (pixelRatio !== this.#renderer.getPixelRatio()) {
      this.#renderer.setPixelRatio(pixelRatio);
    }
    this.#renderer.setSize(width, height, false);
    const buffer = this.#renderer.getDrawingBufferSize(new Vector2());
    this.#post?.setSize(buffer.x, buffer.y);
    this.#beamDepth.setSize(buffer.x, buffer.y);
    this.#view?.camera.resize(width, height);
  }

  /**
   * Sets the size of the drawing buffer to exactly these pixels, with the pixel ratio 1, for the
   * frames of a video export (design 2.9). `resize()` gives the size of the page again.
   *
   * @param width The width, in pixels.
   * @param height The height, in pixels.
   */
  resizeExact(width: number, height: number): void {
    this.#width = width;
    this.#height = height;
    this.#renderer.setPixelRatio(1);
    this.#renderer.setSize(width, height, false);
    this.#post?.setSize(width, height);
    this.#beamDepth.setSize(width, height);
    this.#view?.camera.resize(width, height);
  }

  /**
   * Continues the clock of the effects and the glides after the frames of a video export, which
   * had their own times (`RenderOptions.nowMs`): the next frames take on from the last time, so
   * that no glide runs back.
   */
  endOwnClock(): void {
    this.#clockShiftMs = Math.max(0, this.#lastNowMs - performance.now());
  }

  /** True if the user prefers reduced motion (design 2.5). */
  get reducedMotion(): boolean {
    return this.#reducedMotion;
  }

  /** The position of the camera of the last frame, for the smoke test. */
  get cameraPosition(): Vec3 | null {
    return this.#view ? this.#view.camera.camera.position.toArray() : null;
  }

  /** The quality tier of the renderer (design 2.6). */
  get tier(): QualityTier {
    return this.#tier;
  }

  /**
   * Changes the quality tier (design 2.6): the pixel ratio of the canvas, the shadow map and the
   * shadow blur of the spotlight, and the haze samples and the dust motes of the beam. The next
   * layout also uses the new tier.
   *
   * @param tier The new tier.
   */
  setTier(tier: QualityTier): void {
    if (tier === this.#tier) {
      return;
    }
    this.#tier = tier;
    if (this.#view) {
      setLightsTier(this.#view.lights, tier);
    }
    this.#post?.setTier(tier);
    this.resize(this.#width, this.#height, this.#devicePixelRatio);
  }

  /**
   * Returns the camera to the default view of the stage ("Reset view", design 2.5). The app then
   * renders in Free mode.
   */
  resetView(): void {
    this.#view?.camera.reset();
  }

  /** The frame of the camera on the canvas, in CSS pixels (design 4.5), or `null` with no layout. */
  get frame(): ViewFrame | null {
    return this.#view?.camera.frame ?? null;
  }

  /** The width of the canvas divided by its height, for the shots of design 5.6. */
  get aspect(): number {
    return this.#width / this.#height;
  }

  /**
   * The height of each of the top and the bottom bars of the letterbox, in CSS pixels (design
   * 2.5): 0 in Free mode and on a canvas wider than 21:9. It comes from the current canvas size
   * and the move of the bars, not from the visible box of the last frame. A frame with no layout,
   * such as a frame during the load, does not update that box, so the box of a 1 × 1 canvas lifted
   * the bar of the controls to the middle of the window.
   */
  get letterboxBar(): number {
    return this.#barSize(this.#height, letterbox(this.#width, this.#height).height);
  }

  /**
   * The width of each of the side bars of the letterbox, in CSS pixels (design 2.5): 0 in Free
   * mode and on a canvas narrower than 21:9. It has the source of {@link StageScene.letterboxBar}.
   */
  get letterboxSide(): number {
    return this.#barSize(this.#width, letterbox(this.#width, this.#height).width);
  }

  /**
   * Gives the size of one bar of the letterbox at the current move of the bars: the half of the
   * space that the frame leaves on one axis.
   *
   * @param canvas The size of the canvas on the axis, in CSS pixels.
   * @param frame The size of the frame of Cinematic mode on the axis, in CSS pixels.
   * @returns The size of the bar, in CSS pixels.
   */
  #barSize(canvas: number, frame: number): number {
    const share = letterboxShare(this.#letterbox);
    if (share <= 0) {
      return 0;
    }
    return Math.max(0, ((canvas - frame) / 2) * share);
  }

  /**
   * Moves the letterbox bars toward the mode of the frame, and gives the view of the frame (design
   * 2.5). The bars move in `LETTERBOX_MOVE_MS` of `letterbox.ts`, at once with reduced motion.
   *
   * @param cinematic True in Cinematic mode.
   * @param nowMs The time of the frame, in milliseconds.
   * @returns The view of the post effects, with the share of the letterbox, from 0 to 1.
   */
  #followLetterbox(cinematic: boolean, nowMs: number): PostView {
    const last = this.#letterboxMs;
    const dtMs = last === null || this.#reducedMotion ? Infinity : nowMs - last;
    this.#letterboxMs = nowMs;
    this.#letterbox = stepLetterbox(this.#letterbox, cinematic, dtMs);
    const share = letterboxShare(this.#letterbox);
    if (share <= 0) {
      return { rect: null, imageHeight: 1, cinema: 0 };
    }

    const width = this.#width;
    const height = this.#height;
    const frame = letterbox(width, height);
    const visible = mixBox({ x: width / 2, y: height / 2, width, height }, frame, share);
    return {
      rect: uvRectOf(visible, width, height),
      imageHeight: 1 + (frame.height / height - 1) * share,
      cinema: share,
    };
  }

  /**
   * Renders one frame of the current layout. With no layout, it does nothing. The beam takes the
   * factor of the shot, or in Free mode the factor of the camera distance (design 4.5, 5.6). In
   * Cinematic mode, the scene shows in the letterbox, and the canvas is black around it (design
   * 2.5). No pass renders the scene under the bars.
   *
   * @param shot The camera of the shot of the frame in Cinematic mode, or `null` in Free mode.
   *   Then the orbit controls move the camera (design 2.5).
   * @param cover The parts of the page over the canvas, which move the frame (design 2.8).
   * @param ring The box of the load ring of the play button of the first screen, in CSS pixels,
   *   or `null` while it does not show. The stage shrinks until it is clear of it.
   */
  render(
    shot: CameraPose | null,
    cover: FrameCover,
    ring: ScreenBox | null,
    options: RenderOptions = {},
  ): void {
    const view = this.#view;
    if (!view) {
      return;
    }
    const nowMs = options.nowMs ?? performance.now() + this.#clockShiftMs;
    this.#lastNowMs = nowMs;
    const letterboxed = shot !== null && options.fullFrame !== true;
    let beam: number;
    let light: number;
    let spot = 0;
    if (shot) {
      view.camera.follow(shot);
      beam = shot.beam;
      light = shot.light;
      spot = shot.spot;
    } else {
      view.camera.update();
      const [x, y, z] = view.camera.camera.position.toArray();
      beam = freeBeamOpacity(view.stageSide, this.aspect, [x, y, z]);
      light = freeShotLight(view.stageSide, this.aspect, [x, y, z]);
    }
    this.#lightShot(view, light, spot);
    const postView = this.#followLetterbox(letterboxed, nowMs);
    view.camera.frameTo(cover, ring, nowMs, postView.cinema);
    const foot = this.#followAim(view, nowMs);
    const camera = view.camera.camera;
    const timeSec = effectTime(nowMs, this.#reducedMotion);
    const beamGroup = view.lights.children.find((child) => child instanceof Group);
    const depthPass = beamGroup instanceof Group;
    if (depthPass) {
      this.#holdPose(view);
      const hidden = [...view.effects, view.hall];
      this.#beamDepth.crop(postView.rect);
      this.#beamDepth.render(this.#renderer, view.scene, camera, hidden, this.#variants);
      setBeamFrame(beamGroup, {
        stageSide: view.stageSide,
        factor: beam,
        camera,
        timeSec,
        depth: this.#beamDepth,
        foot,
      });
    }
    setHallCamera(view.hall, view.stageSide, camera.position, this.#beamDepth.size[1]);
    const focus = this.#focusOf(view, shot !== null, nowMs);
    if (!depthPass) {
      this.#holdPose(view);
    }
    renderScenePass(this.#renderer.shadowMap, depthPass, () => {
      if (this.#post) {
        const haze = depthPass ? this.#hazeOf(view) : null;
        const vignette = vignetteOf(light, postView.cinema);
        this.#post.render(view.scene, camera, focus, view.effects, timeSec, {
          haze,
          vignette,
          view: postView,
        });
      } else {
        this.#scissorCanvas(postView.rect);
        this.#renderer.render(view.scene, camera);
      }
    });
    view.scene.matrixWorldAutoUpdate = true;
    releaseSkeletons(view.players);
  }

  /**
   * Limits the render to the canvas to the letterbox, with no post effects (design 2.5). The
   * browser clears the canvas before each frame, so the bars stay black.
   *
   * @param rect The part of the canvas that shows the scene, or `null` for the full canvas.
   */
  #scissorCanvas(rect: UvRect | null): void {
    const renderer = this.#renderer;
    renderer.setScissorTest(rect !== null);
    if (rect) {
      const width = this.#width;
      const height = this.#height;
      renderer.setScissor(
        rect.left * width,
        rect.bottom * height,
        (rect.right - rect.left) * width,
        (rect.top - rect.bottom) * height,
      );
    }
  }

  /**
   * Updates the world matrices and the bone matrices of a frame one time, before its first render
   * (`holdSkeletons()`). The renders of the frame then update neither of them again.
   *
   * @param view The layout of the frame.
   */
  #holdPose(view: LayoutView): void {
    view.scene.updateMatrixWorld();
    view.scene.matrixWorldAutoUpdate = false;
    holdSkeletons(view.players);
    for (const [mesh, spheres] of view.culled) {
      if (mesh.boundingSphere) {
        fitPoseSphere(mesh, spheres, mesh.boundingSphere);
      }
    }
  }

  /**
   * Sets the light of the shot of a frame (design 4.5, 5.6): the lamps of a close shot around the
   * target of the camera, which light the players and the props, and the extra exposure. The
   * exposure takes the shade share of the rig, as the soft key does.
   *
   * @param view The layout of the frame. Its camera has the place of the frame.
   * @param light The weight of the light of a close shot, from 0 to 1.
   * @param spot The weight of the follow-spot, from 0 to 1.
   */
  #lightShot(view: LayoutView, light: number, spot: number): void {
    const camera = view.camera.camera;
    const rig = shotRig(camera.position.toArray(), view.camera.target, camera.fov, spot);
    setShotLight(this.#shot, rig, light, spot);
    const stops = SHOT_LOOK.exposure * light * rig.shade;
    this.#renderer.toneMappingExposure = this.#exposure * 2 ** stops;
  }

  /**
   * Gives the room haze of a frame (design 4.5): it starts at the point that the camera looks at,
   * so the subject and the stage in front of it stay clear.
   *
   * @param view The layout of the frame. The depth pass of the beam rendered its depth.
   * @returns The haze.
   */
  #hazeOf(view: LayoutView): HazeFrame {
    const camera = view.camera.camera;
    return {
      depth: this.#beamDepth.texture,
      start: camera.position.distanceTo(new Vector3(...view.camera.target)),
      stageSide: view.stageSide,
      light: rimLightPlace(view.stageSide),
      floorY: -STAGE_THICKNESS,
    };
  }

  /**
   * Eases the stage lights to the aim of the solo flags (design 2.4, 4.5): the pool, the hot spot,
   * the aim of the key light, and the aim of the rim lights. The ease stops when the lights reach
   * the aim.
   *
   * @param view The layout of the frame.
   * @param nowMs The time of the frame, in milliseconds.
   * @returns The foot of the visible beam of the frame.
   */
  #followAim(view: LayoutView, nowMs: number): readonly [number, number] {
    const from = this.#aim;
    const target = this.#aimTarget;
    const dtSec = (nowMs - this.#aimMs) / 1000;
    this.#aimMs = nowMs;
    if (!from || !target) {
      return [0, 0];
    }
    if (from === target) {
      return from.beam;
    }

    const eased = easeAim(from, target, easeShare(dtSec, this.#reducedMotion));
    const aim = aimGap(eased, target) < AIM_SETTLED ? target : eased;
    this.#aim = aim;
    setPoolAim(this.#pool, aim);
    aimKeyLight(view.lights, view.stageSide, aim.center[0], aim.center[1]);
    aimRimLights(view.lights, view.stageSide, aim.beam[0], aim.beam[1]);
    setRimLights(this.#rim, view.lights);
    return aim.beam;
  }

  /**
   * Calculates the focus of a frame (design 4.5). A shot focuses on its subject. Free mode
   * focuses on the first player or the stage top in the middle of the frame, and the focus moves
   * to a new distance in about 0.3 s, at once with reduced motion.
   *
   * @param view The layout of the frame.
   * @param following True when the camera of the frame comes from a shot.
   * @param nowMs The time of the frame, in milliseconds.
   * @returns The focus.
   */
  #focusOf(view: LayoutView, following: boolean, nowMs: number): Focus {
    const camera = view.camera.camera;
    const position = camera.position.toArray();
    const target = view.camera.target;
    let focus: Focus;
    if (following) {
      focus = focusOf(position, target, camera.fov, camera.far, view.stageSide);
    } else {
      let distance = freeFocusDistance(position, target, view.stageSide, view.spots);
      const last = this.#focusDistance;
      if (last !== null && !this.#reducedMotion) {
        const share = Math.exp(-(nowMs - this.#focusMs) / FREE_LENS.glideMs);
        distance += (last - distance) * share;
      }
      const orbit = camera.position.distanceTo(new Vector3(...target));
      focus = freeFocusOf(orbit, distance, camera.fov, camera.far, view.stageSide);
    }

    this.#focusDistance = focus.distance;
    this.#focusMs = nowMs;
    return focus;
  }

  /**
   * Frees the GPU resources of the scene, the materials, and the renderer, and removes the
   * listeners of the orbit controls. The scene must not render again.
   */
  dispose(): void {
    this.#disposeView();
    for (const material of this.#materials) {
      material.dispose();
    }
    this.#discardPending();
    this.#variants.dispose();
    this.#post?.dispose();
    this.#beamDepth.dispose();
    this.#environment?.dispose();
    this.#pmrem.dispose();
    this.#compileTarget.dispose();
    this.#renderer.dispose();
  }

  /**
   * Makes the environment of the reflections, the bake of the static props, and the captured
   * environment of the shown layout again after a restored WebGL context, in steps (design 7.2).
   * The PMREM of the environment, the bake, and the capture render one time, so a lost context
   * loses their content. The renderer makes its own state again in its listener of the restore.
   * The steps wait for the GPU, and WebGL changes the status of a fence or of a parallel compile
   * only between two tasks, so `runAll()` cannot run them: the app runs them in slices.
   *
   * @returns The steps.
   */
  *restoreSteps(): Steps<undefined> {
    // The generator of the lost context holds no valid target, so a new one makes the maps.
    this.#pmrem.dispose();
    this.#pmrem = new PMREMGenerator(this.#renderer);
    this.#environment?.dispose();
    this.#environment = null;
    const view = this.#view;
    if (!view) {
      return undefined;
    }

    const environment = yield* createEnvironmentSteps(
      this.#renderer,
      this.#pmrem,
      this.#compileTarget,
    );
    this.#environment = environment;
    view.scene.environment = environment.texture;
    const bake = view.bake;
    if (bake) {
      bake.target.dispose();
      const { target } = yield* this.#bakeSteps(
        view.scene,
        bake.stageSide,
        bake.stage,
        bake.props,
        bake.uniforms,
        null,
      );
      bake.target = target;
    }
    const capture = view.capture;
    if (capture) {
      capture.target.dispose();
      const { target } = yield* this.#captureSteps(
        view.scene,
        capture.hall,
        capture.stageSide,
        capture.options,
        null,
      );
      capture.target = target;
    }
    return undefined;
  }

  #disposeView(): void {
    if (!this.#view) {
      return;
    }
    this.#view.bake?.target.dispose();
    this.#view.capture?.target.dispose();
    disposeTree(this.#view.scene, new Set([...this.#materials, ...this.#variants.copies]));
    this.#view.camera.dispose();
    this.#view = null;
  }
}
