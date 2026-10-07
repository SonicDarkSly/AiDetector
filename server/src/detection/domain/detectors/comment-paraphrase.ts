// commentaire d'une ligne qui redit la ligne de code suivante (« // Get the user » / getUser())

const HASH_ONLY = new Set(['py', 'sh', 'bash', 'zsh', 'rb', 'r', 'pl', 'ps1', 'yml', 'yaml', 'toml']);
const MARKUP = new Set(['html', 'htm', 'vue', 'svelte', 'xml']);

const STOP = new Set(
  (
    'the and for with from into are its this that these those our all any each new then else when not out via ' +
    'les des une aux dans sur pour par avec est sont cet cette ces qui que ses son leur nouveau nouvelle tous toutes puis'
  ).split(' '),
);
// mots français des commentaires → fragments d'identifiants anglais
const FRENCH: [string, string[]][] = [
  ['récup', ['get', 'fetch', 'retrieve', 'load']],
  ['cré', ['create', 'new', 'make', 'build']],
  ['mise', ['update', 'set']],
  ['mettre', ['update', 'set']],
  ['supprim', ['delete', 'remove', 'destroy']],
  ['vérif', ['check', 'is', 'has', 'validate', 'verify']],
  ['ajout', ['add', 'push', 'append', 'insert']],
  ['initialis', ['init', 'setup']],
  ['utilisateur', ['user']],
  ['affich', ['show', 'display', 'render']],
  ['charg', ['load', 'fetch']],
  ['envo', ['send', 'post', 'submit']],
  ['calcul', ['compute', 'calculate', 'calc']],
  ['défini', ['set', 'define']],
  ['retourn', ['return']],
  ['renvoi', ['return']],
  ['gère', ['handle']],
  ['gérer', ['handle']],
  ['gestion', ['handle', 'manage']],
  ['erreur', ['error', 'err']],
  ['donnée', ['data']],
  ['fichier', ['file']],
  ['réponse', ['response', 'res']],
  ['requête', ['request', 'req', 'query']],
  ['nombre', ['count', 'number', 'num']],
  ['état', ['state', 'status']],
  ['valeur', ['value', 'val']],
  ['clé', ['key']],
  ['élément', ['item', 'element']],
  ['formulaire', ['form']],
  ['bouton', ['button', 'btn']],
  ['liste', ['list', 'items']],
  ['tableau', ['array', 'table']],
  ['connexion', ['connect', 'login']],
  ['titre', ['title']],
  ['chemin', ['path']],
  ['tri', ['sort']],
  ['filtr', ['filter']],
  ['parcour', ['for', 'each', 'map']],
  ['boucle', ['for', 'loop', 'while']],
  ['ferm', ['close']],
  ['ouvr', ['open']],
  ['lire', ['read']],
  ['écri', ['write']],
  ['enregistr', ['save', 'store']],
  ['sauvegard', ['save']],
];

const TOOLING =
  /^(todo|fixme|hack|xxx|eslint|prettier|@ts-|ts-|noqa|type:|pylint|istanbul|c8|biome|region|endregion|#)/i;

export interface Paraphrase {
  start: number;
  end: number;
  codeEnd: number;
}

function commentOf(line: string, extension: string | null): string | undefined {
  const ext = extension ?? '';
  const m =
    (HASH_ONLY.has(ext) ? line.match(/^\s*#(?!!)\s*(.*?)\s*$/) : line.match(/^\s*\/\/\s*(.*?)\s*$/)) ??
    (ext === 'php' ? line.match(/^\s*#(?!\[)\s*(.*?)\s*$/) : null) ??
    line.match(/^\s*\{?\/\*+\s*(.*?)\s*\*\/\}?\s*$/) ??
    (MARKUP.has(ext) || ext === 'php' ? line.match(/^\s*<!--\s*(.*?)\s*-->\s*$/) : null);
  return m?.[1];
}

function contentWords(comment: string): string[] {
  return (comment.toLowerCase().match(/[a-zà-ÿ]+/g) ?? []).filter((w) => w.length >= 3 && !STOP.has(w));
}

function codeParts(line: string): Set<string> {
  const parts = new Set<string>();
  for (const id of line.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
    for (const p of id.split(/(?<=[a-z0-9])(?=[A-Z])|[_$]+/)) if (p.length >= 2) parts.add(p.toLowerCase());
  }
  return parts;
}

function matches(word: string, parts: Set<string>): boolean {
  const w = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
  for (const p of parts) {
    if (p === w || p === word) return true;
    if (w.length >= 4 && p.length >= 4 && (p.startsWith(w) || w.startsWith(p))) return true;
  }
  const french = FRENCH.find(([stem]) => word.startsWith(stem));
  return french !== undefined && french[1].some((en) => parts.has(en));
}

// renvoie les commentaires paraphrases d'un fichier, ou undefined s'ils restent marginaux
export function paraphrasingComments(text: string, extension: string | null): Paraphrase[] | undefined {
  const lines = text.split('\n');
  const offsets: number[] = [];
  let at = 0;
  for (const l of lines) {
    offsets.push(at);
    at += l.length + 1;
  }
  const comments = lines.map((l) => commentOf(l, extension));

  let eligible = 0;
  const found: Paraphrase[] = [];
  for (let i = 0; i < lines.length; i++) {
    const comment = comments[i];
    // un bloc de plusieurs lignes explique, il ne paraphrase pas
    if (comment === undefined || (i > 0 && comments[i - 1] !== undefined)) continue;
    if (TOOLING.test(comment) || /[;{}=()<>]/.test(comment)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length || comments[j] !== undefined || j - i > 2) continue;
    const words = contentWords(comment);
    if (words.length < 2 || words.length > 8) continue;
    eligible++;
    const parts = codeParts(lines[j]);
    const hit = words.filter((w) => matches(w, parts)).length;
    if (hit / words.length >= 0.66) {
      found.push({
        start: offsets[i],
        end: offsets[i] + lines[i].length,
        codeEnd: offsets[j] + lines[j].length,
      });
    }
  }
  return found.length >= 3 && eligible >= 4 && found.length / eligible >= 0.3 ? found : undefined;
}
