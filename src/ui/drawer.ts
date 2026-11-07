import { sheetCloses, sheetOffset } from '../app/phone-layout.ts';
import { createButton, createElement, setAttribute } from './dom.ts';
import { createIcon } from './icons.ts';

/** A tab of the drawer (design 2.8). */
type DrawerTab = 'demos' | 'seats' | 'video' | 'settings';

/** The controls of one tab of the drawer. */
interface TabParts {
  readonly tab: HTMLButtonElement;
  readonly panel: HTMLElement;
}

/**
 * The drawer on the right (design 2.3, 2.8): 340 px wide, with the tabs "Music", "Seats", and
 * "Settings" and a close button at the top. Only the panel of the current tab shows. On a screen
 * narrower than 700 px, it is a sheet above the bar with a drag handle: a drag of the handle down
 * closes the sheet. It starts closed, and it slides and fades in and out in 200 ms.
 */
export class Drawer {
  readonly element: HTMLElement;
  /** The close button at the top of the drawer (design 2.8). */
  readonly closeButton: HTMLButtonElement;
  /** The tab list at the top of the drawer. */
  readonly #tabList: HTMLElement;
  readonly #tabs = new Map<DrawerTab, TabParts>();
  #current: DrawerTab | null = null;
  /** True while the pointer is over the drawer. */
  #hovered = false;

  /**
   * Creates the closed drawer with the drag handle, the close button, and no tabs.
   *
   * @param onClose The action of a click on the close button.
   */
  constructor(onClose: () => void) {
    this.element = createElement('aside', 'drawer');
    this.element.setAttribute('aria-label', 'Drawer');
    this.element.hidden = true;
    this.closeButton = createButton('close-drawer', 'Close the drawer');
    this.closeButton.append(createIcon('close'));
    this.closeButton.addEventListener('click', onClose);
    this.#tabList = createElement('div', 'tab-list');
    this.#tabList.setAttribute('role', 'tablist');
    this.#tabList.setAttribute('aria-label', 'Drawer');
    this.#tabList.addEventListener('keydown', (event) => {
      this.#onTabKey(event);
    });
    const top = createElement('div', 'drawer-top');
    top.append(this.#tabList, this.closeButton);
    this.element.append(this.#createHandle(), top);
    this.element.addEventListener('pointerenter', () => {
      this.#hovered = true;
    });
    this.element.addEventListener('pointerleave', () => {
      this.#hovered = false;
    });
  }

  /**
   * Creates the drag handle of the sheet. Only the phone layout shows it. A screen reader skips
   * it, because the drawer button and the Escape key also close the sheet.
   *
   * @returns The handle.
   */
  #createHandle(): HTMLElement {
    const handle = createElement('div', 'handle');
    handle.setAttribute('aria-hidden', 'true');
    let start: number | null = null;
    const move = (event: PointerEvent): number => event.clientY - (start ?? event.clientY);
    handle.addEventListener('pointerdown', (event) => {
      start = event.clientY;
      handle.setPointerCapture(event.pointerId);
      this.element.classList.add('is-dragged');
    });
    handle.addEventListener('pointermove', (event) => {
      if (start !== null) {
        this.element.style.transform = `translateY(${sheetOffset(move(event))}px)`;
      }
    });
    const end = (event: PointerEvent, cancel: boolean): void => {
      if (start === null) {
        return;
      }
      const closes = !cancel && sheetCloses(move(event), this.element.offsetHeight);
      start = null;
      this.element.classList.remove('is-dragged');
      this.element.style.transform = '';
      if (closes) {
        this.setOpen(false);
      }
    };
    handle.addEventListener('pointerup', (event) => {
      end(event, false);
    });
    handle.addEventListener('pointercancel', (event) => {
      end(event, true);
    });
    return handle;
  }

  /** True while the drawer is open. */
  get open(): boolean {
    return !this.element.hidden;
  }

  /**
   * Opens or closes the drawer. An open drawer moves the stage beside it (design 2.8).
   *
   * @param open True to open it.
   */
  setOpen(open: boolean): void {
    this.element.hidden = !open;
  }

  /** True while an element of the drawer has the keyboard focus. */
  get focused(): boolean {
    return this.element.contains(document.activeElement);
  }

  /**
   * True while a control of the drawer shows the focus of the keyboard (`:focus-visible`). A focus
   * from a click or a tap does not count, so that the drawer still hides during play (design 2.3).
   */
  get focusShown(): boolean {
    return this.element.querySelector(':focus-visible') !== null;
  }

  /** True while the pointer is over the open drawer. */
  get hovered(): boolean {
    return this.#hovered && this.open;
  }

  /** The current tab, or `null` before the first tab. */
  get tab(): DrawerTab | null {
    return this.#current;
  }

  /**
   * Adds a tab and its panel at the end of the drawer. The first tab is the current tab.
   *
   * @param id The tab.
   * @param label The text of the tab, for example "Music".
   * @param content The content of the panel.
   */
  addTab(id: DrawerTab, label: string, ...content: Element[]): void {
    const tab = createButton('tab', '');
    tab.id = `tab-${id}`;
    tab.textContent = label;
    tab.setAttribute('role', 'tab');
    const panel = createElement('div', 'tab-panel');
    panel.id = `panel-${id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', panel.id);
    panel.append(...content);
    tab.addEventListener('click', () => {
      this.showTab(id);
    });
    this.#tabList.append(tab);
    this.element.append(panel);
    this.#tabs.set(id, { tab, panel });
    this.showTab(this.#current ?? id);
  }

  /**
   * Shows the panel of a tab, and hides the other panels. A new tab scrolls its panel and the
   * lists in it to the top.
   *
   * @param id The tab.
   */
  showTab(id: DrawerTab): void {
    const shown = this.#tabs.get(id)?.panel;
    if (id !== this.#current && shown) {
      shown.scrollTop = 0;
      for (const child of shown.children) {
        child.scrollTop = 0;
      }
    }
    this.#current = id;
    for (const [tabId, { tab, panel }] of this.#tabs) {
      const selected = tabId === id;
      setAttribute(tab, 'aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
    }
  }

  /**
   * Gives the keyboard focus to a tab.
   *
   * @param id The tab.
   */
  focusTab(id: DrawerTab): void {
    this.#tabs.get(id)?.tab.focus();
  }

  /**
   * Moves between the tabs with the arrow keys, Home, and End, as the tabs pattern of WAI-ARIA
   * says. The tab that gets the focus shows its panel.
   *
   * @param event The key event in the tab list.
   */
  #onTabKey(event: KeyboardEvent): void {
    const ids = [...this.#tabs.keys()];
    const at = this.#current === null ? 0 : ids.indexOf(this.#current);
    const next = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: ids.length - 1,
    }[event.key];
    if (next === undefined || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const id = ids[(next + ids.length) % ids.length];
    if (id) {
      this.showTab(id);
      this.focusTab(id);
    }
  }
}
