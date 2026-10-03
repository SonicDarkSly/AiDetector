export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

export function tag(xml: string | null | undefined, name: string): string | undefined {
  if (!xml) return undefined;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`<${esc}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc}>`, 'i'));
  if (!m) return undefined;
  const v = decodeEntities(
    m[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  return v || undefined;
}

export function attr(xml: string | null | undefined, name: string): string | undefined {
  if (!xml) return undefined;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`${esc}="([^"]*)"`, 'i'));
  return m ? decodeEntities(m[1]).trim() || undefined : undefined;
}
