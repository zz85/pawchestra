import { createElement } from './dom.ts';

/**
 * The camera of the stage that the user selects in the camera menu (design 2.5): the shots of
 * the director, the free camera, or the held view of one seat.
 */
export type CameraChoice =
  | { readonly kind: 'director' }
  | { readonly kind: 'free' }
  | { readonly kind: 'seat'; readonly seat: number };

/** One seat in the camera menu: its index, its name, and its animals. */
export interface CameraSeat {
  readonly seat: number;
  readonly name: string;
  readonly animals: string;
}

/** The choices of the export group of the panel (design 2.9). */
export interface ExportForm {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** True to start at the current song time, false at the song start. */
  readonly fromHere: boolean;
  /** The length of the music, in seconds, or `null` for all of it. */
  readonly lengthSec: number | null;
  readonly tailSec: number;
  readonly fullFrame: boolean;
  readonly sound: boolean;
}

/** The actions of the panel. */
export interface VideoPanelActions {
  readonly onCamera: (choice: CameraChoice) => void;
  readonly onExport: (form: ExportForm) => void;
  readonly onCancelExport: () => void;
}

/**
 * Creates a select element with its options.
 *
 * @param label The `aria-label`.
 * @param options The value and the text of each option.
 * @param selected The value of the selected option.
 * @returns The element.
 */
function createSelect(
  label: string,
  options: readonly (readonly [value: string, text: string])[],
  selected: string,
): HTMLSelectElement {
  const select = createElement('select', 'panel-select');
  select.setAttribute('aria-label', label);
  for (const [value, text] of options) {
    const option = createElement('option', '', text);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  return select;
}

/** The value of the option of a choice in the select element. */
function optionValue(choice: CameraChoice): string {
  return choice.kind === 'seat' ? `seat:${choice.seat}` : choice.kind;
}

/**
 * Reads a choice from the value of an option.
 *
 * @param value The value, from {@link optionValue}.
 * @returns The choice.
 */
function choiceOf(value: string): CameraChoice {
  if (value.startsWith('seat:')) {
    return { kind: 'seat', seat: Number(value.slice(5)) };
  }
  return value === 'free' ? { kind: 'free' } : { kind: 'director' };
}

/**
 * Creates the group of one setting of the panel: its label, its control, and a dim line.
 *
 * @param label The label.
 * @param control The control.
 * @param help The dim line.
 * @returns The group.
 */
export function createPanelGroup(label: string, control: HTMLElement, help: string): HTMLElement {
  const head = createElement('div', 'setting-head');
  head.append(createElement('span', 'setting-label', label));
  const group = createElement('div', 'setting');
  group.append(head, control, createElement('p', 'setting-help', help));
  return group;
}

/**
 * The tab "Video" of the drawer: the camera menu, which puts the camera on the shots of the
 * director, on the free camera, or on one instrument (design 2.5).
 */
export class VideoPanel {
  readonly element: HTMLElement;
  readonly #camera: HTMLSelectElement;
  readonly #seats: HTMLOptGroupElement;
  readonly #size = createSelect(
    'Resolution',
    [
      ['1280x720', '720p (1280 x 720)'],
      ['1920x1080', '1080p (1920 x 1080)'],
      ['2560x1440', '1440p (2560 x 1440)'],
      ['3840x2160', '4K (3840 x 2160)'],
      ['1080x1920', 'Vertical 1080 x 1920'],
    ],
    '1920x1080',
  );
  readonly #fps = createSelect(
    'Frame rate',
    [
      ['24', '24 fps'],
      ['30', '30 fps'],
      ['60', '60 fps'],
    ],
    '30',
  );
  readonly #start = createSelect(
    'Start',
    [
      ['start', 'From the start of the piece'],
      ['here', 'From the current position'],
    ],
    'start',
  );
  readonly #length = createSelect(
    'Duration',
    [
      ['all', 'To the end of the piece'],
      ['15', '15 s'],
      ['30', '30 s'],
      ['60', '1 min'],
      ['120', '2 min'],
      ['300', '5 min'],
    ],
    'all',
  );
  readonly #tail = createSelect(
    'Tail',
    [
      ['0', 'No tail'],
      ['2', '2 s'],
      ['4', '4 s'],
      ['8', '8 s'],
    ],
    '2',
  );
  readonly #frame = createSelect(
    'Picture',
    [
      ['full', 'Full frame'],
      ['cinema', 'Letterbox 21:9, as on the page'],
    ],
    'full',
  );
  readonly #sound = createElement('input');
  readonly #exportButton = createElement('button', 'panel-button', 'Export video');
  readonly #cancelButton = createElement('button', 'panel-button is-secondary', 'Cancel');
  readonly #status = createElement('p', 'setting-help export-status');
  readonly #bar = createElement('progress', 'export-bar');

  /**
   * Creates the panel.
   *
   * @param actions The actions of the controls.
   */
  constructor(actions: VideoPanelActions) {
    const onCamera = actions.onCamera;
    this.element = createElement('div', 'settings video-panel');
    this.#camera = createElement('select', 'panel-select');
    this.#camera.setAttribute('aria-label', 'Camera');
    const director = createElement('option', '', 'Director (cinematic shots)');
    director.value = optionValue({ kind: 'director' });
    const free = createElement('option', '', 'Free camera');
    free.value = optionValue({ kind: 'free' });
    this.#seats = createElement('optgroup');
    this.#seats.label = 'Follow an instrument';
    this.#camera.append(director, free, this.#seats);
    this.#camera.addEventListener('change', () => {
      onCamera(choiceOf(this.#camera.value));
    });
    this.element.append(
      createPanelGroup(
        'Camera',
        this.#camera,
        'Hold the camera on one instrument for the whole piece, or go back to the shots of the director. A drag on the stage gives the free camera.',
      ),
    );

    this.#sound.type = 'checkbox';
    this.#sound.checked = true;
    const soundLine = createElement('label', 'export-check');
    soundLine.append(this.#sound, ' Include the sound, with the hall');
    this.#exportButton.type = 'button';
    this.#cancelButton.type = 'button';
    this.#cancelButton.hidden = true;
    this.#bar.max = 1;
    this.#bar.value = 0;
    this.#bar.hidden = true;
    this.#exportButton.addEventListener('click', () => {
      actions.onExport(this.#form());
    });
    this.#cancelButton.addEventListener('click', () => {
      actions.onCancelExport();
    });
    const field = (label: string, control: HTMLElement): HTMLElement => {
      const line = createElement('label', 'export-field');
      line.append(createElement('span', 'setting-label', label), control);
      return line;
    };
    const fields = createElement('div', 'export-fields');
    const buttons = createElement('div', 'export-buttons');
    buttons.append(this.#exportButton, this.#cancelButton);
    fields.append(
      field('Resolution', this.#size),
      field('Frame rate', this.#fps),
      field('Start', this.#start),
      field('Duration', this.#length),
      field('Tail after the music', this.#tail),
      field('Picture', this.#frame),
      soundLine,
      buttons,
      this.#bar,
      this.#status,
    );
    this.#status.textContent =
      'The camera of the menu above films the video. It renders offline, so each frame is smooth however fast the GPU is.';
    this.element.append(
      createPanelGroup(
        'Export video (MP4)',
        fields,
        'H.264 and AAC with WebCodecs, in Chrome or Edge. The page pauses while it renders.',
      ),
    );
  }

  /** The choices of the export group. */
  #form(): ExportForm {
    const [width = 1920, height = 1080] = this.#size.value.split('x').map(Number);
    return {
      width,
      height,
      fps: Number(this.#fps.value),
      fromHere: this.#start.value === 'here',
      lengthSec: this.#length.value === 'all' ? null : Number(this.#length.value),
      tailSec: Number(this.#tail.value),
      fullFrame: this.#frame.value === 'full',
      sound: this.#sound.checked,
    };
  }

  /**
   * Shows the state of an export.
   *
   * @param running True while an export runs.
   * @param text The status line.
   * @param share The share of the work that is done, from 0 to 1, or `null` for no bar.
   */
  showExport(running: boolean, text: string, share: number | null): void {
    this.#exportButton.disabled = running;
    this.#cancelButton.hidden = !running;
    this.#status.textContent = text;
    this.#bar.hidden = share === null;
    if (share !== null) {
      this.#bar.value = share;
    }
  }

  /**
   * Lists the seats of the current piece in the camera menu.
   *
   * @param seats The seats that have a view.
   */
  showSeats(seats: readonly CameraSeat[]): void {
    this.#seats.replaceChildren(
      ...seats.map((s) => {
        const option = createElement('option', '', s.animals ? `${s.name} (${s.animals})` : s.name);
        option.value = optionValue({ kind: 'seat', seat: s.seat });
        return option;
      }),
    );
  }

  /**
   * Marks the current camera in the menu.
   *
   * @param choice The camera.
   */
  showCamera(choice: CameraChoice): void {
    const value = optionValue(choice);
    if (this.#camera.value !== value) {
      this.#camera.value = value;
    }
  }
}
