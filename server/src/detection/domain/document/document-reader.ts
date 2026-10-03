import type { SourceDocument } from './source-document.js';

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export interface DocumentReader {
  read(file: UploadedFile): Promise<SourceDocument>;
}

export const DOCUMENT_READER = Symbol('DOCUMENT_READER');

export class UnreadableDocumentError extends Error {}
