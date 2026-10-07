export type DocKind = 'text' | 'pdf' | 'docx' | 'txt' | 'md' | 'code';

export interface MetaEntry {
  key: string;
  value: string;
  flagged?: boolean;
}

// emplacement d'un fichier source dans le texte concaténé d'un projet
export interface ProjectFile {
  path: string;
  extension: string | null;
  start: number;
  end: number;
}

export interface ProjectCommit {
  author: string;
  email: string;
  message: string;
}

export interface ProjectFacts {
  files: ProjectFile[];
  sourceFiles: number;
  assistantFiles: string[];
  // undefined : pas de dossier .git dans l'archive
  commits?: ProjectCommit[];
  gitError?: string;
}

export interface SourceDocument {
  kind: DocKind;
  project?: ProjectFacts;
  filename: string | null;
  mimetype: string | null;
  size: number;
  text: string;
  metadata: MetaEntry[];
  raw: Record<string, string>;
  urls: string[];
  extension: string | null;
}

export function pastedText(text: string): SourceDocument {
  const normalized = text.replace(/\r\n?/g, '\n');
  return {
    kind: 'text',
    filename: null,
    mimetype: null,
    size: Buffer.byteLength(normalized, 'utf8'),
    text: normalized,
    metadata: [],
    raw: {},
    urls: [],
    extension: null,
  };
}
