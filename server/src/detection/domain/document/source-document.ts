export type DocKind = 'text' | 'pdf' | 'docx' | 'txt' | 'md' | 'code';

export interface MetaEntry {
  key: string;
  value: string;
  flagged?: boolean;
}

export interface SourceDocument {
  kind: DocKind;
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
