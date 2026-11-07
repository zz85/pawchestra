# Demos

This folder holds the demo pieces of the app (design section 8).

- `src/` holds the input files of the build. The Mutopia files are unchanged downloads.
- `patches.json` holds the program changes that the build applies by track (design 8.3).
  `tools/patch-demos.ts` checks the checksums below, applies the changes, and writes each demo
  file into `public/demos/`. `pnpm dev` and `pnpm build` run it first.
- `boulanger/` holds the source score of the Boulanger file.
- `groups/` holds the group maps of the other OpenScore files.
- The first demo of `DEMO_IDS` (`mozart-k191`) is the default demo: the first screen shows it,
  and it is part of the first download (design 2.2, 7.2, 8.2).

## Sources and licenses

All compositions but the Sibelius symphony are in the public domain. Each file but the Sibelius
files also has its own license.

| Hash id | File | Piece | Source | License | Typesetter (credit) |
|---|---|---|---|---|---|
| `mozart-k315` | `src/mozart-k315.mid` | Mozart, Andante in C for flute and orchestra, K. 315 | [Mutopia 344](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=344), file `k315-score.mid` in the MIDI zip | Public Domain | Maurizio Tomasi |
| `boulanger-matin` | `src/boulanger-matin.mid` | Lili Boulanger, D'un matin de printemps | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/d9a40bb1c4930a45495905d52f440f44b78ff818/data/Boulanger,_Lili/D'un_matin_de_printemps/D'un_matin_de_printemps.mscz), made by the pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-9` | `src/beethoven-9.mid` | Beethoven, Symphony No. 9, Op. 125, mvt 4, bars 543 to 590 and 851 to 940 ("Ode to Joy") | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.9,_Op.125/4/Beethoven_Op.125_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `mozart-k525` | `src/mozart-k525.mid` | Mozart, Eine kleine Nachtmusik, K. 525, mvt 1 | [Mutopia 2230](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2230), file `MozartWA-KV525-mov-01.mid` in the MIDI zip | Public Domain | Mike Blackstock |
| `bach-bwv1048` | `src/bach-bwv1048.mid` | Bach, Brandenburg Concerto No. 3, BWV 1048, mvt 1 | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Bach,_Johann_Sebastian/Brandenburg_Concerto_No.3,_BWV.1048/1/Bach_BWV.1048_1.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-8` | `src/beethoven-8.mid` | Beethoven, Symphony No. 8, Op. 93, mvt 2 | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.8,_Op.93/2/Beethoven_Op.93_2.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-1` | `src/beethoven-1.mid` | Beethoven, Symphony No. 1, Op. 21, mvt 4 | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.1,_Op.21/4/Beethoven_Op.21_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `brahms-2` | `src/brahms-2.mid` | Brahms, Symphony No. 2, Op. 73, mvt 4 | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Brahms,_Johannes/Symphony_No.2,_Op.73/4/Brahms_Op.73_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-8-4` | `src/beethoven-8-4.mid` | Beethoven, Symphony No. 8, Op. 93, mvt 4 | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.8,_Op.93/4/Beethoven_Op.93_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `bach-bwv1047` | `src/bach-bwv1047.mid` | Bach, Brandenburg Concerto No. 2, BWV 1047, mvt 1 | [Mutopia 1680](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1680) | Public Domain | Allen Garvin |
| `bach-bwv1050` | `src/bach-bwv1050.mid` | Bach, Brandenburg Concerto No. 5, BWV 1050, mvt 3 | [Mutopia 548](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=548) | Public Domain | Eric van der Velden |
| `mendelssohn-op61` | `src/mendelssohn-op61.mid` | Mendelssohn, A Midsummer Night's Dream, Op. 61: V | [Mutopia 80](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=80) | Public Domain | Aaron Gage |
| `mozart-k417` | `src/mozart-k417.mid` | Mozart, Horn Concerto No. 2, K. 417, mvt 3 | [Mutopia 901](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=901) | Public Domain | Maurizio Tomasi |
| `mozart-k191` | `src/mozart-k191.mid` | Mozart, Bassoon Concerto, K. 191, mvt 3 | [Mutopia 686](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=686) | Public Domain | Maurizio Tomasi |
| `pachelbel-p37` | `src/pachelbel-p37.mid` | Pachelbel, Canon in D, P. 37 ("Canon per 3 Violini e Basso") | [Mutopia 2047](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2047), file `canon_per_3_violini_e_basso.mid` in the MIDI zip | CC BY 4.0 | Michael Fischer v. Mollard |
| `beethoven-5-4` | `src/beethoven-5-4.mid` | Beethoven, Symphony No. 5, Op. 67, mvt 4, with no exposition repeat | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.5,_Op.67/4/Beethoven_Op.67_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-7-4` | `src/beethoven-7-4.mid` | Beethoven, Symphony No. 7, Op. 92, mvt 4, with no exposition repeat | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.7,_Op.92/4/Beethoven_Op.92_4.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `beethoven-6-1` | `src/beethoven-6-1.mid` | Beethoven, Symphony No. 6, Op. 68 ("Pastoral"), mvt 1, with no exposition repeat | [OpenScore Orchestra](https://github.com/MarkGotham/Hauptstimme/blob/8f677853c45b74ca0afcd79677e5379c06c82354/data/Beethoven,_Ludwig_van/Symphony_No.6,_Op.68/1/Beethoven_Op.68_1.mscz), made by the OpenScore pipeline below | CC0 1.0 (score) | OpenScore |
| `sibelius-2-1` | `src/sibelius-2-1.mid` | Sibelius, Symphony No. 2, Op. 43, mvt 1 | The user of this checkout, file `sibelius_symphony_2_1_(c)gilbert.mid` | None given: the file says "(c) Jack Gilbert" | Jack Gilbert |
| `sibelius-2-2` | `src/sibelius-2-2.mid` | Sibelius, Symphony No. 2, Op. 43, mvt 2 | The user of this checkout, file `sibelius_symphony_2_2_(c)gilbert.mid` | None given: the file says "(c) Jack Gilbert" | Jack Gilbert |
| `sibelius-2-3-4` | `src/sibelius-2-3-4.mid` | Sibelius, Symphony No. 2, Op. 43, mvts 3 and 4 | The user of this checkout, file `sibelius_symphony_2_3-4_(c)gilbert.mid` | None given: the file says "(c) Jack Gilbert" | Jack Gilbert |

The three Sibelius files do not follow the license rules of design 8.1. Sibelius died in 1957,
so the symphony is in the public domain in the US and under copyright in the EU until 1 January
2028, and the sequences of Jack Gilbert have no license. The user added them on 2026-11-07 and
accepted this risk for a local checkout. Remove them before the site is deployed.

Only the CC BY 4.0 license of `pachelbel-p37` requires a credit line and a link to the license.
The credits panel of the app lists each source and each typesetter. For `pachelbel-p37`, it also
links to the source and to the license.

The Mutopia pages were read on 2026-10-04, and the page of piece 2230 on 2026-10-05. Each page
shows "Copyright: Public Domain". The LilyPond source of piece 2230 also holds
`license = "Public Domain"`. The page of piece 2047 was read on 2026-10-30. It shows
"Copyright: Creative Commons Attribution 4.0", and its LilyPond source holds
`license = "Creative Commons Attribution 4.0"`.

The OpenScore Orchestra README gives "Scores: CC0 1.0 Universal; Annotations: CC-By-SA" (read
on 2026-10-05 and on 2026-10-30, at commit `8f677853`). Each score holds the same text in its
`copyright` meta tag.

## Checksums (SHA-256)

| File | SHA-256 |
|---|---|
| `src/mozart-k315.mid` | `91b2ef1c3a91ff1631638df0059b44b3bd6940e90af235003922b414140a7c84` |
| `src/boulanger-matin.mid` | `0f50942dcaf0e656c45cc118e0cc49560c83c76ca5dab30cc3239730f568347e` |
| `src/beethoven-9.mid` | `0041f8991e1acb410ee88696e3e2681268fcca61a5c95a29a71bda1d3bad7552` |
| `src/mozart-k525.mid` | `7a6f71b2b7763524a56322723c774d584af006dd980289fce60ebd93a91a16d7` |
| `src/bach-bwv1048.mid` | `acf4428de234548e528185334283fe492e3cffe561f77b3dfdde74f212a4e41b` |
| `src/beethoven-8.mid` | `1482c086437e225e0849a31ba05e920011e1cac6b96490017f8799bc77c92b80` |
| `src/beethoven-1.mid` | `72adea7ea3831e7cb25e6143d9299b09b9a08d28d663a6268100d1375848eff8` |
| `src/brahms-2.mid` | `b7f6292e05f7f74a2bc0e54224ff4aa5f7d4cb97705079a3a5fa22397fb6e0c5` |
| `src/beethoven-8-4.mid` | `d6bd7608a97e2b19c18d5d3810b1ec8217f8619f77f0f2bc8f9a260fad5574f0` |
| `src/bach-bwv1047.mid` | `d2892d03237a1cf0e0b55b12ebccee6d5cdfb7e6951c3c2429f64294a6e0d40a` |
| `src/bach-bwv1050.mid` | `7dc1acc6d8502b99af6ea2269dd5d20d23e812a6c40d3d11a0a2abb23ae5baf1` |
| `src/mendelssohn-op61.mid` | `2f421b302892d4bc8de5832d61c1d9c8b091eeba62fb31b180626d1dd895261a` |
| `src/mozart-k417.mid` | `d6ab9bc12bfdc4dedd0751a45d3ad1cd1d8a549101a5c3649c38e202ef3d84fb` |
| `src/mozart-k191.mid` | `3fa97dfb3136ffe1c62e5420a44c5a630954a92e7fb33b8858a05717d9adf284` |
| `src/pachelbel-p37.mid` | `953b73e270117d388e9ef1a76f8b9e97ff640d1400768849f41a3cf71c59cbc1` |
| `src/beethoven-5-4.mid` | `241ddab0fe831ea1e14699d0030e0a52d45c23a7eaf707a0d59b66bd289c8da2` |
| `src/beethoven-7-4.mid` | `1262d3200da80ac485c5d44d85b93dbada6a3f452f1e84a2de1c68cda93b4891` |
| `src/beethoven-6-1.mid` | `50d66781d1b7dbe7e5a412ac37b9b89548a137bcd8498be1a96bd7ce8d34b15d` |
| `src/sibelius-2-1.mid` | `fc81696d7e9ef2013df8f8910c0ebf5a878fa14eba5f242abb1369340a068218` |
| `src/sibelius-2-2.mid` | `c655d6bef27161c2502435d273fb5c63b543e2d867e03cdc51d902551bbed3b6` |
| `src/sibelius-2-3-4.mid` | `dfc192bcd76e91548d260d8f7f74b8c1421f1e75784ef97334316fa5106a32a8` |
| `boulanger/matin-nolyrics.mscz` | `cbcca2cd6b43c0d58ba0c3f38b7e9bfbc438e1b1ec4720b6bea784e7fbcd013f` |

## Program changes

`patches.json` holds the program changes that the build applies by track (design 8.3).
In `src/bach-bwv1047.mid` (Mutopia 1680), track 8 (the cello / violone) has program 40 (Violin),
changed to 42 (Cello), and track 9 (the continuo) has program 0 (Acoustic Grand Piano), changed
to 6 (Harpsichord) for Baroque continuo.

## The Boulanger file

`boulanger/matin-nolyrics.mscz` is the OpenScore score with all 170 Lyrics elements removed
(87 in the main score, 83 in the part scores). These lyrics held the CC BY-SA annotations, so the
remaining score is CC0 only. Its `copyright` meta tag still names the annotations.

`src/boulanger-matin.mid` comes from this pipeline. The scripts are in `tools/musescore/`, and
`tools/musescore/README.md` explains them. CI does not run the pipeline, because it needs
MuseScore 4.

When two parts on one channel overlap on the same key, `remap_midi.py` ends the sounding note just
before the later note-on. Without this rule, 110 notes have no note off and sound to the end of
the piece.

```bash
P=tools/musescore
T=$(mktemp -d)
MS=mscore                                                  # the CLI of MuseScore 4.7.5
python3 -I $P/remap_score.py unique demos/boulanger/matin-nolyrics.mscz $T/matin-unique.mscz
python3 -I $P/add_switches.py $T/matin-unique.mscz $T/matin-unique-sw.mscz
"$MS" -o $T/matin-unique-sw.mid $T/matin-unique-sw.mscz    # exits with 134 after the write
test -s $T/matin-unique-sw.mid
python3 -I $P/remap_midi.py $T/matin-unique-sw.mid $T/matin-unique-sw.mscz $T/boulanger-matin.mid --programs group
cmp $T/boulanger-matin.mid demos/src/boulanger-matin.mid
python3 -I $P/validate.py $T/matin-unique-sw.mid $T/matin-unique-sw.mscz $T/boulanger-matin.mid
```

The check prints 12,139 attacks, 0 missed, 0 extra, 15 with a wrong program, and 0 s of lost
sound. The 15 notes are pizzicato and arco notes of two parts that start on the same key at the
same tick, so only one note-on remains.

CAUTION: The MuseScore CLI crashes after it writes the file in most runs. Check the output file,
and ignore the exit code. Each crash writes a dump file to the log folder of MuseScore.

The pipeline gives a file that is byte-identical to `src/boulanger-matin.mid`.

## The other OpenScore files

The OpenScore files of `src/`, other than `src/boulanger-matin.mid`, come from the OpenScore
scores at commit `8f677853` of the Hauptstimme repository. The repository does not hold
these scores. The pipeline downloads each score and removes all lyrics first, so the annotations
of the instrumental scores (CC BY-SA, stored as lyrics) do not enter it. The Beethoven 9 score
has the sung text as lyrics and its annotations as staff text. The MuseScore export writes no
staff text, and `remap_midi.py` drops the lyric events. Thus each result holds no text of the
score: only the group names, the tempo, and the time and key signatures.

`groups/` holds the group map of each score (`tools/musescore/README.md`). Each group gets one
MIDI channel:

- Beethoven 9: the four soloists form one group and the choir another. The excerpt has no note
  of the soloists, so the stage shows one choir seat. The piccolo plays with the flutes, and the
  contrabassoon with the bassoons.
- Bach: the three violin parts keep three groups. The three viola parts form one group, and so
  do the three cello parts. With nine string groups, the layout made a stage side of 20.71 m,
  against 10.43 m with seven.
- Beethoven 6, 7, and 8: one group for each instrument.
- Beethoven 5: one group for each instrument. The piccolo plays with the flutes, and the
  contrabassoon with the bassoons. The alto, tenor, and bass trombones form one group.

The Beethoven 9 demo is an excerpt of two parts of the finale, both in D major:

- Bars 543 to 590: the full choir sings the theme "Freude, schöner Götterfunken" with the full
  orchestra, to the D major chords after the last word. Bars 591 to 594 turn to G major for the
  Andante maestoso, so the excerpt leaves them out.
- Bars 851 to 940: the Prestissimo coda to the end of the symphony.

The score counts the pickup bar as measure 1, and three more partial bars, so bar 543 starts at
tick 880,800, bar 591 at tick 949,920, and bar 851 at tick 1,610,880, with 480 ticks for each
quarter note. The finale ends at tick 1,781,760. The two parts give a traditional and joyful
version of the finale.

Some demos play the exposition one time (design 8.4). The MuseScore export plays each repeat,
so `cut_midi.py` keeps the ticks before the second pass of the exposition and the ticks after
it. The ticks are ticks of the export, with 480 ticks for each quarter note. In each demo, the
two passes of the export hold the same notes, and no note sounds across a join.

| Demo | Kept bars of the score | Kept ticks of the export |
|---|---|---|
| `beethoven-5-4` | 1 to 84, then 87 to 446 (the second ending) | 0 to 161,280 and 324,480 to 989,760 |
| `beethoven-7-4` | 1 to 136, then 142 to 490 (the second ending) | 0 to 130,560 and 262,080 to 615,600 |
| `beethoven-6-1` | 1 to 512, with bars 1 to 138 one time | 0 to 132,480 and 264,960 to 624,000 |

| Score file | SHA-256 |
|---|---|
| `Beethoven_Op.125_4.mscz` | `7055e0c60a1d819ec21e455676aaca0106f0d251a17e311714a0de62434dca55` |
| `Bach_BWV.1048_1.mscz` | `7ea8d2cf64a0aa54cdd4d7f5df8f7433fdf5f3169b27111e9c62be4e30d90a4c` |
| `Beethoven_Op.93_2.mscz` | `6e3437c0edd2729f49302fc2728595624f87ff4a4f1b38e71cd244583a522fb8` |
| `Beethoven_Op.21_4.mscz` | `7f8843cd12e525dbd7731e67ddd98bc505d6567088d3abfebda5e7a56411a9a5` |
| `Beethoven_Op.67_4.mscz` | `19179c3e140362cd1c8ad05445b95eab2105d7b1c1a203c793b46bb6dbe56b2e` |
| `Beethoven_Op.92_4.mscz` | `eb723932a87b20ecd225399d104e2d7384382933f11a2f0968830a73163b0489` |
| `Beethoven_Op.68_1.mscz` | `c5fd6b92a920e703ab11510a71d0801894023879515c5fecb8f254839b8359a5` |

```bash
P=tools/musescore
T=$(mktemp -d)
MS=mscore                                                  # the CLI of MuseScore 4.7.5
H=https://raw.githubusercontent.com/MarkGotham/Hauptstimme/8f677853c45b74ca0afcd79677e5379c06c82354/data
# ID, the score in the Hauptstimme repository, and the tick ranges of an excerpt
ID=beethoven-9 S='Beethoven,_Ludwig_van/Symphony_No.9,_Op.125/4/Beethoven_Op.125_4.mscz' CUT='880800 949920 1610880 1781760'
# ID=bach-bwv1048 S='Bach,_Johann_Sebastian/Brandenburg_Concerto_No.3,_BWV.1048/1/Bach_BWV.1048_1.mscz' CUT=
# ID=beethoven-8 S='Beethoven,_Ludwig_van/Symphony_No.8,_Op.93/2/Beethoven_Op.93_2.mscz' CUT=
# ID=beethoven-5-4 S='Beethoven,_Ludwig_van/Symphony_No.5,_Op.67/4/Beethoven_Op.67_4.mscz' CUT='0 161280 324480 989760'
# ID=beethoven-7-4 S='Beethoven,_Ludwig_van/Symphony_No.7,_Op.92/4/Beethoven_Op.92_4.mscz' CUT='0 130560 262080 615600'
# ID=beethoven-6-1 S='Beethoven,_Ludwig_van/Symphony_No.6,_Op.68/1/Beethoven_Op.68_1.mscz' CUT='0 132480 264960 624000'
G=demos/groups/$ID.json
curl -sfL -o $T/score.mscz "$H/$S"
shasum -a 256 $T/score.mscz                                # compare with the table above
python3 -I $P/strip_lyrics.py $T/score.mscz $T/nolyrics.mscz
python3 -I $P/remap_score.py unique $T/nolyrics.mscz $T/unique.mscz --groups $G
python3 -I $P/add_switches.py $T/unique.mscz $T/unique-sw.mscz
"$MS" -o $T/unique-sw.mid $T/unique-sw.mscz                # can exit with 134 after the write
test -s $T/unique-sw.mid
python3 -I $P/remap_midi.py $T/unique-sw.mid $T/unique-sw.mscz $T/full.mid --programs group --groups $G
python3 -I $P/validate.py $T/unique-sw.mid $T/unique-sw.mscz $T/full.mid --groups $G
if [ -n "$CUT" ]; then python3 -I $P/cut_midi.py $T/full.mid $T/$ID.mid $CUT; else cp $T/full.mid $T/$ID.mid; fi
cmp $T/$ID.mid demos/src/$ID.mid
```

The check prints 0 missed attacks, 0 extra attacks, 0 notes with a wrong program, and 0 s of lost
sound for each score: 46,224 attacks for the full Beethoven 9 finale, 9,301 for the Bach, 5,694 for
the Beethoven 8, 34,768 for the full Beethoven 5 finale, 25,121 for the full Beethoven 7 finale, and
15,935 for the full first movement of Beethoven 6. Its count of keys on channel 10 that are not drum
keys reads the keys of the Boulanger kit. The Beethoven 9 finale uses other keys (234). The pipeline
gives files that are byte-identical to the files in `src/`. The MuseScore runs can exit with code
134 after the write.

## Search for a new demo

The facts below come from a search on 2026-10-30. Check each file with the license rules of
design 8.1.

- Hauptstimme (OpenScore Orchestra, `MarkGotham/Hauptstimme`) has only 22 works. Its tree at
  commit `8f677853` holds all of them.
- Mutopia: the filter `https://www.mutopiaproject.org/cgibin/make-table.cgi?Instrument=Orchestra`
  gives 67 pieces. 54 of them have a permitted license (public domain or CC BY).
- IMSLP: read the `Copyright=` field of each file block in the page text from `api.php`. A direct
  download of a file gets a bot check.
- Wikimedia Commons has almost no full orchestral MIDI files.
- Send the Wikimedia API requests at least 1.5 s apart. With less time between them, the APIs
  answer HTTP 429 to the neutral User-Agent `zoophony-build/1.0`.
- Measure the fame of a work with the page views of its en.wikipedia article over 12 months, from
  the Wikimedia REST API.
