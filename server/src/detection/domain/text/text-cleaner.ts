const HOMOGLYPH_SOURCE =
  '\u0430\u0435\u043E\u0440\u0441\u0443\u0445\u0456\u0458\u0455\u04BB\u0501\u051B\u051D\u0410\u0412\u0415\u041A\u041C\u041D\u041E\u0420\u0421\u0422\u0425\u0406\u0408\u0405\u03BF\u03B1\u03BD\u03C1\u03B9\u03BA\u03C4\u03C5\u039F\u0391\u0392\u0395\u0399\u039A\u039C\u039D\u03A4\u03A7\u0396\u0397\u03A1\u03A5';
const HOMOGLYPH_TARGET = 'aeopcyxijshdqwABEKMHOPCTXIJSoavpiktuOABEIKMNTXZHPY';
const HOMOGLYPHS = new Map([...HOMOGLYPH_SOURCE].map((c, i) => [c, HOMOGLYPH_TARGET[i]]));

const REMOVALS: RegExp[] = [
  /:?contentReference\[oaicite:\d+\](\{index=\d+\})?/g,
  /【\d+(?::\d+)?†[^】\n]{0,60}】/g,
  /\b(?:cite|filecite|navlist)?turn\d+(?:search|news|view|fetch|file|image|academia|forecast|finance|product)\d+\b/g,
  /\[cite_start\]|\[cite:\s*[\d,\s-]+\]/g,
  /<think>[\s\S]*?<\/think>\s*/g,
  /\s?\[citation:\s?\d+\]/g,
  /\[\^\d+\^\]/g,
  /<argument name="citation_id">[^<]*<\/argument>|<\/?grok:render[^>]*>/g,
  /[\uE000-\uF8FF]/g,
  /[\u{E0000}-\u{E007F}]/gu,
  /[\u200B\u200C\u2060\u180E\u202A-\u202E\u2066-\u2069]/g,
  /(?<!^)\uFEFF/g,
  /(?<![\p{Extended_Pictographic}\u20E3#*0-9©®™])[\uFE00-\uFE0F]|[\u{E0100}-\u{E01EF}]/gu,
];

export function cleanText(text: string): { text: string; removed: number } {
  let removed = 0;
  let out = text;
  for (const re of REMOVALS) {
    out = out.replace(re, () => {
      removed++;
      return '';
    });
  }

  out = out.replace(/(?<![\uDC00-\uDFFF\uFE0F☀-➿])\u200D/g, () => {
    removed++;
    return '';
  });

  out = out.replace(/https?:\/\/[^\s)\]"'>]+/g, (url) => {
    const cleaned = url
      .replace(
        /([?&])utm_source=(?:chatgpt\.com|openai|perplexity(?:\.ai)?|copilot(?:\.com)?|gemini|claude(?:\.ai)?|bard|you\.com|mistral|deepseek|grok)(&?)/gi,
        (_m, sep: string, amp: string) => (amp ? sep : ''),
      )
      .replace(/[?&]$/, '');
    if (cleaned !== url) removed++;
    return cleaned;
  });

  out = out.replace(/\p{L}+/gu, (w) => {
    if (!/\p{Script=Latin}/u.test(w) || !/[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(w)) return w;
    return [...w]
      .map((c) => {
        if (HOMOGLYPHS.has(c)) {
          removed++;
          return HOMOGLYPHS.get(c)!;
        }
        return c;
      })
      .join('');
  });

  out = out.replace(/(\S) +([.,])(?=\s|$)/gm, '$1$2');
  return removed > 0 ? { text: out, removed } : { text, removed: 0 };
}
