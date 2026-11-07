# 8. Demos

## 8.1 License rules

- The composition must be in the public domain.
- The MIDI file or the score must also have its own clear license: public domain, CC0, or CC BY
  with a credit line in the app. A MIDI sequence of a public domain composition can still belong
  to the person who made the sequence.
- A score on musescore.com is "all rights reserved" unless its page shows a different license.
- The Mutopia Project has pieces with public domain, CC BY, and CC BY-SA licenses. Use only the
  public domain and CC BY pieces.
- OpenScore scores are CC0, but their annotations are CC BY-SA and are stored as lyrics. Remove
  the lyrics before the repository gets the file.
- The credits list the source and the typesetter of each demo, also with no required credit.
  The credit of a CC BY file ends with links to its source and to its license, because CC BY 4.0
  asks for a link to the license (section 3(a)(1)(C)).
- A MIDI file whose music is under copyright stays out of the repository, also as a test input.
- The demo list holds only positive and cheerful pieces.

[`demos/README.md`](../../demos/README.md) gives the source link, the license, the typesetter,
and the SHA-256 of each file.

### Mixamo files

A character or an animation of mixamo.com is a "Content File" of Adobe. The license is royalty
free for personal, commercial, and non-profit projects, such as films and video games (the
[Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) of Adobe). It is
personal and gives no right to sublicense. It permits a modified copy and a distribution only
inside the end use, and never "on a stand-alone basis, outside of the End Use" (the
[Adobe General Terms of Use](https://www.adobe.com/legal/terms.html), effective 3 October 2025,
section 3.6). The
[Mixamo Additional Terms](https://wwwimages2.adobe.com/content/dam/cc/en/legal/servicetou/Mixamo-Addl-Terms-en_US-20210623.pdf)
of 23 June 2021 add one rule: no training or test of a machine learning model.

- **Repository.** No Mixamo file goes into git, and no file that a tool makes from one: no FBX
  file, no GLB file of `pnpm mixamo-import`, and no clip data. The repository is public, so each
  file in it is a stand-alone copy. Its licenses (CC BY-NC 4.0 and Apache 2.0) would also
  sublicense the file.
- **Local files.** Keep the files in `scratch/` or in a folder outside the repository, and give
  their paths to the tools, as a MIDI file of the user (`--midi`). Only the person who downloaded
  a file uses it, because the license is personal.
- **Build.** The build can embed a retargeted clip in the code of the app, as a game embeds its
  animations, and never a source file. The build has no Mixamo clip now. The dev server and the
  probes serve the clips of the gallery from the local folder (4.4), and `dist/` gets none.
- **Auto-rig.** The terms do not name the skeleton and the weights that the auto-rigger of
  Mixamo gives an own mesh. Keep them outside git until the project author decides.

## 8.2 List

| # | Hash id | Piece | Source | License | What it shows |
|---|---|---|---|---|---|
| 1 | `mozart-k191` | Mozart, Bassoon Concerto, mvt 3 | Mutopia 686 | public domain | Solo bassoon, oboes, horns, strings |
| 2 | `mozart-k417` | Mozart, Horn Concerto 2, mvt 3 | Mutopia 901 | public domain | Horns, oboes, and strings |
| 3 | `bach-bwv1050` | Bach, Brandenburg Concerto 5, mvt 3 | Mutopia 548 | public domain | Solo flute, violin, harpsichord |
| 4 | `beethoven-9` | Beethoven, Symphony 9, finale, excerpt ("Ode to Joy") | OpenScore | CC0 | Choir on the risers, full orchestra, timpani, percussion |
| 5 | `pachelbel-p37` | Pachelbel, Canon in D, P. 37 | Mutopia 2047 | CC BY 4.0 | Three violins and a cello, with one player for each note |
| 6 | `beethoven-5-4` | Beethoven, Symphony 5, mvt 4, with no exposition repeat | OpenScore | CC0 | Piccolo, contrabassoon, and three trombones with the full orchestra |
| 7 | `beethoven-7-4` | Beethoven, Symphony 7, mvt 4, with no exposition repeat | OpenScore | CC0 | Classical orchestra with trumpets and timpani at a fast tempo |
| 8 | `beethoven-6-1` | Beethoven, Symphony 6 ("Pastoral"), mvt 1, with no exposition repeat | OpenScore | CC0 | Woodwinds, two horns, and strings |
| 9 | `boulanger-matin` | Boulanger, D'un matin de printemps | OpenScore | CC0 | Percussion, harp, celesta, trombones, tuba |
| 10 | `mozart-k525` | Mozart, Eine kleine Nachtmusik, mvt 1 | Mutopia 2230 | public domain | Four string parts with one player for each note |
| 11 | `bach-bwv1048` | Bach, Brandenburg Concerto 3, mvt 1 | OpenScore | CC0 | Three violin seats, string orchestra, harpsichord |
| 12 | `beethoven-8` | Beethoven, Symphony 8, mvt 2 | OpenScore | CC0 | Woodwinds and horns with the strings |
| 13 | `mozart-k315` | Mozart, Andante K. 315 | Mutopia 344 | public domain | Solo flute |
| 14 | `beethoven-1` | Beethoven, Symphony 1, mvt 4 | OpenScore | CC0 | Classical woodwinds, brass, and timpani |
| 15 | `brahms-2` | Brahms, Symphony 2, mvt 4 | OpenScore | CC0 | Full romantic brass, woodwinds, and strings |
| 16 | `beethoven-8-4` | Beethoven, Symphony 8, mvt 4 | OpenScore | CC0 | Full orchestra |
| 17 | `bach-bwv1047` | Bach, Brandenburg Concerto 2, mvt 1 | Mutopia 1680 | public domain | Solo trumpet, flute, oboe, violin, harpsichord |
| 18 | `mendelssohn-op61` | Mendelssohn, A Midsummer Night's Dream, Op. 61: V | Mutopia 80 | public domain | Woodwinds and strings |
| 19 | `sibelius-2-1` | Sibelius, Symphony No. 2, Op. 43: I | Jack Gilbert, from the user | none (see demos/README.md) | Full orchestra |
| 20 | `sibelius-2-2` | Sibelius, Symphony No. 2, Op. 43: II | Jack Gilbert, from the user | none (see demos/README.md) | Full orchestra |
| 21 | `sibelius-2-3-4` | Sibelius, Symphony No. 2, Op. 43: III and IV | Jack Gilbert, from the user | none (see demos/README.md) | Full orchestra |

- `DEMOS` of `app/demos.ts` holds the title, the composer, and the credit line of each demo, in
  the order of `DEMO_IDS`. Demo 1 is the default demo (`DEFAULT_DEMO`, 2.2), and it is part of
  the first download (7.2). All demos use the section size "Auto".
- Each title has one pattern: "{work}, {catalogue number}: {movement}", with the movement as a
  Roman number or the name of the excerpt. The title at the top left and the demo row show the
  same text.
- The Beethoven 9 demo joins two parts of the finale (8.4): the full choir sings the theme from
  the first note, then the coda plays to the end. It has no vocal soloists, because the soloist
  passages start with a quiet solo and make the demo longer than 4 minutes. No Mutopia or
  Wikimedia Commons file with a permitted license has the full orchestra and the choir.
- Eine kleine Nachtmusik and the Canon are no orchestral files (3.8), so "Auto" gives one player
  for each note.
- The app keeps the choir and its risers, because a file of the user can have a choir.

A dropped file takes the title `Score.sequenceName`, or the file name when the sequence name is
'' (`titleSequenceName()` gives '' for a generic name). With a sequence name, the second line
shows the file name, else it is empty, so that the page does not show the name two times. A
dropped file has no credit line.

## 8.3 Changes to the files

A demo file with wrong programs gets a repair at build time. `demos/patches.json` holds the
program changes, and `demos/README.md` gives the reason for each one. Each change names a track by
its index, because two tracks with one program can need different programs.

- `tools/patch-demos.ts` checks the SHA-256 of each file in `demos/src/`, applies the changes,
  and writes each file into `public/demos/`. `pnpm dev` and `pnpm build` run it first.
- The build gzips each demo file of `dist/demos/` in place, because GitHub Pages sends a MIDI
  file with no gzip (7.2). `fetchPlainBytes()` of `audio/plain-bytes.ts` removes the gzip layer.

```typescript
interface DemoPatch {
  /** File name in demos/src/. */
  file: string;
  /** Sets the program of all program changes in one track. The index starts at 0. */
  setProgram: { track: number; program: number }[];
}
```

## 8.4 The OpenScore files

The default MuseScore export of an OpenScore score is not usable. It ignores the "pizz." and
"arco" marks, it can play a whole part as Tremolo Strings, and it writes the CC BY-SA annotations
as lyric events. Each solo and divisi staff becomes a seat, so the player count goes above 60.

A pipeline in `tools/musescore/` makes a 16-channel file instead:

```text
score with the lyrics removed (CC0 only)
   │ remap_score.py unique    each part on its own port, articulation k on channel k
   v
   │ add_switches.py          channel switches at the "pizz." and "arco" marks
   v
   │ mscore -o out.mid        MuseScore 4 CLI (the pipeline checks the output file)
   v
   │ remap_midi.py            one channel for each section group, program changes at switches
   v
the 16-channel demo file
```

- One channel for each section group, such as Violin 1 with its divisi and solo parts. The divisi
  staves become one seat with divisi (3.8), as a real section does. Channel 10 has the Orchestral
  kit (kit 48). Each part uses the program of its group, so the piccolo plays as a flute.
- The MuseScore CLI often crashes after it writes the file, so the pipeline checks the output
  file and ignores the exit code.
- A group map in `demos/groups/` can put the low strings on the channels 11 to 13, so that no
  melodic group falls on the percussion channel 10.
- `cut_midi.py` joins tick ranges into an excerpt. Each part starts with the tempo, the programs,
  and the controllers that apply at its start. The first part of the Beethoven 9 demo ends with
  the D major chords, because the next bars turn to G major.
- The `beethoven-5-4`, `beethoven-7-4`, and `beethoven-6-1` demos play the exposition one time.
  Many conductors skip its repeat, so the cut is a normal performance choice.

The repository holds the Boulanger score with no lyrics (`demos/boulanger/`) and the result
files. `demos/README.md` gives the commit and the SHA-256 of each other score, and the commands.
A run gives a byte-identical file. CI does not run MuseScore.

## 8.5 Demo tests

A Vitest test (`score/demos.test.ts`) builds the `Score` of each demo, after the changes of 8.3,
and checks three things:

- The demo has no more than 60 players.
- The sections and the seat counts are exactly those that the test lists for each demo.
- No seat comes from a wrong program: there is no seat in another section, and no sound-only
  seat.
