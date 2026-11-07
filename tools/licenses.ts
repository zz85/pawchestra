import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LICENSES_FILE } from '../src/app/credits.ts';
import { HALL_CREDIT, KONZERTHAUS_CREDIT } from '../src/audio/hall-credit.ts';
import type { AssetCredit } from '../src/audio/hall-credit.ts';

/** npm packages that the site bundles, and whose license texts it ships (design 7.3). */
const BUNDLED_PACKAGES: readonly string[] = [
  'three',
  'spessasynth_core',
  'stb-vorbis',
  '@vercel/analytics',
  'mp4-muxer',
];

/** Link to the legal code of CC0 1.0, which has no condition, so the file holds no copy of it. */
const CC0_LINK = 'CC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/legalcode';

/** One part of the third-party license file. */
export interface LicenseEntry {
  /** Name and version, such as `three 0.180.0`. */
  readonly title: string;
  /** SPDX identifier or license name. */
  readonly license: string;
  /** Web page of the project. */
  readonly source: string;
  /** Full license text. */
  readonly text: string;
}

/** Fields of a package.json file that this script reads. */
interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly license?: string;
  readonly homepage?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
}

/**
 * Creates the text of the third-party license file.
 *
 * @param entries The license entries, in the order of the file.
 * @returns The file text, with a header and one section for each entry.
 */
export function licenseDocument(entries: readonly LicenseEntry[]): string {
  const rule = '='.repeat(72);
  const sections = entries.map((entry) =>
    [rule, `${entry.title} (${entry.license})`, entry.source, rule, '', entry.text.trimEnd()].join(
      '\n',
    ),
  );
  const header = 'Pawchestra includes the third-party software and data below, under these licenses.';
  return `${[header, ...sections].join('\n\n')}\n`;
}

async function readManifest(path: string): Promise<PackageManifest> {
  // SAFETY: npm and pnpm require the name and version fields, and the other fields are optional.
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest;
}

function packageDir(root: string, name: string): string | undefined {
  const direct = join(root, 'node_modules', name);
  if (existsSync(direct)) {
    return direct;
  }
  // A transitive dependency is only in the pnpm store, in a folder such as `stb-vorbis@1.0.0`.
  const store = join(root, 'node_modules', '.pnpm');
  const folders = readdirSync(store).filter((folder) => folder.startsWith(`${name}@`));
  if (folders.length > 1) {
    throw new Error(`More than one version of ${name} is installed: ${folders.join(', ')}.`);
  }
  const folder = folders[0];
  return folder ? join(store, folder, 'node_modules', name) : undefined;
}

async function packageEntry(dir: string): Promise<LicenseEntry> {
  const manifest = await readManifest(join(dir, 'package.json'));
  const file = readdirSync(dir).find((name) => /^(licen[cs]e|copying)(\.|$)/i.test(name));
  if (!file) {
    throw new Error(`${manifest.name} has no license file in ${dir}.`);
  }
  return {
    title: `${manifest.name} ${manifest.version}`,
    license: manifest.license ?? 'see the text',
    source: manifest.homepage ?? `https://www.npmjs.com/package/${manifest.name}`,
    text: await readFile(join(dir, file), 'utf8'),
  };
}

/**
 * Reads the license entry of each package of a list (design 7.3).
 *
 * @param root The folder of the root package.json.
 * @param names The package names.
 * @returns One entry for each name, in the order of `names`.
 * @throws Error if a package is not installed, or if it has no license file.
 */
export async function packageEntries(
  root: string,
  names: readonly string[],
): Promise<LicenseEntry[]> {
  const entries: LicenseEntry[] = [];
  for (const name of names) {
    const dir = packageDir(root, name);
    if (!dir) {
      throw new Error(`${name} is not installed, so the license file cannot include it.`);
    }
    entries.push(await packageEntry(dir));
  }
  return entries;
}

/**
 * Makes the license entry of a hall impulse response (design 6.8, 7.3). CC BY 4.0 asks for the
 * credit, a link to the license, and a note of the changes, so the text is the credit line and
 * the two links. Section 3(a)(1)(C) accepts the link in place of the license text.
 *
 * @param title The title of the entry.
 * @param credit The credit of the file, `HALL_CREDIT` or `KONZERTHAUS_CREDIT`.
 * @returns The entry.
 */
export function hallEntry(title: string, credit: AssetCredit): LicenseEntry {
  return {
    title,
    license: credit.license,
    source: credit.sourceUrl,
    text: [credit.text, `Source: ${credit.sourceUrl}`, `License: ${credit.licenseUrl}`].join('\n'),
  };
}

/**
 * Makes the license entry of the GitHub mark of the link to the repository (design 2.8, 7.3).
 * The path comes from Primer Octicons, under the MIT license, so the text is the license of
 * `assets/github-mark/LICENSE.txt`.
 *
 * @param root The folder of the root package.json.
 * @returns The entry.
 */
export async function githubMarkEntry(root: string): Promise<LicenseEntry> {
  const license = await readFile(join(root, 'assets', 'github-mark', 'LICENSE.txt'), 'utf8');
  return {
    title: 'GitHub mark, icons/mark-github-24.svg of Primer Octicons',
    license: 'MIT',
    source: 'https://github.com/primer/octicons',
    text: [
      'The link to the repository shows this mark. The mark is a trademark of GitHub, Inc.',
      '',
      license,
    ].join('\n'),
  };
}

/**
 * Makes the license entry of the font of the wordmark in the logo (design 2.8, 7.3). The logo
 * holds the outlines of the word in Fraunces as an SVG path, so the text is the license of
 * `assets/fraunces/LICENSE.txt`.
 *
 * @param root The folder of the root package.json.
 * @returns The entry.
 */
export async function frauncesEntry(root: string): Promise<LicenseEntry> {
  const license = await readFile(join(root, 'assets', 'fraunces', 'LICENSE.txt'), 'utf8');
  return {
    title: 'Fraunces 1.0, by Undercase Type',
    license: 'OFL-1.1',
    source: 'https://github.com/undercasetype/Fraunces',
    text: [
      'The logo shows the name of the app as the outlines of this font. The app holds no font file.',
      '',
      license,
    ].join('\n'),
  };
}

/**
 * Reads the license entries of the sources of the SoundFont (design 6.2, 7.3): GeneralUser GS,
 * VSCO 2 CE, and VCSL.
 *
 * @param root The folder of the root package.json.
 * @returns One entry for each source, in the order of the README of `assets/soundfont/`.
 */
export async function soundFontEntries(root: string): Promise<LicenseEntry[]> {
  const folder = join(root, 'assets', 'soundfont');
  return [
    {
      title: 'GeneralUser GS 2.0.3, by S. Christian Collins',
      license: 'GeneralUser GS License v2.0',
      source: 'https://github.com/mrbumpy409/GeneralUser-GS',
      text: await readFile(join(folder, 'LICENSE.txt'), 'utf8'),
    },
    {
      title:
        'VS Chamber Orchestra 2: Community Edition 1.1.0, by Versilian Studios (Sam Gossner) and Ivy Audio (Simon Dalzell)',
      license: 'CC0 1.0',
      source: 'https://github.com/sgossner/VSCO-2-CE',
      text: `Pawchestra.sf3 holds changed samples of this library: cut, mixed to mono, looped, and encoded as Ogg Vorbis.\n\n${CC0_LINK}`,
    },
    {
      title: 'Versilian Community Sample Library, by Versilian Studios',
      license: 'CC0 1.0',
      source: 'https://github.com/sgossner/VCSL',
      text: `Pawchestra.sf3 holds changed samples of this library: cut, mixed to mono, looped, and encoded as Ogg Vorbis.\n\n${CC0_LINK}`,
    },
  ];
}

/**
 * Reads all entries of the third-party license file (design 7.3): the bundled packages, the
 * sources of the SoundFont, the hall impulse response, and the GitHub mark.
 *
 * @param root The folder of the root package.json.
 * @returns The entries, in the order of the file.
 * @throws Error if a dependency is not in `BUNDLED_PACKAGES`, or if a license file is missing.
 */
export async function licenseEntries(root: string): Promise<LicenseEntry[]> {
  const rootManifest = await readManifest(join(root, 'package.json'));
  const unlisted = Object.keys(rootManifest.dependencies ?? {}).filter(
    (name) => !BUNDLED_PACKAGES.includes(name),
  );
  if (unlisted.length > 0) {
    throw new Error(
      `Add these dependencies to BUNDLED_PACKAGES in tools/licenses.ts: ${unlisted.join(', ')}.`,
    );
  }
  const entries = await packageEntries(root, BUNDLED_PACKAGES);
  entries.push(...(await soundFontEntries(root)));
  entries.push(
    hallEntry("Hall impulse response, St Paul's Hall (360° BRIR and FOA database)", HALL_CREDIT),
    hallEntry(
      'Hall impulse response, Konzerthaus Detmold (Open Database of Spatial Room Impulse ' +
        'Responses at Detmold University of Music)',
      KONZERTHAUS_CREDIT,
    ),
  );
  entries.push(await githubMarkEntry(root));
  entries.push(await frauncesEntry(root));
  return entries;
}

async function main(): Promise<void> {
  const root = join(import.meta.dirname, '..');
  const entries = await licenseEntries(root);
  const out = join(root, 'dist', LICENSES_FILE);
  await writeFile(out, licenseDocument(entries));
  console.log(`Wrote ${out}: ${entries.map((entry) => entry.title).join(', ')}.`);
}

if (import.meta.main) {
  await main();
}
