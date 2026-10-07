import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import git from 'isomorphic-git';
import JSZip from 'jszip';
import type { UploadedFile } from '../../domain/document/document-reader.js';
import { UnreadableDocumentError } from '../../domain/document/document-reader.js';
import type {
  MetaEntry,
  ProjectCommit,
  ProjectFacts,
  ProjectFile,
  SourceDocument,
} from '../../domain/document/source-document.js';
import { assistantToolOf } from '../../domain/detectors/assistant-files.js';
import { decodeText } from './plain-text.reader.js';

const MAX_PROJECT_CHARS = 380_000;
// au-delà, fichier généré ou embarqué plutôt qu'écrit
const MAX_FILE_CHARS = 60_000;
const MAX_COMMITS = 1000;
const MAX_GIT_BYTES = 300 * 1024 * 1024;

const IGNORED_DIRS =
  /(^|\/)(node_modules|vendor|bower_components|dist|build|out|target|bin|obj|coverage|\.next|\.nuxt|\.output|\.svelte-kit|\.angular|\.turbo|\.cache|\.gradle|\.idea|\.venv|venv|__pycache__|Pods|__MACOSX|\.git)\//;
const IGNORED_FILES =
  /\.min\.[a-z]+$|\.d\.ts$|\.map$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock)$/;
const SOURCE_EXT = new Set([
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'vue',
  'svelte',
  'py',
  'java',
  'kt',
  'kts',
  'scala',
  'cs',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'm',
  'mm',
  'dart',
  'lua',
  'pl',
  'r',
  'sql',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'html',
  'htm',
  'css',
  'scss',
  'less',
]);

const extensionOf = (path: string) => {
  const name = path.split('/').pop() ?? '';
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : null;
};

export async function readProject(file: UploadedFile): Promise<SourceDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file.buffer);
  } catch {
    throw new UnreadableDocumentError('Archive .zip illisible ou corrompue.');
  }
  const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.startsWith('__MACOSX/'));

  // le dossier .git le moins profond désigne la racine du projet
  const gitHead = entries
    .map((e) => e.name)
    .filter((n) => /(^|\/)\.git\/HEAD$/.test(n))
    .sort((a, b) => a.length - b.length)[0];
  const gitDir = gitHead?.slice(0, -'HEAD'.length);

  const assistantFiles = new Set<string>();
  const candidates: JSZip.JSZipObject[] = [];
  for (const e of entries) {
    if (/(^|\/)\.git\//.test(e.name)) continue;
    if (assistantToolOf(e.name) && !/(^|\/)(node_modules|vendor)\//.test(e.name)) assistantFiles.add(e.name);
    if (IGNORED_DIRS.test(e.name) || IGNORED_FILES.test(e.name)) continue;
    if (SOURCE_EXT.has(extensionOf(e.name) ?? '')) candidates.push(e);
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));

  let text = '';
  const files: ProjectFile[] = [];
  let tooLarge = 0;
  for (const e of candidates) {
    if (text.length >= MAX_PROJECT_CHARS) break;
    const content = decodeText(await e.async('nodebuffer')).text.replace(/\r\n?/g, '\n');
    if (content.length > MAX_FILE_CHARS) {
      tooLarge++;
      continue;
    }
    if (!content.trim() || text.length + content.length > MAX_PROJECT_CHARS) continue;
    text += `===== ${e.name} =====\n`;
    files.push({
      path: e.name,
      extension: extensionOf(e.name),
      start: text.length,
      end: text.length + content.length,
    });
    text += `${content}\n\n`;
  }
  if (files.length === 0 && assistantFiles.size === 0 && !gitDir) {
    throw new UnreadableDocumentError("Aucun fichier source reconnu dans l'archive .zip.");
  }

  let commits: ProjectCommit[] | undefined;
  let gitError: string | undefined;
  if (gitDir) {
    try {
      commits = await readCommits(zip, entries, gitDir);
    } catch (err) {
      gitError = err instanceof Error ? err.message : String(err);
    }
  }

  const project: ProjectFacts = {
    files,
    sourceFiles: candidates.length,
    assistantFiles: [...assistantFiles].sort(),
    commits,
    gitError,
  };
  const metadata: MetaEntry[] = [
    { key: "Fichiers dans l'archive", value: String(entries.length) },
    { key: 'Fichiers source analysés', value: `${files.length} sur ${candidates.length}` },
    ...(tooLarge ? [{ key: 'Fichiers source trop gros ignorés', value: String(tooLarge) }] : []),
    {
      key: 'Historique git',
      value: commits
        ? `${commits.length}${commits.length >= MAX_COMMITS ? ' derniers' : ''} commit(s) lu(s)`
        : gitError
          ? `illisible (${gitError})`
          : 'absent (dossier .git non inclus)',
    },
    ...[...assistantFiles].sort().map((path) => ({ key: "Fichier d'assistant IA", value: path })),
  ];
  return {
    kind: 'code',
    project,
    filename: file.filename,
    mimetype: file.mimetype || null,
    size: file.buffer.length,
    text,
    metadata,
    raw: {},
    urls: [],
    extension: 'zip',
  };
}

async function readCommits(
  zip: JSZip,
  entries: JSZip.JSZipObject[],
  gitDir: string,
): Promise<ProjectCommit[]> {
  const root = await mkdtemp(join(tmpdir(), 'mefiance-git-'));
  try {
    let bytes = 0;
    for (const e of entries) {
      if (!e.name.startsWith(gitDir)) continue;
      const content = await zip.file(e.name)!.async('nodebuffer');
      bytes += content.length;
      if (bytes > MAX_GIT_BYTES) throw new Error('dossier .git trop volumineux');
      const target = join(root, e.name.slice(gitDir.length));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    const log = await git.log({ fs, gitdir: root, depth: MAX_COMMITS });
    return log.map(({ commit }) => ({
      author: commit.author.name,
      email: commit.author.email,
      message: commit.message,
    }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
