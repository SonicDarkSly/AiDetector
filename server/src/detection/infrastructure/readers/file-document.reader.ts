import { Injectable } from '@nestjs/common';
import type { SourceDocument } from '../../domain/document/source-document.js';
import {
  UnreadableDocumentError,
  type DocumentReader,
  type UploadedFile,
} from '../../domain/document/document-reader.js';
import { readDocx } from './docx.reader.js';
import { readPdf } from './pdf.reader.js';
import { readPlainText, looksLikeText } from './plain-text.reader.js';

const TEXT_EXT = new Set(['txt', 'text', 'log', 'csv', 'tsv', 'rtf', 'srt', 'vtt']);
const MD_EXT = new Set(['md', 'markdown', 'mdx', 'rst', 'adoc']);
export const CODE_EXT = new Set([
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
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
  'bat',
  'cmd',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'vue',
  'svelte',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'ini',
  'gradle',
  'ipynb',
  'dockerfile',
  'tf',
]);

@Injectable()
export class FileDocumentReader implements DocumentReader {
  async read(file: UploadedFile): Promise<SourceDocument> {
    const name = file.filename.toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop()! : name === 'dockerfile' ? 'dockerfile' : '';
    const mime = (file.mimetype || '').toLowerCase();
    const isZip = file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;

    if (ext === 'pdf' || mime.includes('pdf') || file.buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
      return readPdf(file);
    }
    if (ext === 'docx' || mime.includes('wordprocessingml')) return readDocx(file);
    if (ext === 'doc') {
      throw new UnreadableDocumentError(
        'Ancien format .doc non pris en charge : ouvrez-le dans Word et enregistrez-le en .docx.',
      );
    }
    if (isZip && ['odt', 'pages', 'xlsx', 'pptx', 'zip'].includes(ext)) {
      throw new UnreadableDocumentError(
        `Format .${ext} non pris en charge (PDF, DOCX, TXT, Markdown ou code).`,
      );
    }
    if (MD_EXT.has(ext)) return readPlainText(file, 'md', ext);
    if (CODE_EXT.has(ext)) return readPlainText(file, 'code', ext);
    if (TEXT_EXT.has(ext) || mime.startsWith('text/') || looksLikeText(file.buffer)) {
      return readPlainText(file, 'txt', ext || null);
    }
    throw new UnreadableDocumentError(
      'Format non pris en charge. Formats acceptés : PDF, DOCX, TXT, Markdown, code source.',
    );
  }
}
