import { pieceGainDb } from '../audio/demo-loudness.ts';
import type { MixName } from '../audio/output-chain.ts';
import type { LoadProgress, Player } from '../audio/player.ts';
import { fetchPlainBytes } from '../audio/plain-bytes.ts';
import type { PosePlan } from '../pose/plan.ts';
import { createScenePose, poseAt } from '../pose/pose-at.ts';
import type { ScenePoseBuffer } from '../pose/pose-at.ts';
import type { SeatAudibility } from '../pose/types.ts';
import type { ExportProgress } from './video-export.ts';
import type { PreparedLayout, StageScene } from '../scene/stage-scene.ts';
import type { Steps } from '../score/steps.ts';
import { stageMix } from '../score/stage-mix.ts';
import type { ChannelMix } from '../score/stage-mix.ts';
import { cameraAt, createCameraPose } from '../shots/camera-at.ts';
import { seatViewPlan } from '../shots/prepare.ts';
import type { CameraPose, ShotPlan } from '../shots/types.ts';
import { CINEMA_ASPECT } from '../shots/view.ts';
import type { Score, SectionSize } from '../score/types.ts';
import { focusKindOf } from '../ui/dom.ts';
import { nextShadeLevel } from '../ui/title-shade.ts';
import { Ui } from '../ui/ui.ts';
import type { CameraChoice, ExportForm } from '../ui/video-panel.ts';
import { playWithSilentSwitch, warmAudioOutput } from './audio-session.ts';
import { BackdropProbe } from './backdrop-probe.ts';
import { DEFAULT_SPEED, DEFAULT_VOLUME, uiShown, volumeGain } from './bar-rules.ts';
import { motionEvent, nextMode } from './camera-mode.ts';
import type { CameraEvent, CameraMode } from './camera-mode.ts';
import type { Speed } from './bar-rules.ts';
import { DEMOS, PERF_60, demoHash, demoUrl, isDemoId } from './demos.ts';
import type { StageFile } from './demos.ts';
import { FILE_ERROR_TEXTS, fileTitle, readScoreFile } from './file-rules.ts';
import { keyAction, keySeekPoint, keyVolume } from './keys.ts';
import { METER_BARS, meterLevels, meterTrack, seatLevels, seatSpans } from './meter.ts';
import type { MeterTrack, SeatSpans } from './meter.ts';
import { failureMessage, followMessage, textMessage } from './messages.ts';
import type { Failure, Message } from './messages.ts';
import type { TitleLines } from './file-rules.ts';
import { mixOfQuery } from './mix-query.ts';
import { pageTitle } from './page-title.ts';
import {
  atSongEnd,
  firstScreenView,
  noPieceStatus,
  playAction,
  playLabel,
} from './play-control.ts';
import type { SampleState } from './play-control.ts';
import type { PointerPoint } from './pick.ts';
import { changedSeats, followAudibility, seatsAudible, toggleSeatFlag } from './seat-flags.ts';
import type { SeatFlag, SeatFlags } from './seat-flags.ts';
import { playerCounts, seatRows } from './seat-text.ts';
import { followSeek, shownSongTime } from './seek.ts';
import { stageCover } from './stage-cover.ts';
import { PHONE_LAYOUT_QUERY } from './phone-layout.ts';
import { planFileSteps, planScoreSteps } from './scene-plan.ts';
import type { PlannedScore, ScoreScene } from './scene-plan.ts';
import { runSliced } from './slices.ts';
import {
  FPS_WINDOW_MS,
  autoLabels,
  followFrame,
  frameDue,
  measuredFrameRate,
  renderTier,
  watchTier,
} from './settings.ts';
import type { FrameRateSetting, QualitySetting, TierWatch } from './settings.ts';
import { songTimeValue, wholeSeconds } from './time-text.ts';
import {
  NOT_STARTED,
  STOPPED,
  changeTransport,
  followSongTime,
  seekPlayState,
  setPlaying,
  startPlay,
} from './transport.ts';
import type { PlayState } from './transport.ts';

/**
 * The wall clock seconds from the start of the lifts of a video export to its first frame
 * (design 2.9): the players hold their instruments up at the first frame.
 */
const EXPORT_LEAD_SEC = 2;

/** The options of a video export (design 2.9), from the tab "Video". */
export interface ExportRequest {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** The song time of the first frame, in seconds. */
  readonly startSec: number;
  /** The length of the music in the video, in seconds, or `null` to the song end. */
  readonly lengthSec: number | null;
  /** The seconds of picture and sound after the music, for the hall to ring out. */
  readonly tailSec: number;
  /** True for the shots in the full frame, false for the letterbox of 21:9. */
  readonly fullFrame: boolean;
  /** True for a video with sound. */
  readonly sound: boolean;
}

/** The time between two updates of the frame rate counter of the settings, in seconds. */
const FPS_COUNTER_SEC = 0.5;

/** The current piece: its score, its pose plan, the pose buffer of its frames, and its load. */
interface Piece {
  /** The demo or `perf-60.mid`, or `null` for a file of the user (design 2.1). */
  readonly file: StageFile | null;
  readonly title: TitleLines;
  /** The bytes of the file. A change of the section size builds the score again from them. */
  readonly bytes: Uint8Array;
  /** The score. A change of the section size replaces it, its plan, and its poses (design 3.8). */
  score: Score;
  /**
   * The pan and the reverb send of each synth channel, from the layout of the score (design
   * 6.1). A change of the section size replaces it with the score.
   */
  mix: readonly ChannelMix[];
  plan: PosePlan;
  poses: ScenePoseBuffer;
  /** The camera shots of the score (design 5.6). */
  shots: ShotPlan;
  /** The levels of the meter in the demo list (design 2.8). */
  meter: MeterTrack;
  /** The spans of sound of each seat, for the rings of the seat list (design 2.8). */
  glow: SeatSpans;
  /** The load of the samples of the score into the `Player`. */
  samples: SampleState;
  /** The progress of the load, or `null` before the list of the preset files is known. */
  progress: LoadProgress | null;
  /** The wall time at which the load of the samples started, in seconds (design 2.8). */
  loadStartSec: number;
  /** True if the piece starts when its samples are ready (design 2.2, 2.4). */
  playWhenReady: boolean;
  /** True after the first play of the piece. */
  played: boolean;
  /** The mute and solo buttons of each seat. A new file resets them (design 6.6). */
  flags: readonly SeatFlags[];
  /** True for each seat that sounds, from {@link seatsAudible}. */
  audible: readonly boolean[];
  /** The audibility of each seat for `poseAt()` (design 5.5). */
  audibility: readonly (SeatAudibility | undefined)[];
}

/** The audio of the page: the `Player` and its helpers, from the module that loads late. */
interface Audio {
  readonly player: Player;
  /**
   * Tells if a load failed because a later load replaced it (design 6.8).
   *
   * @param error The error of the load.
   * @returns True for a `LoadReplacedError`, which the app ignores.
   */
  readonly replaced: (error: Error) => boolean;
  /**
   * Resumes the suspended audio context in a user gesture. A click that waits for the samples
   * calls it, because Safari can reject a resume outside a user gesture (design 2.4, 6.8).
   */
  readonly resume: () => void;
}

/** A score with its scene, and the 3D scene of its layout, ready to show. */
interface BuiltScore extends PlannedScore {
  readonly prepared: PreparedLayout;
}

/**
 * Gives the section size of a file. `perf-60.mid` always uses "One per part" (design 9.5).
 *
 * @param file The demo or `perf-60.mid`, or `null` for a file of the user.
 * @param setting The value of the setting "Section size".
 * @returns The section size for `buildScore()`.
 */
function sectionSizeOf(file: StageFile | null, setting: SectionSize): SectionSize {
  return file === PERF_60 ? 'one-per-part' : setting;
}

/**
 * Gives the title and the composer of a demo or of `perf-60.mid` (design 2.8, 8.2).
 *
 * @param file The demo, or `perf-60.mid`.
 * @returns The title and the composer.
 */
function stageFileTitle(file: StageFile): TitleLines {
  return isDemoId(file) ? DEMOS[file] : { title: `${PERF_60}.mid`, composer: '' };
}

/** The file of a new piece: its score and bytes, its title, and its demo. */
interface PieceFile {
  /** The demo or `perf-60.mid`, or `null` for a file of the user. */
  readonly file: StageFile | null;
  readonly title: TitleLines;
  readonly bytes: Uint8Array;
  readonly score: Score;
}

/**
 * Fetches a demo or `perf-60.mid` from the site. The build gzips each demo file (design 8.3).
 *
 * @param file The demo, or `perf-60.mid`.
 * @returns The plain bytes of the file.
 * @throws Error if the file does not load.
 */
async function fetchStageFile(file: StageFile): Promise<Uint8Array> {
  const base = import.meta.env.BASE_URL;
  return fetchPlainBytes(file === PERF_60 ? `${base}perf/perf-60.mid` : demoUrl(file, base));
}

/**
 * Makes the piece of a file with its scene, with no load and no seat flags.
 *
 * @param source The file and its score.
 * @param scene The scene of the score, from `planSceneSteps()`.
 * @param playWhenReady True if the piece starts when its samples are ready.
 * @returns The piece.
 */
function preparePiece(source: PieceFile, scene: ScoreScene, playWhenReady: boolean): Piece {
  const { score } = source;
  const { layout, plan, shots } = scene;
  const piece: Piece = {
    ...source,
    mix: stageMix(score, layout),
    plan,
    shots,
    meter: meterTrack(score.notes, score.durationSec),
    glow: seatSpans(score.notes, score.seats.length),
    poses: createScenePose(plan),
    samples: 'loading',
    progress: null,
    loadStartSec: performance.now() / 1000,
    playWhenReady,
    played: false,
    flags: [],
    audible: score.seats.map(() => true),
    audibility: [],
  };
  return piece;
}

/**
 * The load flow and the transport of the page (design 2.2, 2.4, 6.5): it shows a piece on the
 * stage, loads its samples into the `Player`, plays it with the poses in sync, and connects the
 * UI to the transport.
 */
export class App {
  readonly #canvas: HTMLCanvasElement;
  readonly #scene: StageScene;
  readonly #ui: Ui;
  #piece: Piece | null = null;
  #audio: Audio | null = null;
  /** True after the first start of the audio module. */
  #audioStarted = false;
  /** The start of the audio output service, which the `AudioContext` waits for (design 6.3). */
  readonly #audioOutput: Promise<void>;
  #state: PlayState = STOPPED;
  /** The song time of `Player.now()` in the last frame. */
  #songTime = 0;
  /** The levels of the meter of the demo list in the last frame (design 2.8). */
  readonly #meterLevels = new Float32Array(METER_BARS);
  /** The levels of the rings of the seat list in the last frame, one for each seat (design 2.8). */
  #seatLevels = new Float32Array(0);
  /** The seek point that the listener does not hear yet, or `null` (`app/seek.ts`). */
  #seekSec: number | null = null;
  /** The number of the last selection. A later selection replaces an earlier one. */
  #request = 0;
  /** The number of the last change of the section size. A later change replaces its build. */
  #rebuilds = 0;
  /**
   * The end of the last build of a scene (design 7.2). A build waits for the build before it, so
   * that two builds do not share the renderer. A later selection stops the build before it.
   */
  #lastBuild: Promise<unknown> = Promise.resolve();
  /** The demo whose file did not load, for "Try again", or `null` (design 2.2, 2.8). */
  #failedFile: StageFile | null = null;
  /**
   * True after a click on play before the first piece shows: the piece then starts when its
   * samples are ready (design 2.2).
   */
  #playWhenShown = false;
  /** True after the first play of the session (design 2.8, the first screen). */
  #sessionPlayed = false;
  #speed: Speed = DEFAULT_SPEED;
  #volume = DEFAULT_VOLUME;
  #muted = false;
  /** The mix preset of the session, from the query `mix` (design 6.8). */
  readonly #mix: MixName = mixOfQuery(window.location.search);
  /** The value of the setting "Section size" (design 2.8, 3.8). */
  #sectionSize: SectionSize = 'auto';
  /** The value of the setting "Quality" (design 2.6). */
  #quality: QualitySetting = 'auto';
  /** The value of the setting "Frame rate" (design 2.6). */
  #frameRate: FrameRateSetting = 'auto';
  /** The time of the last drawn frame, in milliseconds, or `null` before the first. */
  #lastDrawMs: number | null = null;
  /** The times of the drawn frames of the last {@link FPS_WINDOW_MS}, in milliseconds. */
  #drawTimes: number[] = [];
  /** The wall time of the last update of the frame rate counter, in seconds. */
  #fpsShownAt = 0;
  /** The automatic tier, from the tier of the device at start (design 2.6). */
  #tierWatch: TierWatch;
  /** The wall time of the last pointer motion or tap, in seconds. */
  #activeAt = 0;
  /** The message at the bottom center, or `null` (design 2.8). */
  #message: Message | null = null;
  /** Cinematic or Free (design 2.5). The page starts in Free mode. */
  #cameraMode: CameraMode = 'free';
  /**
   * The seat whose held view Cinematic mode shows in place of the shots of the director, or
   * `null` (the camera menu, design 2.5). Each other change of the camera ends it.
   */
  #seatView: number | null = null;
  /** True while a video export renders its frames: the page draws no frame (design 2.9). */
  #exporting = false;
  /** The cancel of the running video export, or `null` with none (design 2.9). */
  #exportAbort: AbortController | null = null;
  /** The camera of the shot of the last frame, which `cameraAt()` writes. */
  readonly #shotCamera = createCameraPose();
  /** The phone layout of design 2.8, which moves the frame above the sheet. */
  readonly #phone = window.matchMedia(PHONE_LAYOUT_QUERY);
  /** The probe of the frame behind the title, for the shade (design 2.8). */
  readonly #backdrop: BackdropProbe;
  /** The level of the shade of each title line that the last read of the backdrop asked for. */
  #shadeNeeded: readonly number[] = [];
  /** The level of the shade of each title line in the last frame, from 0 to 1. */
  #shadeLevels: readonly number[] = [];
  /** The wall time of the last frame, in seconds, for the fall of the title shade. */
  #shadeAt = 0;

  /**
   * Creates the UI over the canvas and connects its controls.
   *
   * @param canvas The canvas of the stage.
   * @param scene The 3D scene on the canvas.
   */
  constructor(canvas: HTMLCanvasElement, scene: StageScene) {
    this.#canvas = canvas;
    this.#scene = scene;
    this.#audioOutput = warmAudioOutput(navigator);
    // The renderer made the context of the canvas first, so the canvas gives the same context.
    this.#backdrop = new BackdropProbe(canvas, canvas.getContext('webgl2'));
    this.#tierWatch = watchTier(scene.tier);
    this.#ui = new Ui(
      document.body,
      {
        onPlay: () => {
          this.#clickPlay();
        },
        onFirstPlay: () => {
          // The large button follows the rules of the play button of the bar (design 2.2).
          this.#clickPlay();
        },
        onSeek: (songSec) => {
          this.#seek(songSec);
        },
        onSpeed: (speed) => {
          this.#speed = speed;
          this.#audio?.player.setRate(speed);
        },
        onVolume: (volume) => {
          this.#setVolume(volume);
        },
        onMute: () => {
          this.#toggleMute();
        },
        onCamera: () => {
          this.#changeCamera('toggle');
        },
        onResetView: () => {
          scene.resetView();
          this.#changeCamera('reset');
        },
        onFullScreen: () => {
          toggleFullScreen();
        },
        onDrawer: () => {
          this.#ui.drawer.setOpen(!this.#ui.drawer.open);
        },
        onSelectDemo: (id) => {
          this.#ui.closeSheetAfterSelection();
          this.#selectDemo(id);
        },
        onFile: (file) => {
          this.#audio?.resume();
          this.openFile(file).catch(reportError);
        },
        onSeatFlag: (seatIndex, flag) => {
          this.#toggleSeat(seatIndex, flag);
        },
        onSectionSize: (size) => {
          this.#setSectionSize(size);
        },
        onQuality: (quality) => {
          this.#quality = quality;
          this.#applySettings();
        },
        onFrameRate: (frameRate) => {
          this.#frameRate = frameRate;
          this.#applySettings();
        },
        onCameraChoice: (choice) => {
          this.#chooseCamera(choice);
        },
        onExport: (form) => {
          this.#startExport(form).catch(reportError);
        },
        onCancelExport: () => {
          this.#exportAbort?.abort();
        },
        onRetry: () => {
          this.#message = null;
          if (this.#failedFile !== null) {
            this.#selectDemo(this.#failedFile);
          } else if (this.#piece?.samples === 'failed') {
            this.#retry(this.#piece);
          }
        },
        onCloseMessage: () => {
          this.#message = null;
        },
      },
      DEFAULT_VOLUME,
      document.fullscreenEnabled,
      window,
    );
    const active = (): void => {
      this.#activeAt = performance.now() / 1000;
    };
    window.addEventListener('pointermove', active);
    window.addEventListener('pointerdown', active);
    window.addEventListener('keydown', (event) => {
      this.#pressKey(event);
    });
    // Safari on iOS zooms the page on a pinch in spite of `touch-action` of the root. Its own
    // gesture events stop that, so a pinch zooms only the stage (design 2.5).
    const keepPageScale = (event: Event): void => {
      event.preventDefault();
    };
    for (const name of ['gesturestart', 'gesturechange']) {
      document.addEventListener(name, keepPageScale, { passive: false });
    }
    this.#listenForMotion(canvas);
    // The renderer made its listener first, so it makes its own state again before the steps.
    canvas.addEventListener('webglcontextrestored', () => {
      this.#restoreScene();
    });
    this.#applySettings();
  }

  /**
   * Makes the maps of the 3D scene again after a restored WebGL context
   * (`StageScene.restoreSteps()`), in slices of the main thread after the build before it (design
   * 7.2). The steps wait for the GPU, and WebGL gives the end of a wait only in a later task, so
   * one task cannot run them.
   */
  #restoreScene(): void {
    const steps = this.#scene.restoreSteps();
    const run = this.#lastBuild.then(async () => runSliced(steps, () => true));
    this.#lastBuild = run.catch(() => null);
    run.catch(reportError);
  }

  /**
   * Does the action of a key of the page (design 2.4). Space plays and pauses, the left and the
   * right arrows seek 5 s, Home goes to the start, the up and the down arrows change the volume, C
   * toggles the cinematic camera, M the mute button, and F the full screen. Escape closes the
   * drawer, and the drawer button gets the focus that the drawer held. A key action shows the bar,
   * as a pointer motion does, and Tab shows the hidden UI of Cinematic mode (design 2.3). While the
   * credits dialog is open, no key of the page acts, and Escape closes only the dialog (design
   * 2.8).
   *
   * @param event The key event.
   */
  #pressKey(event: KeyboardEvent): void {
    const modified = event.ctrlKey || event.altKey || event.metaKey;
    if (event.key === 'Tab') {
      this.#activeAt = performance.now() / 1000;
    }
    const dialog = this.#ui.creditsDialog.open;
    if (event.key === 'Escape' && !modified && this.#ui.drawer.open && !dialog) {
      this.#ui.closeDrawer();
      return;
    }
    const press = { key: event.key, repeat: event.repeat, modified };
    const action = keyAction(press, dialog ? 'dialog' : focusKindOf(document.activeElement));
    if (!action) {
      return;
    }
    event.preventDefault();
    this.#activeAt = performance.now() / 1000;
    if (action === 'play') {
      this.#clickPlay();
    } else if (action === 'camera') {
      this.#changeCamera('toggle');
    } else if (action === 'mute') {
      this.#toggleMute();
    } else if (action === 'volume-up' || action === 'volume-down') {
      this.#setVolume(keyVolume(action, this.#volume));
    } else if (action === 'full-screen') {
      // The bar has no full screen button when the browser has no full screen for the page.
      if (document.fullscreenEnabled) {
        toggleFullScreen();
      }
    } else {
      this.#seek(keySeekPoint(action, shownSongTime(this.#seekSec, this.#songTime)));
    }
  }

  /** Shows the settings, and gives the renderer the tier of the quality setting (design 2.6). */
  #applySettings(): void {
    const auto = autoLabels(this.#piece?.score.orchestral ?? null, this.#tierWatch.tier);
    this.#ui.settings.show(this.#sectionSize, this.#quality, this.#frameRate, auto);
    this.#scene.setTier(renderTier(this.#quality, this.#tierWatch));
  }

  /**
   * Builds the score of the current piece again with a new section size (design 3.8). The
   * players, the layout, and the poses change. The sound, the seats, the song time, the play
   * state, and the mute and solo flags stay, because the section size changes only the player
   * counts. The `Player` thus keeps its score, and the music does not stop.
   *
   * @param size The new section size.
   */
  #setSectionSize(size: SectionSize): void {
    if (size === this.#sectionSize) {
      return;
    }
    this.#sectionSize = size;
    this.#applySettings();
    const piece = this.#piece;
    if (!piece || piece.file === PERF_60) {
      return;
    }
    // The stage fades out during the build of the new scene (PF1).
    const ticket = ++this.#rebuilds;
    this.#ui
      .coverStage()
      .then(async () => {
        // A new piece or a later change of the setting replaces this build.
        await this.#rebuildScene(piece, size, () => ticket === this.#rebuilds);
        this.#ui.uncoverStage();
      })
      .catch(reportError);
  }

  /**
   * Builds the score, the plans, and the scene of the current piece again with a section size
   * (design 3.8).
   *
   * @param piece The current piece.
   * @param size The section size.
   * @param live Tells if the build is still needed: a later selection or change replaces it.
   */
  async #rebuildScene(piece: Piece, size: SectionSize, live: () => boolean): Promise<void> {
    const built = await this.#build(planFileSteps(piece.bytes, size, piece.title.title), () => {
      return live() && piece === this.#piece;
    });
    if (!built) {
      return;
    }
    const { score, scene, prepared } = built;
    const { layout, plan, shots } = scene;
    piece.score = score;
    piece.mix = stageMix(score, layout);
    piece.plan = plan;
    piece.shots = shots;
    piece.meter = meterTrack(score.notes, score.durationSec);
    piece.glow = seatSpans(score.notes, score.seats.length);
    piece.poses = createScenePose(plan);
    this.#scene.show(prepared);
    // The player counts of the seat rows change with the section size (design 2.8).
    this.#showSeats(piece);
    this.#ui.seatList.update(piece.flags, piece.audible);
    // The build stops the frames, so the automatic tier starts a new window (design 2.6).
    this.#tierWatch = watchTier(this.#tierWatch.tier);
    this.#changeCamera('new-piece');
  }

  /**
   * Follows the pointers on the stage: a drag of more than 4 px, a pinch, or a wheel changes the
   * camera to Free mode (design 2.5). A click on the stage does nothing.
   *
   * @param canvas The canvas of the stage.
   */
  #listenForMotion(canvas: HTMLCanvasElement): void {
    /** The press of each pointer that is down on the stage. */
    const presses = new Map<number, PointerPoint>();
    canvas.addEventListener('pointerdown', (event) => {
      presses.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    });
    canvas.addEventListener('pointermove', (event) => {
      const press = presses.get(event.pointerId);
      if (!press) {
        return;
      }
      const motion = motionEvent(press, { x: event.offsetX, y: event.offsetY }, presses.size);
      if (motion) {
        this.#changeCamera(motion);
      }
    });
    canvas.addEventListener('pointerup', (event) => {
      presses.delete(event.pointerId);
    });
    canvas.addEventListener('pointercancel', (event) => {
      presses.delete(event.pointerId);
    });
    canvas.addEventListener(
      'wheel',
      () => {
        this.#changeCamera('wheel');
      },
      { passive: true },
    );
  }

  /**
   * Changes the camera mode after an event (design 2.5). Each change to Cinematic mode closes the
   * drawer, so that the film starts with no panel (design 2.3). A change back to Free mode does
   * not open it again, so that a drag does not make a panel jump into view.
   *
   * @param event The event.
   */
  #changeCamera(event: CameraEvent): void {
    if (event !== 'click') {
      this.#seatView = null;
    }
    const mode = nextMode(this.#cameraMode, event);
    if (mode === 'cinematic' && this.#cameraMode === 'free') {
      this.#ui.closeDrawer();
    }
    this.#cameraMode = mode;
  }

  /**
   * Puts the camera on a choice of the camera menu (design 2.5): the shots of the director, the
   * free camera, or the held view of one seat, which shows in Cinematic mode.
   *
   * @param choice The choice.
   */
  #chooseCamera(choice: CameraChoice): void {
    if (choice.kind === 'free') {
      this.#changeCamera('reset');
      return;
    }
    if (this.#cameraMode === 'free') {
      this.#changeCamera('toggle');
    }
    this.#seatView = choice.kind === 'seat' ? choice.seat : null;
  }

  /** The song time of the last frame, and the song length, for the tab "Video" (design 2.9). */
  get songPosition(): { readonly songSec: number; readonly durationSec: number } | null {
    const piece = this.#piece;
    return piece ? { songSec: this.#songTime, durationSec: piece.score.durationSec } : null;
  }

  /**
   * Renders the current piece as a video file offline (design 2.9): the sound with the hall, and
   * each frame at a fixed time step with the camera of the camera menu. The page pauses, and it
   * draws no frame of its own until the end.
   *
   * @param request The options.
   * @param onProgress Gets the progress of each part.
   * @param signal The signal of a cancel.
   * @returns The MP4 file.
   * @throws Error with no piece, or when the browser cannot encode the video.
   */
  async exportVideo(
    request: ExportRequest,
    onProgress: ExportProgress,
    signal: AbortSignal,
  ): Promise<Blob> {
    const piece = this.#piece;
    if (!piece) {
      throw new Error('Choose a piece first.');
    }
    if (this.#state.transport.playing) {
      this.#pause();
    }
    const durationSec = piece.score.durationSec;
    const startSec = Math.max(0, Math.min(request.startSec, Math.max(0, durationSec - 1)));
    const endSec =
      request.lengthSec === null ? durationSec : Math.min(durationSec, startSec + request.lengthSec);
    const lengthSec = endSec - startSec + request.tailSec;
    const { width, height, fps, fullFrame } = request;
    const exporter = await import('./video-export.ts');
    const sound = request.sound
      ? await exporter.renderSound({
          score: piece.score,
          mix: piece.mix,
          gainDb: pieceGainDb(piece.file, this.#mix),
          mixName: this.#mix,
          audible: piece.audible,
          startSec,
          lengthSec,
          baseUrl: new URL(import.meta.env.BASE_URL, window.location.href),
          onProgress,
          signal,
        })
      : null;

    // The players hold their instruments up at the first frame, and lower them at the song end.
    const play = changeTransport(
      NOT_STARTED,
      true,
      startSec - EXPORT_LEAD_SEC,
      startSec,
      EXPORT_LEAD_SEC,
    );
    const stop = changeTransport(play, false, durationSec, durationSec);
    const audibility = piece.audible.map((audible): SeatAudibility | undefined =>
      audible ? undefined : { audible, changedAtWall: -Infinity, before: null },
    );
    const choice = this.#cameraChoice;
    const shots =
      choice.kind === 'seat' ? (seatViewPlan(piece.shots, choice.seat) ?? piece.shots) : piece.shots;
    const view = { aspect: fullFrame ? width / height : CINEMA_ASPECT, still: false };
    const clockMs = performance.now() + 60_000;
    const renderFrame = (frame: number): void => {
      const t = startSec + frame / fps;
      const transport = t >= durationSec ? stop : play;
      this.#scene.pose(poseAt(piece.plan, t, t, transport, audibility, piece.poses));
      this.#scene.solo(piece.flags);
      const shot =
        choice.kind === 'free' ? null : cameraAt(shots, t, transport, view, this.#shotCamera);
      this.#scene.render(shot, { right: 0, lift: 0 }, null, {
        nowMs: clockMs + (frame * 1000) / fps,
        fullFrame,
      });
    };

    this.#exporting = true;
    try {
      this.#scene.resizeExact(width, height);
      // The first render takes each glide of the view to its end, from the frame of the page.
      renderFrame(0);
      return await exporter.encodeVideo({
        width,
        height,
        fps,
        frames: Math.max(1, Math.round(lengthSec * fps)),
        canvas: this.#canvas,
        renderFrame,
        sound,
        onProgress,
        signal,
      });
    } finally {
      this.#exporting = false;
      this.#scene.endOwnClock();
      this.#scene.resize(this.#canvas.clientWidth, this.#canvas.clientHeight, window.devicePixelRatio);
    }
  }

  /**
   * Runs a video export from the tab "Video", shows its progress there, and downloads the file
   * at its end (design 2.9).
   *
   * @param form The choices of the panel.
   */
  async #startExport(form: ExportForm): Promise<void> {
    const piece = this.#piece;
    const panel = this.#ui.video;
    if (this.#exportAbort) {
      return;
    }
    if (!piece) {
      panel.showExport(false, 'Choose a piece first.', null);
      return;
    }
    const { exportSupported } = await import('./video-export.ts');
    if (!exportSupported()) {
      panel.showExport(false, 'This browser has no WebCodecs encoder. Try Chrome or Edge.', null);
      return;
    }
    const abort = new AbortController();
    this.#exportAbort = abort;
    const startSec = form.fromHere ? this.#songTime : 0;
    const shares = form.sound
      ? { samples: [0, 0.05], sound: [0.05, 0.3], picture: [0.3, 0.99], file: [0.99, 1] }
      : { samples: [0, 0], sound: [0, 0], picture: [0, 0.99], file: [0.99, 1] };
    const begun = performance.now();
    let pictureAt: number | null = null;
    const onProgress: ExportProgress = (stage, done, total) => {
      const [from = 0, to = 1] = shares[stage];
      const part = total > 0 ? done / total : 1;
      let text = 'Writing the file';
      if (stage === 'samples') {
        text = `Loading the samples: ${done} of ${total} files`;
      } else if (stage === 'sound') {
        text = `Rendering the sound: ${Math.round(part * 100)} %`;
      } else if (stage === 'picture') {
        pictureAt ??= performance.now();
        const rate = (done / Math.max(1, performance.now() - pictureAt)) * 1000;
        const left = rate > 0 ? Math.round((total - done) / rate) : 0;
        text = `Rendering frame ${done} of ${total}: ${rate.toFixed(1)} frames a second, ${Math.floor(left / 60)} min ${left % 60} s left`;
      }
      panel.showExport(true, text, from + (to - from) * part);
    };
    panel.showExport(true, 'Starting the export', 0);
    try {
      const blob = await this.exportVideo(
        {
          width: form.width,
          height: form.height,
          fps: form.fps,
          startSec,
          lengthSec: form.lengthSec,
          tailSec: form.tailSec,
          fullFrame: form.fullFrame,
          sound: form.sound,
        },
        onProgress,
        abort.signal,
      );
      const name = `${piece.title.title.replaceAll(/[^\w\- ]+/gu, '').trim().replaceAll(/\s+/gu, '_') || 'pawchestra'}_${form.height}p${form.fps}.mp4`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(link.href);
      }, 60_000);
      const minutes = (performance.now() - begun) / 60_000;
      panel.showExport(
        false,
        `Saved ${name} (${(blob.size / 1e6).toFixed(1)} MB) in ${minutes.toFixed(1)} min.`,
        null,
      );
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      panel.showExport(false, cancelled ? 'The export was cancelled.' : String(error), null);
      if (!cancelled) {
        console.error(error);
      }
    } finally {
      this.#exportAbort = null;
    }
  }

  /** The choice of the camera menu that the camera shows now (design 2.5). */
  get #cameraChoice(): CameraChoice {
    if (this.#cameraMode === 'free') {
      return { kind: 'free' };
    }
    return this.#seatView === null
      ? { kind: 'director' }
      : { kind: 'seat', seat: this.#seatView };
  }

  /** Cinematic or Free (design 2.5). */
  get cameraMode(): CameraMode {
    return this.#cameraMode;
  }

  /** The song time of `Player.now()` in the last frame: 0 until the samples are ready. */
  get songTime(): number {
    return this.#songTime;
  }

  /** True while the transport plays. */
  get playing(): boolean {
    return this.#state.transport.playing;
  }

  /** The pose plan of the current piece, or `null` before the first piece. */
  get plan(): PosePlan | null {
    return this.#piece?.plan ?? null;
  }

  /** The poses of the last frame, or `null` before the first piece. */
  get poses(): ScenePoseBuffer | null {
    return this.#piece?.poses ?? null;
  }

  /**
   * Shows a file on the stage in the rest pose, and loads its samples. The scene of the old piece
   * frees its GPU resources, and the page keeps its renderer. The old piece stops (design 2.2).
   * A selection of the current piece only plays it. A file that does not load keeps the current
   * piece, and the message of 2.8 offers "Try again" (`#failFile()`).
   *
   * @param file The demo, or `perf-60.mid`.
   * @param playWhenReady True if the piece starts when its samples are ready: a selection of the
   *   user. The first screen waits for a click.
   * @returns True if the file shows. False if it did not load, or a later selection replaced it.
   */
  async select(file: StageFile, playWhenReady: boolean): Promise<boolean> {
    const current = this.#piece;
    if (current?.file === file) {
      // A selection of the current demo replaces a failed selection and its message.
      if (this.#failedFile !== null) {
        this.#failedFile = null;
        this.#message = null;
      }
      if (playWhenReady && !this.#state.transport.playing && !current.playWhenReady) {
        this.#clickPlay();
      }
      return true;
    }
    const ticket = ++this.#request;
    if (!current) {
      // Before the first piece, the title names the file at once, also on a slow network.
      this.#showTitle(stageFileTitle(file), true);
    }
    const bytes = await fetchStageFile(file).catch((error: Error) => {
      if (ticket === this.#request) {
        this.#failFile(file, error);
      }
      return null;
    });
    if (!bytes || ticket !== this.#request) {
      return false;
    }
    if (current) {
      // The build of the new scene stops the frames, so the stage fades out first (PF1).
      await this.#ui.coverStage();
      if (ticket !== this.#request) {
        this.#ui.uncoverStage();
        return false;
      }
    }
    const sectionSize = sectionSizeOf(file, this.#sectionSize);
    // The new piece replaces a build of the section size of the current piece.
    this.#rebuilds++;
    const built = await this.#build(planFileSteps(bytes, sectionSize, file), () => {
      return ticket === this.#request;
    });
    if (!built) {
      // A later selection replaced the build. The stage shows the current piece again.
      if (current) {
        this.#ui.uncoverStage();
      }
      return false;
    }
    const { score, scene, prepared } = built;
    const title = stageFileTitle(file);
    const piece = preparePiece(
      { file, title, bytes, score },
      scene,
      playWhenReady || this.#playWhenShown,
    );
    this.#showPiece(piece, prepared);
    if (current) {
      this.#ui.uncoverStage();
    }
    this.#followSectionSize(piece, sectionSize);
    return true;
  }

  /**
   * Builds the score, the plans, and the 3D scene of a file in slices of the main thread (design
   * 7.2), after the build before it.
   *
   * @param planned The steps of the score and its plans.
   * @param live Tells if the result is still needed.
   * @returns The score, its scene, and its 3D scene, or `null` if a later selection replaced it.
   */
  async #build(planned: Steps<PlannedScore>, live: () => boolean): Promise<BuiltScore | null> {
    const before = this.#lastBuild;
    const scene = this.#scene;
    const steps = (function* (): Steps<BuiltScore> {
      const { score, scene: plans } = yield* planned;
      // The first call of the pose code is slower, so it runs in a step before the first frame.
      poseAt(plans.plan, 0, 0, STOPPED.transport, [], createScenePose(plans.plan));
      yield;
      const prepared = yield* scene.prepareSteps(plans.layout, plans.models);
      return { score, scene: plans, prepared };
    })();
    const run = before.then(async () => runSliced(steps, live));
    this.#lastBuild = run.catch(() => null);
    return run;
  }

  /**
   * Selects a demo for the user: a row of the demo list, or "Try again" after its file did not
   * load. The piece starts when its samples are ready (design 2.2). The URL hash names the demo
   * only after its file loads, so that a reload does not open a demo that did not show.
   *
   * @param file The demo, or `perf-60.mid`.
   */
  #selectDemo(file: StageFile): void {
    // A selection is a clear wish to listen (design 2.2).
    this.#audio?.resume();
    this.select(file, true)
      .then((shown) => {
        // The hash opens the demo again after a reload. It adds no entry to the history.
        if (shown && isDemoId(file)) {
          history.replaceState(history.state, '', demoHash(file));
        }
      })
      .catch(reportError);
  }

  /**
   * Records a demo file that did not load, and shows the message with "Try again" (design 2.8).
   * The current piece stays. Before the first piece, the title names the demo (`select()`), and
   * the play buttons load the file again.
   *
   * @param file The demo, or `perf-60.mid`.
   * @param error The error of the fetch.
   */
  #failFile(file: StageFile, error: Error): void {
    console.error(error);
    this.#failedFile = file;
    this.#message = failureMessage('file', performance.now() / 1000);
  }

  /**
   * Shows a file that the user selected or dropped, and plays it when its samples are ready
   * (design 2.1, 2.2). A file that the rules of 3.3 refuse keeps the current piece, and the page
   * shows the message of 2.8. It also keeps a demo that still loads. A selection while the page
   * reads the file replaces the file.
   *
   * @param file The file.
   */
  async openFile(file: File): Promise<void> {
    const before = this.#request;
    const sectionSize = this.#sectionSize;
    const result = await readScoreFile(file, sectionSize);
    if (before !== this.#request) {
      return;
    }
    if (!result.ok) {
      this.#showMessage(FILE_ERROR_TEXTS[result.error]);
      return;
    }
    const ticket = ++this.#request;
    // An accepted file closes the sheet of a phone, so that the new piece shows. A refused file
    // keeps it, so that the user can select another file (design 2.8).
    this.#ui.closeSheetAfterSelection();
    const covered = this.#piece !== null;
    if (covered) {
      // The build of the new scene stops the frames, so the stage fades out first (PF1).
      await this.#ui.coverStage();
      if (ticket !== this.#request) {
        this.#ui.uncoverStage();
        return;
      }
    }
    const { bytes } = result;
    // The section size can change while the page reads the file.
    const size = this.#sectionSize;
    // The new piece replaces a build of the section size of the current piece.
    this.#rebuilds++;
    const built = await this.#build(
      sectionSize === size ? planScoreSteps(result.score) : planFileSteps(bytes, size, file.name),
      () => ticket === this.#request,
    );
    if (!built) {
      // A later selection replaced the build. The stage shows the current piece again.
      if (covered) {
        this.#ui.uncoverStage();
      }
      return;
    }
    const { score, scene, prepared } = built;
    const title = fileTitle(score.sequenceName, file.name);
    const piece = preparePiece({ file: null, title, bytes, score }, scene, true);
    this.#showPiece(piece, prepared);
    if (covered) {
      this.#ui.uncoverStage();
    }
    this.#followSectionSize(piece, size);
  }

  /**
   * Builds the scene of a new piece again when the setting "Section size" changed during its
   * build (design 3.8). The build used the size of its start.
   *
   * @param piece The new piece.
   * @param built The section size of its build.
   */
  #followSectionSize(piece: Piece, built: SectionSize): void {
    if (piece.file === PERF_60 || built === this.#sectionSize) {
      return;
    }
    const size = this.#sectionSize;
    this.#sectionSize = built;
    this.#setSectionSize(size);
  }

  /**
   * Replaces the current piece with a new one: it stops the old piece, shows the new scene and
   * title, and loads the samples of the new score (design 2.2).
   *
   * @param piece The new piece.
   * @param prepared The 3D scene of its layout.
   */
  #showPiece(piece: Piece, prepared: PreparedLayout): void {
    if (this.#state.transport.playing) {
      this.#audio?.player.pause();
    }
    this.#state = STOPPED;
    this.#seekSec = null;
    // A message of the old piece does not hold for the new one.
    this.#message = null;
    this.#failedFile = null;
    this.#playWhenShown = false;
    this.#piece = piece;
    this.#scene.show(prepared);
    // The mode stays. Cinematic mode takes the shots of the new score (design 2.5).
    this.#changeCamera('new-piece');
    const demo = piece.file !== null && isDemoId(piece.file) ? piece.file : null;
    this.#showTitle(piece.title, piece.file !== null);
    this.#ui.demoList.show(demo);
    this.#ui.credits.show(demo);
    this.#showSeats(piece);
    // The button "Auto" of the section size names the size of the new piece (design 2.8).
    this.#applySettings();
    this.#loadAudio(piece);
    // The screenshot script (tools/screenshots.ts) waits for this attribute. A file of the user
    // has the value `file`.
    this.#canvas.dataset['demo'] = piece.file ?? 'file';
  }

  /**
   * Shows the title of a piece at the top left and in the title of the page (design 2.8).
   *
   * @param lines The title lines.
   * @param stageFile True for a demo or `perf-60.mid`, false for a file of the user.
   */
  #showTitle(lines: TitleLines, stageFile: boolean): void {
    this.#ui.title.show(lines.title, lines.composer);
    document.title = pageTitle(lines, stageFile);
  }

  /**
   * Shows the seat rows of a piece, with the players of its scene (design 2.8).
   *
   * @param piece The piece.
   */
  #showSeats(piece: Piece): void {
    const { seats, soloist } = piece.score;
    const counts = playerCounts(piece.plan.players, seats.length);
    const rows = seatRows(seats, counts, soloist);
    this.#ui.seatList.show(rows);
    this.#ui.video.showSeats(
      rows.flatMap((row, seat) =>
        piece.shots.seatViews?.[seat] ? [{ seat, name: row.name, animals: row.animals }] : [],
      ),
    );
  }

  /**
   * Toggles the mute or the solo button of a seat (design 6.6). The seats that change get the new
   * value in the `Player` and in the poses. While the samples load, the `Player` gets the silent
   * seats when they are ready (`#sendSilentSeats()`).
   *
   * @param seatIndex The seat.
   * @param flag The button.
   */
  #toggleSeat(seatIndex: number, flag: SeatFlag): void {
    const piece = this.#piece;
    if (!piece) {
      return;
    }
    piece.flags = toggleSeatFlag(piece.flags, seatIndex, flag);
    const audible = seatsAudible(piece.flags, piece.score.seats.length);
    const changed = changedSeats(piece.audible, audible);
    piece.audibility = followAudibility(piece.audibility, audible, performance.now() / 1000);
    piece.audible = audible;
    this.#ui.seatList.update(piece.flags, audible);
    const player = this.#audio?.player;
    if (player && piece.samples === 'ready') {
      for (const i of changed) {
        player.setSeatAudible(i, audible[i] ?? true);
      }
    }
  }

  /**
   * Sends the silent seats of a piece to the `Player` after its samples load. A load resets the
   * seat flags of the `Player`, and a flag before the load has no effect on the new score
   * (design 6.6, 6.8).
   *
   * @param piece The piece with its samples ready.
   */
  #sendSilentSeats(piece: Piece): void {
    const player = this.#audio?.player;
    for (const [i, audible] of piece.audible.entries()) {
      if (!audible) {
        player?.setSeatAudible(i, false);
      }
    }
  }

  /**
   * Shows a message with no button to the user, for example the refusal of a file (design 2.8,
   * 3.3). It replaces the message that shows.
   *
   * @param text The message text of design 2.8.
   */
  #showMessage(text: string): void {
    this.#message = textMessage(text, performance.now() / 1000);
  }

  /**
   * Tells if a frame of the browser draws under the setting "Frame rate" (design 2.6), and keeps
   * the times of the drawn frames for the counter of the settings.
   *
   * @param nowMs The time of the frame of the browser, in milliseconds.
   * @returns True if the frame draws.
   */
  frameDue(nowMs: number): boolean {
    if (this.#exporting) {
      return false;
    }
    const due = frameDue(nowMs, this.#lastDrawMs, this.#frameRate);
    if (due === null) {
      return false;
    }
    this.#lastDrawMs = due;
    const times = this.#drawTimes;
    times.push(nowMs);
    while ((times[0] ?? nowMs) <= nowMs - FPS_WINDOW_MS) {
      times.shift();
    }
    return true;
  }

  /**
   * Poses the players from the song time of the `Player`, updates the UI, and renders the scene
   * (design 5.1). Until the samples of the piece are ready, the song time is 0 and the players
   * keep the rest pose. In Cinematic mode, the camera of the shot of the song time shows (5.6).
   */
  frame(): void {
    const wallTime = performance.now() / 1000;
    // The probe takes a finished read before the commands of the render (BackdropProbe).
    const shade = this.#backdrop.collect(() => this.#ui.title.lines);
    const piece = this.#piece;
    let shot: CameraPose | null = null;
    if (piece) {
      // After a failure, the clock of the `Player` stays at the song time of the failure (6.8).
      const audio = this.#audio;
      this.#songTime = audio && piece.samples !== 'loading' ? audio.player.now() : 0;
      this.#seekSec = followSeek(this.#seekSec, this.#songTime);
      // The processor pauses at the song end (design 6.5).
      this.#state = followSongTime(this.#state, this.#songTime, piece.score.durationSec, wallTime);
      const transport = this.#state.transport;
      const { plan, audibility, poses } = piece;
      this.#scene.pose(poseAt(plan, this.#songTime, wallTime, transport, audibility, poses));
      // The key light moves to the soloed seats (design 2.4, 4.5).
      this.#scene.solo(piece.flags);
      if (this.#cameraMode === 'cinematic') {
        // The shots fill the letterbox of the aspect 21:9 in each viewport. With reduced motion,
        // each shot holds its first camera, and each cut is hard (2.5).
        const view = { aspect: CINEMA_ASPECT, still: this.#scene.reducedMotion };
        const seatPlan = this.#seatView === null ? null : seatViewPlan(piece.shots, this.#seatView);
        // The held view of a seat shows also before the first play (the camera menu, 2.5).
        shot = seatPlan
          ? cameraAt(
              seatPlan,
              this.#songTime,
              { ...transport, changedAtWall: transport.changedAtWall ?? 0 },
              view,
              this.#shotCamera,
            )
          : cameraAt(piece.shots, this.#songTime, transport, view, this.#shotCamera);
      }
    }
    this.#followTier(wallTime);
    this.#updateUi(wallTime);
    const drawer = this.#ui.drawer;
    const cover = stageCover({
      phone: this.#phone.matches,
      drawerOpen: drawer.open,
      height: this.#canvas.clientHeight,
    });
    // The sheet of a phone covers the first screen, so the stage does not need to clear it.
    const ring = this.#phone.matches && drawer.open ? null : this.#ui.firstScreen.ringBox;
    this.#scene.render(shot, cover, ring);
    this.#ui.showLetterbox(this.#scene.letterboxBar, this.#scene.letterboxSide);
    this.#followShade(wallTime, shade);
    this.#showFrame();
    if (piece && !this.#audioStarted) {
      this.#audioStarted = true;
      this.#startAudio().catch((error: Error) => {
        this.#fail(piece, error, 'load');
      });
    }
  }

  /**
   * Starts a read of the frame behind the title directly after the render, and shows the shade of
   * each title line at the level that its text needs (design 2.8). A shade comes in at once and
   * goes out slowly.
   *
   * @param wallTime The wall time of the frame, in seconds.
   * @param needed The level of each line from a read that finished at the start of the frame, or
   *   `null` when no read finished.
   */
  #followShade(wallTime: number, needed: readonly number[] | null): void {
    const title = this.#ui.title;
    this.#backdrop.request(wallTime, () => title.lines);
    if (needed !== null) {
      this.#shadeNeeded = needed;
    }

    const elapsed = wallTime - this.#shadeAt;
    this.#shadeLevels = this.#shadeNeeded.map((level, i) =>
      nextShadeLevel(this.#shadeLevels[i] ?? 0, level, elapsed),
    );
    this.#shadeAt = wallTime;
    title.showShade(this.#shadeLevels);
  }

  /**
   * Writes the frame of the camera on the canvas into the attribute `data-frame` of the canvas:
   * its middle and its scale. The end-to-end tests read it on the built site (design 9.3).
   */
  #showFrame(): void {
    const frame = this.#scene.frame;
    if (!frame) {
      return;
    }
    const text = `${Math.round(frame.x)} ${Math.round(frame.y)} ${frame.scale.toFixed(3)}`;
    if (this.#canvas.dataset['frame'] !== text) {
      this.#canvas.dataset['frame'] = text;
    }
  }

  /**
   * Measures the frame for the automatic tier, and drops the tier of the renderer when the frames
   * are slow (design 2.6). It measures only while the music plays, the tab is visible, and the
   * quality setting is "Auto".
   *
   * @param wallTime The wall time of the frame, in seconds.
   */
  #followTier(wallTime: number): void {
    const measuring =
      this.#quality === 'auto' &&
      this.#state.transport.playing &&
      document.visibilityState === 'visible';
    const before = this.#tierWatch.tier;
    this.#tierWatch = followFrame(this.#tierWatch, wallTime, measuring);
    if (this.#tierWatch.tier !== before) {
      this.#applySettings();
    }
  }

  /**
   * Shows the state of the frame in the UI.
   *
   * @param wallTime The wall time of the frame, in seconds.
   */
  #updateUi(wallTime: number): void {
    const piece = this.#piece;
    const ui = this.#ui;
    const status = piece
      ? { ...piece, playing: this.#state.transport.playing }
      : noPieceStatus(this.#failedFile !== null, this.#playWhenShown);
    const loadSec = piece ? wallTime - piece.loadStartSec : 0;
    ui.firstScreen.update(
      firstScreenView(
        status,
        piece?.progress ?? null,
        piece !== null,
        this.#sessionPlayed,
        loadSec,
      ),
    );
    const songSec = shownSongTime(this.#seekSec, this.#songTime);
    const ended = piece !== null && atSongEnd(status, songSec, piece.score.durationSec);
    // In Cinematic mode during play, all controls and panels hide together (design 2.3). Only
    // that rule reads the panels, so Free mode skips their query of the focus in each frame.
    const cinematic = this.#cameraMode === 'cinematic';
    const shown = uiShown({
      cinematic,
      playing: status.playing,
      idleSec: wallTime - this.#activeAt,
      focused: ui.bar.focused,
      hovered: ui.bar.hovered,
      drawerOpen: ui.drawer.open,
      panelFocused: cinematic && ui.panelFocused,
      panelHovered: cinematic && ui.panelHovered,
      held: this.#message !== null || ui.creditsDialog.open,
    });
    ui.showPanels(shown.panels);
    ui.video.showCamera(this.#cameraChoice);
    ui.bar.update({
      playLabel: ended ? 'Play again' : playLabel(status),
      pieceShown: piece !== null,
      songSec,
      lengthSec: piece ? wholeSeconds(piece.score.durationSec) : 0,
      seekable: status.samples === 'ready',
      muted: this.#muted || this.#volume === 0,
      volume: this.#volume,
      cinematicCamera: this.#cameraMode === 'cinematic',
      fullScreen: document.fullscreenElement !== null,
      drawerOpen: ui.drawer.open,
      shown: shown.bar,
    });
    // The counter of the settings changes two times each second, so that it stays readable.
    if (ui.drawer.open && wallTime - this.#fpsShownAt >= FPS_COUNTER_SEC) {
      this.#fpsShownAt = wallTime;
      ui.settings.showFrameRate(measuredFrameRate(this.#drawTimes));
    }
    if (piece) {
      const started = status.playing || songSec > 0;
      ui.demoList.showLevels(meterLevels(piece.meter, songSec, this.#meterLevels), started);
      if (this.#seatLevels.length !== piece.score.seats.length) {
        this.#seatLevels = new Float32Array(piece.score.seats.length);
      }
      // A play reads the song time 0 for a frame before its count-in, and the song time stops at
      // the last note-off. Thus the dots show only between the start and the end of the piece, so
      // that the first notes do not flash and the last notes do not stay.
      ui.seatList.showLevels(
        seatLevels(piece.glow, songSec, piece.audible, this.#seatLevels),
        songSec > 0 && songSec < piece.score.durationSec,
      );
    }
    this.#message = followMessage(this.#message, wallTime, ui.message.held);
    ui.message.update(this.#message);
    // The smoke test and the screenshot script wait for this attribute (`SAMPLES_READY`).
    if (document.body.dataset['samples'] !== status.samples) {
      document.body.dataset['samples'] = status.samples;
    }
    // The smoke test reads the song time here on the built site, which has no dev hook (9.3).
    const songTime = songTimeValue(this.#songTime);
    if (this.#canvas.dataset['songTime'] !== songTime) {
      this.#canvas.dataset['songTime'] = songTime;
    }
  }

  /**
   * Does the action of a click on play (design 2.4). Before the first piece, a click loads the
   * demo file again after it did not load. Else it waits for the first piece, and a second click
   * cancels the wait (design 2.2).
   */
  #clickPlay(): void {
    const piece = this.#piece;
    if (!piece) {
      if (this.#failedFile !== null) {
        this.#selectDemo(this.#failedFile);
      } else {
        this.#playWhenShown = !this.#playWhenShown;
      }
      return;
    }
    const action = playAction({ ...piece, playing: this.#state.transport.playing });
    switch (action) {
      case 'play':
        this.#play(piece);
        break;
      case 'pause':
        this.#pause();
        break;
      case 'wait':
        piece.playWhenReady = true;
        this.#audio?.resume();
        break;
      case 'cancel':
        piece.playWhenReady = false;
        break;
      case 'retry':
        this.#retry(piece);
        break;
    }
  }

  /**
   * Plays the piece, and records the change in the transport of the pose. A play starts the
   * count-in from the start point (design 5.4, 6.5): the seek point that the listener does not
   * hear yet, else the song time of the `Player`.
   *
   * @param piece The current piece, with its samples ready.
   */
  #play(piece: Piece): void {
    const audio = this.#audio;
    if (!audio || piece.samples !== 'ready') {
      return;
    }
    const from = shownSongTime(this.#seekSec, audio.player.now());
    const wallTime = performance.now() / 1000;
    const { durationSec } = piece.score;
    const start = startPlay(
      this.#state,
      from,
      durationSec,
      piece.plan.beats,
      wallTime,
      this.#speed,
    );
    audio.player.play(start.countInSec);
    this.#state = start.state;
    piece.played = true;
    piece.playWhenReady = false;
    this.#sessionPlayed = true;
  }

  /** Pauses the piece. A pause in the count-in goes back to the start point and the rest pose. */
  #pause(): void {
    const audio = this.#audio;
    if (!audio) {
      return;
    }
    const now = audio.player.now();
    audio.player.pause();
    this.#state = setPlaying(this.#state, false, performance.now() / 1000, now);
  }

  /**
   * Seeks the piece (design 6.5). A seek during play ends the count-in.
   *
   * @param songSec The seek point, in song seconds.
   */
  #seek(songSec: number): void {
    const piece = this.#piece;
    const audio = this.#audio;
    if (!piece || !audio || piece.samples !== 'ready') {
      return;
    }
    const point = Math.min(Math.max(0, songSec), piece.score.durationSec);
    audio.player.seek(point);
    this.#seekSec = point;
    this.#state = seekPlayState(this.#state, point);
  }

  /**
   * Moves the volume slider (design 2.8): the slider and the up and the down arrow keys. A move of
   * the volume turns the mute button off.
   *
   * @param volume The new position of the volume slider, from 0 to 100.
   */
  #setVolume(volume: number): void {
    this.#volume = volume;
    this.#muted = false;
    this.#applyVolume();
  }

  /** Turns the mute button on or off (design 2.8): the mute button and the key M. */
  #toggleMute(): void {
    this.#muted = !this.#muted;
    this.#applyVolume();
  }

  /** Sends the gain of the volume slider and the mute button to the `Player`. */
  #applyVolume(): void {
    this.#audio?.player.setVolume(volumeGain(this.#volume, this.#muted));
  }

  /**
   * Pauses the transport after a failure, and offers a retry on the play buttons and in the message
   * of the failure (design 2.8). The console gets the error.
   *
   * @param failed The piece whose audio failed.
   * @param error The error.
   * @param failure `load` for the audio module or the samples, `play` for a later failure.
   */
  #fail(failed: Piece, error: Error, failure: Failure): void {
    console.error(error);
    failed.samples = 'failed';
    failed.playWhenReady = false;
    if (failed === this.#piece) {
      const wallTime = performance.now() / 1000;
      this.#state = setPlaying(this.#state, false, wallTime, this.#songTime);
      this.#seekSec = null;
      this.#message = failureMessage(failure, wallTime);
      // "Try again" of this message retries the audio, not an earlier failed demo file.
      this.#failedFile = null;
    }
  }

  /**
   * Loads the samples of a piece into the `Player`. The piece starts when its samples are ready
   * and its `playWhenReady` is true (design 2.2).
   *
   * @param loading The piece.
   */
  #loadAudio(loading: Piece): void {
    const audio = this.#audio;
    if (!audio) {
      return;
    }
    const gainDb = pieceGainDb(loading.file, this.#mix);
    const score = { ...loading.score, mix: loading.mix, gainDb };
    loading.loadStartSec = performance.now() / 1000;
    audio.player
      .load(score, (progress) => {
        loading.progress = progress;
      })
      .then(() => {
        loading.samples = 'ready';
        this.#sendSilentSeats(loading);
        if (loading === this.#piece && loading.playWhenReady) {
          this.#play(loading);
        }
      })
      .catch((error: Error) => {
        // The app ignores a load that a later selection replaced (design 6.8).
        if (!audio.replaced(error)) {
          this.#fail(loading, error, 'load');
        }
      });
  }

  /**
   * Starts the audio module again, or loads the samples again, after a failure. A click on play
   * asks for it, so the piece starts when its samples are ready.
   *
   * @param failed The piece whose audio failed.
   */
  #retry(failed: Piece): void {
    // The play button and the message both offer the retry. The message of the failure closes.
    this.#message = null;
    failed.samples = 'loading';
    failed.progress = null;
    failed.playWhenReady = true;
    if (this.#audio) {
      this.#audio.resume();
      this.#loadAudio(failed);
    } else {
      this.#startAudio().catch((error: Error) => {
        this.#fail(failed, error, 'load');
      });
    }
  }

  /**
   * Loads the audio module after the first frame of the scene (design 6.3, 7.2), creates the
   * `Player` with the speed and the volume of the bar, and loads the samples of the current
   * piece before the first click.
   */
  async #startAudio(): Promise<void> {
    const { LoadReplacedError, WorkletPlayer } = await import('../audio/player.ts');
    // With the audio service started, the `AudioContext` does not block the main thread.
    await this.#audioOutput;
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    // On iOS, the music plays with the silent switch on (design 2.4).
    playWithSilentSwitch(navigator);
    // A failure during play pauses the transport, so that the animals do not play with no sound.
    // The next load starts a new engine (design 6.8).
    const player = new WorkletPlayer(
      baseUrl,
      (error) => {
        if (this.#piece) {
          this.#fail(this.#piece, error, 'play');
        }
      },
      this.#mix,
    );
    player.setRate(this.#speed);
    player.setVolume(volumeGain(this.#volume, this.#muted));
    this.#audio = {
      player,
      replaced: (error) => error instanceof LoadReplacedError,
      resume: () => {
        // A rejected resume needs no report here: the play after the load resumes again, and
        // `play()` gives a rejection to the error function (design 6.8).
        player.context.resume().catch(() => undefined);
      },
    };
    if (this.#piece) {
      this.#loadAudio(this.#piece);
    }
  }
}

/** Enters or leaves the full screen of the page. */
function toggleFullScreen(): void {
  const change = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  change.catch(reportError);
}
