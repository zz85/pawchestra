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

  /**
   * Creates the panel.
   *
   * @param onCamera The action of a new camera choice.
   */
  constructor(onCamera: (choice: CameraChoice) => void) {
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
