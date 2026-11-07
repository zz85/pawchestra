import { describe, expect, it } from 'vitest';

import { BAR_HIDE_SEC, SPEEDS, barShows, speedText, volumeGain } from './bar-rules.ts';
import type { BarActivity } from './bar-rules.ts';

/** The bar during play, 1 s after the last pointer motion. */
const ACTIVE: BarActivity = {
  playing: true,
  idleSec: 1,
  focused: false,
  hovered: false,
  drawerOpen: false,
};

describe('barShows (design 2.3, 2.8)', () => {
  it('hides the bar during play after 3 s with no pointer motion', () => {
    expect(BAR_HIDE_SEC).toBe(3);
    expect(barShows(ACTIVE)).toBe(true);
    expect(barShows({ ...ACTIVE, idleSec: 2.99 })).toBe(true);
    expect(barShows({ ...ACTIVE, idleSec: 3 })).toBe(false);
  });

  it('shows the bar while the music does not play', () => {
    expect(barShows({ ...ACTIVE, playing: false, idleSec: 60 })).toBe(true);
  });

  it('keeps the bar while it has the focus, the pointer, or an open drawer', () => {
    const idle = { ...ACTIVE, idleSec: 60 };
    expect(barShows({ ...idle, focused: true })).toBe(true);
    expect(barShows({ ...idle, hovered: true })).toBe(true);
    expect(barShows({ ...idle, drawerOpen: true })).toBe(true);
  });
});

describe('the speed menu (design 2.4, 2.8)', () => {
  it('goes from 0.5x to 1.5x with the texts of the spec', () => {
    expect(SPEEDS.map(speedText)).toEqual(['0.5×', '0.75×', '1.0×', '1.1×', '1.15×', '1.2×', '1.25×', '1.5×']);
  });
});

describe('volumeGain', () => {
  it('gives the square of the slider position', () => {
    expect(volumeGain(100, false)).toBe(1);
    expect(volumeGain(50, false)).toBe(0.25);
    expect(volumeGain(0, false)).toBe(0);
  });

  it('gives 0 while muted, and keeps the gain in 0 to 1', () => {
    expect(volumeGain(80, true)).toBe(0);
    expect(volumeGain(120, false)).toBe(1);
    expect(volumeGain(-5, false)).toBe(0);
  });
});
