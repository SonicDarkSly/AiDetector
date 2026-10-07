import type { ProjectCommit } from '../document/source-document.js';
import {
  NO_SIGNAL,
  type DetectionContext,
  type DetectorResult,
  type Signal,
  type SignalDetector,
} from '../signal/signal.js';
import type { Vendor, VendorHint } from '../signal/vendor.js';
import { assistantToolOf } from './assistant-files.js';

interface CommitRule {
  re: RegExp;
  tool: string;
  vendor?: Vendor;
}

// testées sur « auteur <e-mail> » suivi du message complet (lignes Co-authored-by comprises)
const COMMIT_RULES: CommitRule[] = [
  {
    re: /co-authored-by:[^\n]*(claude|anthropic)|generated with \[?claude code|noreply@anthropic\.com/i,
    tool: 'Claude Code',
    vendor: 'claude',
  },
  { re: /copilot-swe-agent|co-authored-by:[^\n]*copilot/i, tool: 'GitHub Copilot', vendor: 'copilot' },
  {
    re: /chatgpt-codex-connector|co-authored-by:[^\n]*\bcodex\b/i,
    tool: 'Codex (OpenAI)',
    vendor: 'chatgpt',
  },
  { re: /google-labs-jules|co-authored-by:[^\n]*\bjules\b/i, tool: 'Jules (Google)', vendor: 'gemini' },
  { re: /co-authored-by:[^\n]*gemini/i, tool: 'Gemini', vendor: 'gemini' },
  { re: /cursoragent@cursor\.com|co-authored-by:[^\n]*cursor/i, tool: 'Cursor' },
  { re: /\(aider\)|^aider: /im, tool: 'Aider' },
  { re: /devin-ai-integration/i, tool: 'Devin' },
  {
    re: /generated (?:by|with) (?:an? )?(?:ai\b|chatgpt|gpt-?\d|copilot|cursor|gemini|windsurf)/i,
    tool: 'assistant non précisé',
  },
];

const firstLine = (message: string) => message.split('\n')[0].trim().slice(0, 90);

function vendorHints(vendors: (Vendor | undefined)[]): VendorHint[] | undefined {
  const unique = [...new Set(vendors.filter((v): v is Vendor => v !== undefined))];
  return unique.length ? unique.map((vendor) => ({ vendor, weight: 3 })) : undefined;
}

export class ProjectDetector implements SignalDetector {
  readonly name = 'project';

  detect({ doc }: DetectionContext): DetectorResult {
    const project = doc.project;
    if (!project) return NO_SIGNAL;
    const signals: Signal[] = [];

    const configs = project.assistantFiles.map((path) => ({ path, ...assistantToolOf(path)! }));
    const transcripts = configs.filter((c) => c.transcript);
    if (transcripts.length > 0) {
      signals.push({
        id: 'project-assistant-transcript',
        category: 'project',
        label: `Conversations avec un assistant enregistrées dans le projet (${[...new Set(transcripts.map((c) => c.tool))].join(', ')})`,
        detail:
          "L'archive contient l'historique des échanges avec un assistant de code : le code a été écrit, au moins en partie, par l'IA. Ouvrez ces fichiers pour voir ce qui lui a été demandé.",
        strength: 'fort',
        direction: 'ia',
        points: 40,
        vendors: vendorHints(transcripts.map((c) => c.vendor)),
        evidence: transcripts.slice(0, 6).map((c) => c.path),
        count: transcripts.length,
      });
    }
    const settings = configs.filter((c) => !c.transcript);
    if (settings.length > 0) {
      const tools = [...new Set(settings.map((c) => c.tool))];
      signals.push({
        id: 'project-assistant-files',
        category: 'project',
        label: `Fichiers de configuration d'assistant IA (${tools.join(', ')})`,
        detail:
          "Le projet contient des fichiers que seuls les assistants de code lisent (CLAUDE.md, AGENTS.md, .cursorrules, instructions Copilot…) : il a été développé avec leur aide. Cela ne dit pas quels fichiers l'IA a écrits, ni dans quelle proportion.",
        strength: 'fort',
        direction: 'ia',
        points: 30,
        vendors: vendorHints(settings.map((c) => c.vendor)),
        evidence: settings.slice(0, 6).map((c) => `${c.path} (${c.tool})`),
        count: settings.length,
      });
    }

    if (project.commits) signals.push(...this.commitSignals(project.commits));
    else
      signals.push({
        id: 'project-git-missing',
        category: 'project',
        label: project.gitError ? 'Historique git illisible' : "Pas d'historique git dans l'archive",
        detail: project.gitError
          ? `Le dossier .git est présent mais n'a pas pu être lu (${project.gitError}).`
          : 'Incluez le dossier caché .git dans le .zip : les commits signés par un assistant sont parmi les preuves les plus fiables pour un projet.',
        strength: 'info',
        direction: 'neutre',
        points: 0,
      });
    return { signals, highlights: [] };
  }

  private commitSignals(commits: ProjectCommit[]): Signal[] {
    const matched = new Map<string, { rule: CommitRule; commits: ProjectCommit[] }>();
    for (const c of commits) {
      const haystack = `${c.author} <${c.email}>\n${c.message}`;
      const rule = COMMIT_RULES.find((r) => r.re.test(haystack));
      if (!rule) continue;
      const m = matched.get(rule.tool) ?? { rule, commits: [] };
      m.commits.push(c);
      matched.set(rule.tool, m);
    }
    if (matched.size === 0) {
      return [
        {
          id: 'project-git-clean',
          category: 'project',
          label: `Historique git : aucun commit signé par un assistant (${commits.length} lus)`,
          detail:
            "Claude Code, l'agent Copilot, Cursor, Aider… signent souvent leurs commits. Leur absence ne prouve rien : un assistant dans l'éditeur ou du code copié depuis un chat n'en laissent pas, et la signature peut être retirée.",
          strength: 'info',
          direction: 'neutre',
          points: 0,
        },
      ];
    }
    const groups = [...matched.values()];
    const total = groups.reduce((a, g) => a + g.commits.length, 0);
    return [
      {
        id: 'project-git-assistant',
        category: 'project',
        label: `Commits signés par un assistant IA : ${total} sur ${commits.length} (${groups.map((g) => g.rule.tool).join(', ')})`,
        detail:
          "L'assistant a laissé sa signature dans l'historique git (ligne « Co-authored-by », auteur robot, mention « Generated with… ») : ces commits ont été écrits ou préparés par l'IA. La proportion de commits signés donne un ordre de grandeur de sa part dans le projet.",
        strength: 'fort',
        direction: 'ia',
        points: 40,
        vendors: vendorHints(groups.map((g) => g.rule.vendor)),
        evidence: groups
          .flatMap((g) => g.commits.slice(0, 2).map((c) => `${g.rule.tool} : « ${firstLine(c.message)} »`))
          .slice(0, 5),
        count: total,
      },
    ];
  }
}
