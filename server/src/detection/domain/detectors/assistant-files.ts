import type { Vendor } from '../signal/vendor.js';

export interface AssistantTool {
  tool: string;
  vendor?: Vendor;
  // historique de conversation enregistré, pas seulement une configuration
  transcript?: boolean;
}

const ASSISTANT_PATHS: [RegExp, AssistantTool][] = [
  [/(^|\/)CLAUDE(\.local)?\.md$/i, { tool: 'Claude Code', vendor: 'claude' }],
  [/(^|\/)\.claude\//, { tool: 'Claude Code', vendor: 'claude' }],
  [/(^|\/)GEMINI\.md$/i, { tool: 'Gemini CLI', vendor: 'gemini' }],
  [/(^|\/)\.gemini\//, { tool: 'Gemini CLI', vendor: 'gemini' }],
  [/(^|\/)\.codex\//, { tool: 'Codex (OpenAI)', vendor: 'chatgpt' }],
  [/(^|\/)\.github\/copilot-instructions\.md$/, { tool: 'GitHub Copilot', vendor: 'copilot' }],
  [
    /(^|\/)\.github\/(instructions|prompts|chatmodes)\/[^/]+\.md$/,
    { tool: 'GitHub Copilot', vendor: 'copilot' },
  ],
  [/(^|\/)AGENTS\.md$/i, { tool: 'Agents de code (AGENTS.md)' }],
  [/(^|\/)\.cursorrules$/, { tool: 'Cursor' }],
  [/(^|\/)\.cursor\//, { tool: 'Cursor' }],
  [/(^|\/)\.windsurfrules$/, { tool: 'Windsurf' }],
  [/(^|\/)\.windsurf\//, { tool: 'Windsurf' }],
  [/(^|\/)\.clinerules/, { tool: 'Cline' }],
  [/(^|\/)\.roo(modes|rules)?(\/|$)/, { tool: 'Roo Code' }],
  [/(^|\/)\.aider\.(chat|input)\.history/, { tool: 'Aider', transcript: true }],
  [/(^|\/)\.aider[^/]*$/, { tool: 'Aider' }],
  [/(^|\/)\.continue\//, { tool: 'Continue' }],
  [/(^|\/)\.kiro\//, { tool: 'Kiro' }],
  [/(^|\/)\.junie\//, { tool: 'Junie (JetBrains)' }],
  [/(^|\/)\.specstory\//, { tool: 'SpecStory', transcript: true }],
  [/(^|\/)\.mcp\.json$/, { tool: 'Serveurs MCP pour assistant' }],
];

export function assistantToolOf(path: string): AssistantTool | undefined {
  return ASSISTANT_PATHS.find(([re]) => re.test(path))?.[1];
}
