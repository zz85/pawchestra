# 2. Product

## 2.1 Input

- The user drops a `.mid` file on the page, or selects a file with a button. Each file goes
  through the file rules of 3.3. A drop of several files plays the first one. The drop overlay
  shows only for a drag of files.
- The user selects a demo from the demo list (section 8).
- Version 1 has no URL load and no live MIDI input. With a file, the app knows each note before
  it sounds, so an animal can move before the note.

## 2.2 First screen

- At start, the app selects the default demo (`DEFAULT_DEMO`, 8.2), because the default is a
  positive and cheerful piece. Its orchestra sits in the rest pose (5.2), a large play button
  starts the music, and the samples load right after the first frame.
- The URL hash `#demo=<id>` opens a demo (`fileFromHash()` in `app/demos.ts`). A selection in the
  demo list writes the hash with `history.replaceState()`. A dropped file does not change the URL.
- Only the first screen waits for a click, because the browser needs a user gesture before it
  plays audio. A piece that the user selects later starts when its samples are ready.
- A click on play while the samples load starts the piece when they are ready, and a second click
  cancels the wait (`playAction()` in `app/play-control.ts`). The click resumes the suspended
  `AudioContext` at once, because Safari can refuse a resume outside a user gesture (6.8).
- A demo file that does not load keeps the current piece and shows its message with "Try again"
  (`noPieceStatus()`).

## 2.3 Layout

The UI has the style of a video player. The theme is dark only, because the scene is dark.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Logo (paw, Pawchestra)                               ┌─────────────────┐ │
│ Title of the piece                                   │ Drawer:         │ │
│ Composer                                             │                 │ │
│                                                      │  Music          │ │
│                                                      │  Seats          │ │
│                 3D scene (canvas)                    │  Settings       │ │
│                                                      │  (Credits)      │ │
│                                                      │                 │ │
│                                                      └─────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ [>] 1:23 ---o----------- 5:16  1.0×  vol --o-  [c] [o] [ ] [|]       │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

- The bar holds play and pause, the seek bar, the times, the speed, the volume, and the buttons
  "Cinematic camera", "Reset view" (2.5), full screen, and the drawer. During play, the bar and
  the pointer hide after a short time with no pointer motion. A hidden bar ignores the pointer, so
  the first tap only shows it.
- In Cinematic mode, the bar stands in the middle of the bottom bar of the letterbox (2.5) where
  that bar has room for it and two gaps, so that the controls do not cover the film
  (`--bar-lift` of `ui/ui.css`). The drawer and the messages move up with it. Else the bar covers
  the bottom of the frame.
- In Cinematic mode, the title (the logo, the piece title, the composer, and the link to GitHub)
  stands at the top-left corner of the frame, at the insets of Free mode, so that it stays with
  the film. It moves with the bars (`--letterbox` and `--letterbox-side` of `ui/ui.css`). A
  window in portrait has a low frame and a high top bar, so there the title stays at the top of
  the window and covers no part of the frame.
- In Cinematic mode during play, all controls and panels but the title hide after the same time:
  the bar, the drawer (also when it is open), each tooltip, and the pointer (`uiShown()` of
  `app/bar-rules.ts`). The title always shows, because it names the piece of the film. A pointer
  motion, a tap, or Tab shows them all. They stay while the pointer is over the bar, the drawer,
  or the link of the title, while one of these has the keyboard focus, and while a dialog or a
  message is open. A pause shows them, and an open drawer comes back open. They fade in 0.2 s, at
  once with reduced motion. Free mode hides only the bar, because there the user works with the
  view and the drawer.
- Each change from Free mode to Cinematic mode closes the drawer, so that the film starts with no
  panel. A pointer motion, a tap, or Tab then shows the bar, and the drawer stays closed. The
  drawer button opens it. A change back to Free mode does not open the drawer again, so that a
  drag does not make a panel jump into view.
- The drawer has the tabs "Music" (the demos and the file button), "Seats", and "Settings" (with
  the link "Credits"). The UI says "Music", because each user knows the word, and it covers a demo
  and a MIDI file of the user. "Track" names a track of a MIDI file, and "song" does not fit the
  movement of a symphony. The code keeps the names "demo" and "piece".
- Each seat row has a mute button and a solo button. A click on an animal does nothing.
- The UI uses the system fonts, so the first download does not grow and no request goes to a
  font server.

## 2.4 Play, load, and keyboard

- Play waits until all samples of the file are loaded and decoded. The speed menu has 0.5×, 0.75×,
  1.0×, 1.1×, 1.15×, 1.2×, 1.25× and 1.5×.
- Space plays and pauses. The left and the right arrows seek 5 s, and Home goes to the start. The
  up and the down arrows move the volume slider by 5 of 100, and turn the mute off, as the slider
  does. C toggles the cinematic camera, M the mute, and F the full screen. Escape closes the
  drawer, a message, or the dialog. The keys do nothing in a text field, with Ctrl, Alt, or Meta,
  while the dialog is open, and when the focused control uses the key (`keyAction()` in
  `app/keys.ts`). C also acts on a focused button or slider, because no control uses it. A row of
  the piece list uses only Enter, so Space plays and pauses after a click on a piece.
- A solo moves the spotlight to the soloed players. The solo flags alone give the light, so a
  seek, a pause, and a mute keep it (4.5, 6.6).
- A click on play starts a count-in of the conductor before the music (5.4, 6.5).
- The app makes the `AudioContext` and loads the worklet before the first click, and the click
  resumes it. On iOS, `playWithSilentSwitch()` sets `navigator.audioSession.type = 'playback'`, so
  that the silent switch does not mute the music.

## 2.5 Camera

The camera has two modes: a free orbit camera and a cinematic camera that cuts between shots. The
page starts in Free mode (`app/camera-mode.ts`).

```text
                page load
                    │
                    v
             +-------------+
             |    FREE     |  orbit from the current camera
             +-------------+
                │       ^
   "Cinematic   │       │  drag, wheel, pinch,
    camera", C  │       │  "Cinematic camera", C, or
                │       │  "Reset view" (Free, default view)
                v       │
             +-------------+
             |  CINEMATIC  |  cameraAt()
             +-------------+
```

- The default view has the angle of view of `orchestra-latest.png` (1). It frames the used seats
  in the free area beside the open drawer (4.5).
- **Free** is the orbit camera. It starts from the current camera, so the view does not jump. It
  cannot go below the stage, and a zoom stops outside the box of the stage and the players.
- **Cinematic** takes each frame from `cameraAt()`: the shots of 5.6. The first shot starts from
  the default view, so a click on play makes no cut. A drag, a pinch, or a wheel changes to Free
  at once. The change to Cinematic mode closes the drawer (2.3).
- **Camera menu.** The tab "Video" of the drawer (`ui/video-panel.ts`) has the menu "Camera":
  the shots of the director, the free camera, or one seat. A seat puts Cinematic mode on the held
  view of that seat: one section shot of all its players for the whole piece, also before the
  first play (`ShotPlan.seatViews`, `seatViewPlan()` of `shots/prepare.ts`). The planner makes
  the view of each seat with the rules of a section shot and no shot before it. Each other change
  of the camera, such as a drag or C, ends the held view.
- **Letterbox.** Cinematic mode shows the scene in the largest box of the aspect 21:9
  (`CINEMA_ASPECT`) at the middle of the viewport, as a film. Pure black bars fill the rest: at
  the top and the bottom of a view narrower than 21:9, and at the sides of a wider view. The
  frame is the same in each view, also on a phone in portrait, as a film player shows a film. The
  shots of 5.6 take this aspect in each view, so a piece gives the same film on each screen. The
  drawer and the bar do not move the frame. The title stands at its top-left corner (2.3). Free
  mode has no bars.
- A change of the mode moves the bars in or out in `LETTERBOX_MOVE_MS` with a smoothstep, and at
  once with reduced motion. The image of the camera moves with the bars, so the change has no
  jump (`StageCamera.frameTo()`).
- On the first screen, the frame shrinks until the stage is clear of the play button (2.8). The
  frame uses the view of the stage at the default distance in the current direction, so a drag
  changes it and a zoom does not. Thus a wheel or a pinch zooms the camera there as during play,
  and a zoom in can move the stage under the play button.
- A pinch never zooms the page, because the page is the frame of the stage. On the stage, a pinch
  zooms the camera. The root takes `touch-action: pan-x pan-y`, and the app stops the gesture
  events of Safari, which does not obey that rule for a pinch.
- With reduced motion, Free mode has no inertia, a shot holds its first camera, and each
  transition is a hard cut.
- A new piece keeps the mode and makes new shots. The shots do not follow a solo, because they come
  one time from the score. No setting stores the mode.

## 2.6 Quality tiers and browser support

The tiers are High, Medium, and Low (`TIER_SETTINGS` of `scene/quality.ts`). The low tier has no
bloom, no depth of field, and no dust motes. No tier has side light shadows, because they cost GPU
time in each frame and changed only small shadows on the players. Each tier keeps MSAA, because
the hard edges of the low-poly parts show steps (4.5). No tier uses the full pixel ratio of a
Retina screen, because the GPU time grows with the pixels and the frame target of 9.7 comes first.
The image is a little softer.

- A touch screen (`(pointer: coarse)`) or a small screen starts at the medium tier, and other
  devices at the high tier. The app does not read the GPU name, because Safari on iOS gives only
  "Apple GPU".
- The automatic tier drops one tier when the frames are slow for a time window (`followFrame()`
  in `app/settings.ts`). It measures the time between frames, because the work time of a frame
  does not hold the GPU time. It measures only during play, with a visible tab and the setting
  "Auto". It only goes down, so the quality does not go down and up many times.
- A steady 30 fps or 50 fps does not drop the tier (`slowWindow()`), because energy saver modes
  and 50 Hz displays cap the rate, and a lower tier does not make these frames faster.
- A manual setting overrides the automatic tier. The setting "Frame rate" draws at each refresh
  ("Auto"), or caps the rate at 60 or 30 fps (`frameDue()`).
- The app needs WebGL2 (`probeWebgl2()` of `app/webgl.ts`). With no WebGL2, a full-page message
  replaces the stage and the UI.
- Supported browsers: the current and the previous major versions of Chrome, Firefox, and Safari
  (macOS and iOS), and Android Chrome.

## 2.7 Privacy

The site counts the page views with Vercel Web Analytics (`@vercel/analytics`), and has no cookies
and no service worker. The owner of the project needs the number of visits, and Web Analytics
gives it with no cookie and no identifier that follows a visitor to other sites.

- Only the build of `pnpm deploy:vercel` loads the analytics. The script sets
  `PAWCHESTRA_ANALYTICS=1`, and `vite.config.ts` gives the constant `PAWCHESTRA_ANALYTICS` to
  `src/main.ts`. The dev server and the local builds load no analytics. Thus the local probes get
  no request for a missing script, and the dev server sends no request to a host of Vercel.
- `inject()` loads `/_vercel/insights/script.js` from the site itself, and the script sends the
  page views to the same site.
- The app page gives one page view at each load. A demo selection changes only the hash with
  `history.replaceState()`, and the script counts a page view only at a new path. The pages of 7.4
  run no script, so they give no page views. The app sends no custom events.
- For each page view, Vercel stores the URL, the referrer, the place, the browser, the operating
  system, and the type of device. It identifies a visit with a hash of the request, and discards
  the hash after 24 hours.
- Web Analytics must be on in the settings of the Vercel project. Else the script gets a 404, and
  the app works with no count.

The link to the repository on GitHub (2.8) is a plain link. The page loads nothing from GitHub,
and the link sends no referrer (`rel="noopener noreferrer"`).

The page `/privacy` (7.4) gives these facts to the visitors, from `PRIVACY` of
`tools/site-pages.ts`. A change of this section updates that page in the same commit.

## 2.8 UI spec

The prototype [`prototype/ui.html`](../prototype/ui.html) and its screenshots show the tokens
and the layout, and `reference/mockup.png` is the target of the look. The CSS of the app is in
`ui/ui.css`.

**Tokens**

| Token | Value |
|---|---|
| `--bg-overlay` | `rgba(16, 13, 11, 0.72)`, with `backdrop-filter: blur(10px)` |
| `--panel` | `#17130f` |
| `--panel-glass` | `rgba(21, 18, 16, 0.96)`, with `backdrop-filter: blur(16px)` (the floating panel of the drawer) |
| `--line-faint` | `rgba(255, 240, 220, 0.06)` (the line between two rows of a list, and the hover of a seat row) |
| `--line` | `rgba(255, 240, 220, 0.10)` |
| `--pill-line` | `rgba(255, 240, 220, 0.24)` (the outline of the pill "Open source") |
| `--text` | `#efe8dc` |
| `--text-dim` | `#b5aa99` |
| `--accent` | `#e7b45a` (the warm gold of the spotlight) |
| `--accent-strong` | `#f0c676` (hover) |
| `--on-accent` | `#1a140d` (an icon or a text on `--accent`) |
| `--danger` | `#e0796a` |
| `--title-shade` | `rgba(11, 9, 8, 0.8)` (the shade behind each title line at the level 1) |
| `--github-mark` | `#c8c8c8` (the neutral gray of the GitHub mark, as the logo rules of GitHub ask) |
| `--track` | `rgba(255, 240, 220, 0.2)` (the track of a slider, where it is not filled) |
| Font | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--font-serif` | `"Palatino Linotype", Palatino, "Book Antiqua", "Iowan Old Style", Georgia, "Noto Serif", serif` (the piece title) |
| Font sizes | 12 px for times (tabular numbers), 13 px for secondary text, 14 px body. The piece title is `clamp(24px, 2.5vw, 36px)` (32 px at 1280 px), and the composer `clamp(13px, 1.15vw, 16px)` |
| Radius | 10 px for panels, 12 px for the floating panel of the drawer and for the bar, 8 px for buttons |
| Control size | at least 40 px for the controls of the bar and the first screen. 32 px for the compact controls in the drawer, in messages, and in dialogs (tabs, M, S, segmented buttons, close, the link "Credits"). At least 44 px for every control on a touch screen |
| Focus | a 2 px ring in `--accent`, with a 2 px offset, and the button radius on a slider |
| Button states | the hover and the color change in 120 ms (none with reduced motion), and a pressed button gets `rgba(255, 240, 220, 0.18)`. The large play button gets `--accent-strong` and the scale 0.96 while pressed |

**Components**

The modules of `ui/` and `app/` hold the sizes, the places, and the motions. Each motion is
instant with reduced motion. Each text keeps the contrast 4.5:1 of WCAG AA over the scene.

- **Title**: the logo (a gold paw and the wordmark "Pawchestra" in Fraunces, one SVG path
  `WORDMARK_PATH`, so no font file loads), the piece title, and the composer. The wordmark is the
  `h1` of the page, with the name as its accessible name, because the page is the app. The piece
  title is an `h2`. A gray pill with the
  GitHub mark and "Open source" (`REPOSITORY_TEXT`) links to `REPOSITORY_URL`. It is gray, because
  the logo rules of GitHub permit only white, black, or gray. `index.html` holds the title lines
  of the default demo, and the app keeps that header, so the piece title paints with the first
  paint (7.2). A hash that names a demo clears the lines before the first paint, and the app
  writes the title of its demo. The full-page message of 2.6 removes the header. In Cinematic
  mode, the header stands at the top-left corner of the frame and does not hide (2.3).
- **Title shade**: each title line has a soft shade. Its level comes from the frame behind the
  line (`shadeLevel()` in `ui/title-shade.ts`), because a shade from the camera mode does not see a
  free camera. A shade comes in at once and goes out slowly, so that it does not flicker.
- **Bar**: "Cinematic camera" is pressed in Cinematic mode. At the song end, play becomes "Play
  again" (6.5), and the bar offers no next demo. The seek bar seeks only when the samples are
  ready (`app/seek.ts`). The volume gain is the square of the position (6.8). The drawer button
  says "Open the drawer" or "Close the drawer", and the full screen button "Full screen" or "Exit
  full screen". Each control stays inside the bar at each width. From 900 px, the controls stand
  in the groups of the mockup. From 700 px to 899 px, the groups do not fit, so the controls stand
  closer. The volume slider shrinks to half its width before a control leaves the bar.
- **First screen**: a round play button below the front edge of the stage, so that it does not
  cover the orchestra. The camera frame shrinks until the stage is clear of it
  (`clearFirstScreen()`). A ring shows the load progress of the bytes, and the load text counts
  the files (`loadText()`). Until the first play, an intro line names the app, and "Select
  music" opens the demo list. While the drawer shows the demo list, the button has nothing to
  open, so it hides (`visibility: hidden`, so that the first screen keeps its size). A wide window
  opens the drawer at the demo list at start, so there the intro line shows alone. ASD-STE100 has
  no verb "choose", so the buttons say "Select".
  `index.html` holds the same load state as static HTML and the style sheets in its head (inline
  in the build, 7.2), so the first paint shows no unstyled page.
- **Drawer**: a floating panel in `--panel-glass`, nearly opaque, so that its dim text keeps
  4.5:1 over white fur. Only the panel of the current tab scrolls. The arrow keys, Home, and End
  move between the tabs, as the tabs pattern of WAI-ARIA says. While the drawer is open in Free
  mode, the camera moves its frame with `setViewOffset()` (`stageCover()`), and the canvas fills
  the window, so the opaque canvas shows no edge. A wide window opens the drawer at start
  (`isWideLayout()`), so that the stage does not move at the click on play. The change to
  Cinematic mode closes it (2.3).
  - **Demos**: a row with the title, the composer, and the length, and no cover. A long title
    wraps, because an ellipsis would hide a part of it. The current row has a level meter from the
    notes of the score (`meterLevels()`), so the UI owns no audio code. The meter has a column of
    its own, so the text does not move.
  - **File button**: "Open a MIDI file", with the second line "From this device, or drop it on the
    page" ("From this device" on a touch screen). It stands below the demo list, because it also
    selects a piece. It does not say "Upload", because the file stays on the device.
  - **Seats**: a row with a dot in the fur color, the seat name, the animal line, and the toggle
    buttons "M" and "S" ("Mute {name}", "Solo {name}"). Only a screen reader reads the source line.
    The dot is small and faint while its seat is silent, and full with a soft glow while it plays
    (`seatLevels()`). A dark fur gets a lighter glow that keeps 3:1 (`ringColor()`).
  - **Settings**: "Section size" (Auto, One per part, Full), "Quality" (Auto, High, Medium, Low),
    and "Frame rate" (Auto, 60 fps, 30 fps). "Auto" names its current value, such as "Auto
    (Full)". `SETTING_HELP` gives the help lines. A counter beside "Frame rate" shows the drawn
    rate (`measuredFrameRate()`).
  - **Credits**: the link "Credits" is a `button` with `aria-haspopup="dialog"`, because it opens a
    native `<dialog>` and goes to no page. The dialog has the layout of the end credits of a film:
    a title card with the author, then "Now playing" (8.2), "Sounds" (6.2, 6.8), and "Other
    pieces" (7.3, 8.1), and an end card with the copyright line and "Third-party licenses"
    (`creditTexts()`). Each link opens a new tab, so that the music does not stop.
- **Phone**, narrower than 700 px: the drawer is a sheet above the bar with a drag handle, and a
  selection closes it. The speed, the volume, "Reset view", and full screen move into the group
  "Playback" of the settings, so that the page has one control of each kind. The bar shows no
  duration, so that the seek bar is longer. The top inset of the title (`--title-top`) keeps the
  touch area of the link to GitHub inside the window.
- **Messages**: at the bottom center above the bar, with a bar in `--danger`. A message closes
  after a few seconds, with "Close the message", or with Escape. It stays while it has the pointer
  or the focus (`followMessage()`). A new message or a new piece replaces it. The failure texts
  end with "Check the connection.", because the button "Try again" stands next to them.
- **Build cover**: the canvas fades out before a build and in after the first render.
- **Page title**: "{title}, {composer} · Pawchestra" for a demo, and "{title} · Pawchestra" for a
  file (`pageTitle()`). The default demo keeps the title of the start page (7.4).
- **Tooltips** name the action and its key: "Play (Space)", "Pause (Space)", "Play again (Space)",
  "Seek (← →, Home)", "Mute (M)", "Volume (↑ ↓)", "Cinematic camera (C)", "Full screen (F)",
  "Exit full screen (F)", and "Speed", "Reset view", and "Open the drawer" with no key. The link
  to GitHub shows "Pawchestra on GitHub". The tooltips keep their keys, although the mockup shows
  only the names, because they are the only visible hint of the keys. A tooltip follows WCAG
  1.4.13, and never shows for a touch. A bar that hides hides only the tooltips of its own
  controls, so the tooltip of the link to GitHub stays while the link has the focus. A screen
  reader skips it, because `aria-label` and `aria-keyshortcuts` give the name and the key.
- **Icons**: inline SVG, 20 × 20, stroke width 1.75, round caps and joins, `currentColor`
  (`ui/icons.ts`). "Cinematic camera" shows an open clapperboard. In a lineup of the bar at 1x
  and 2x, it read as film at 20 px, with the stroke weight of the other icons. A movie camera
  with two reels was too busy at 20 px, a frame with filled letterbox bars read as a card, and a
  film strip read as a media file. A still camera looks like a button that takes a photo.

**Seat texts**

| Section | Name | One player | Section | Name | One player |
|---|---|---|---|---|---|
| violin | Violins | Violin | horn | Horns | Horn |
| viola | Violas | Viola | trumpet | Trumpets | Trumpet |
| cello | Cellos | Cello | trombone | Trombones | Trombone |
| contrabass | Contrabasses | Contrabass | tuba | Tuba | Tuba |
| harp | Harp | Harp | timpani | Timpani | Timpani |
| piano | Piano (see below) | Piano | percussion | Percussion | Percussion |
| flute | Flutes | Flute | choir | Choir | Voice |
| oboe | Oboes | Oboe | sound-only | Other sounds | Other sounds |
| clarinet | Clarinets | Clarinet | | | |
| bassoon | Bassoons | Bassoon | | | |

`app/seat-text.ts` makes the texts.

- A seat with one player takes the name in the column "One player". The soloist (3.8) that does
  not sit at a keyboard adds "soloist", for example "Flute soloist", because "Solo flute" would
  make the solo button read "Solo Solo flute". A chamber group of 4.2 names no soloist.
- A seat of the section "piano" takes the name of its first program (`keyboardName()`): programs 0
  to 5 "Piano", 6 "Harpsichord", 7 "Clavinet", 8 "Celesta", 16 to 20 "Organ", 21 and 23
  "Accordion", and 22 "Harmonica". The piano model stays.
- If more than one seat of a section has a name, the name gets the number of the seat in that
  section, from 1: "Violins 1", "Violin 2", "Choir 3". The soloist gets no number, and the other
  seats of its section do not count it.
- The animal line gives the number of players and their species: "5 rabbits", "1 deer", "8 red
  foxes" (`animalText()`). The sound-only seat shows "No animal".
- The source line names the ports (from 0), the channels (1 to 16), and the programs or kits
  (from 0) of the seat (`sourceLine()`): "Port 0, channels 7 and 10, program 47, kit 48". The
  sound-only seat names only its programs and kits (3.7): "Programs 80 and 81". A list of three
  or more items uses commas and "and": "channels 1, 2, and 9".

**Message texts**

| Case | Text |
|---|---|
| Not a valid MIDI file | This file is not a valid MIDI file. |
| Format 2 | This MIDI file uses format 2. The player supports format 0 and format 1 only. |
| More than 4 MB | This file is larger than 4 MB. Select a smaller file. |
| No notes | This MIDI file has no notes. |
| No WebGL2 (a full-page message) | This browser cannot show the orchestra, because it does not support WebGL2. Use a current version of Chrome, Firefox, or Safari. |
| Above the full-page message: the name (24 px) and one line about the app (16 px, dim) | Pawchestra / An orchestra of animals plays your MIDI file. |
| Demo file failure (with a "Try again" button) | The demo did not load. Check the connection. |
| Load failure (with a "Try again" button) | The instruments did not load. Check the connection. |
| Audio failure after the load, for example during play (with a "Try again" button) | An error stopped the music. Try again. |
| Load progress before the file of the first piece shows | Loading |
| Load progress before the list of the preset files is known | Loading instruments |
| Load progress | Loading instruments: {done} of {total} |
| Load progress after a long load, when the sizes are known (megabytes of 1,000,000 bytes, one decimal) | Loading instruments: {done} of {total} ({arrived} of {sum} MB) |
| Second line of the load text while the piece waits for its samples | The music starts after the load. |
| Drop overlay | Drop the MIDI file to play it. |
| First screen, until the first play of the session | Pawchestra: an orchestra of animals plays your MIDI file. |
| First screen, the button that opens the demo list | Select music |

**Accessibility**

- Each control is a `button`, an `input type="range"`, or a `select`, with an `aria-label`. A demo
  row has the label of its title, its composer, and its spoken length (`demoRowLabel()`).
- Each toggle button has `aria-pressed`. Each tab has `role="tab"` and `aria-selected`.
- The seek bar has an `aria-valuetext`, for example "1 minute 23 seconds of 5 minutes 16 seconds".
- The canvas has `role="img"` and the `aria-label` "An orchestra of animals on a stage".
- Polite `aria-live` regions announce the load progress, the messages, and the title of each new
  piece.
- The focus order is the title, the bar, then the drawer.
- When a focused play button of the first screen or a focused message goes away, the play button
  of the bar gets the focus. When the drawer closes with the focus in it (Escape, a selection in
  the sheet of a phone, or the change to Cinematic mode), the drawer button gets the focus.
- A row of the music list that a click focused shows no focus ring, also after Space or an arrow
  key. A Tab into the list shows the ring.
- In Free mode, the bar stays visible while a control of the bar has the keyboard focus
  (`:focus-visible`), while the pointer is over it, and while the drawer is open. In Cinematic
  mode, the focus or the pointer on the bar, the drawer, or the link of the title keeps the bar
  and the drawer, and an open drawer does not (2.3). The title does not hide. The hidden controls
  stay in the focus order.

## 2.9 Video export

The tab "Video" of the drawer exports the current piece as an MP4 file (`app/video-export.ts`,
which loads only at an export). The options are the resolution, the frame rate, the start (the
song start or the current position), the duration, the tail after the music, the picture (full
frame, or the letterbox of 21:9), and the sound. The camera of the camera menu (2.5) films it.

- **Offline.** Each frame renders at a fixed time step with its own clock
  (`RenderOptions.nowMs`), so the video is smooth however slow the GPU is. The poses and the shots
  are stateless (5.1, 5.6), so a frame needs only its song time. The page pauses and draws no
  frame of its own during the export.
- **Sound.** The `SynthEngine` renders the clip on the main thread with the banks of a decode
  Worker, and the output chain of the `Player` with the hall renders it in an
  `OfflineAudioContext`. The mute and the solo buttons apply.
- **File.** WebCodecs encodes H.264, and AAC or, with no AAC encoder (Chromium), Opus.
  `mp4-muxer` writes a fragmented MP4 from the start to the end, so the file needs no second pass.
