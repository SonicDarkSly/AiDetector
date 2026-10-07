# MefIAnce

[Français](README.md) · **English** · [Deutsch](README.de.md)

A local application that tells whether a text or a file comes from an AI (ChatGPT, Claude, Gemini, Copilot,
DeepSeek, Grok, Perplexity, Mistral's Vibe, Meta AI, Qwen...), and which one when possible. Everything is
analysed on your machine: no text or file is ever sent over the Internet.

The application's interface is in French; button and section names are quoted below in French, with their
English meaning.

## Getting started

Double-click the launcher for your system:

- macOS: `Lancer-MefIAnce-macOS.command`
- Windows: `Lancer-MefIAnce-Windows.bat`
- Linux: `Lancer-MefIAnce-Linux.sh`

On first launch, Node.js, the dependencies and the two analysis models (about 4 GB) are installed
automatically. The application opens at http://localhost:5174 and is also reachable from other devices on
the local network (the address is shown in the launcher window).

From the command line:

```bash
npm install
npm run dev
```

Accepted formats: pasted text, PDF, Word (.docx), TXT, Markdown, source code (25 MB maximum), a whole
project as a .zip including its hidden `.git` folder (100 MB maximum).

## Method

Three families of clues, scored separately so the application stays honest about what can be claimed.

### Technical evidence

Reliable when present, but easy to erase.

- **Metadata**: creator and producer tools of PDFs (ReportLab, WeasyPrint, headless Chrome...), XMP, Content
  Credentials (C2PA), IPTC field `trainedAlgorithmicMedia`, author of .docx files (`python-docx`, `Un-named`
  from the docx library), editing time, Word sessions (rsid), UTC clock.
- **Copy-and-paste traces**, specific to each assistant:

  | Assistant | Recognised markers                                                                                              |
  | --------- | --------------------------------------------------------------------------------------------------------------- |
  | ChatGPT   | `contentReference[oaicite]`, `【n†source】`, `turn0search`, `utm_source=chatgpt.com`, private characters U+E200 |
  | Gemini    | `[cite_start]`, `[cite: n]`                                                                                     |
  | Claude    | internal tags (`antArtifact`, `cite index`)                                                                     |
  | DeepSeek  | `<think>`, `[citation:n]`                                                                                       |
  | Copilot   | `[^n^]`                                                                                                         |
  | Grok      | `<grok:render>`                                                                                                 |
  | All       | share links, chatbot opening or closing sentences, `[Your name]`, raw Markdown                                  |

- **Hidden characters**: zero-width spaces, hidden messages in Unicode "tag" characters (decoded), Cyrillic
  letters disguised as Latin letters.

Markers from three or more assistants in the same text point to a document that talks about them (an
article, a guide): they then count only as weak clues.

### Text predictability

Two small local models, Qwen2.5 3B Instruct and its base version (Q4_K_M, about 2 GB each, GGUF through
node-llama-cpp), read the text, up to 250 tokens, without generating anything. They are loaded on demand and
released after 2 minutes without analysis.

- **From 50 tokens: Binoculars** (Hans et al., 2024). The score compares how surprising the text is with the
  "normal" surprise for what a model would have written in its place: the base model acts as the observer,
  the Instruct model as the performer. A human text that is merely formal is no longer mistaken for a
  generated one.
- **Below 50 tokens: three measures** from the Instruct model, combined: the mean log-probability of the
  words, the mean entropy (how much the model hesitates) and the Fast-DetectGPT criterion. On such a short
  text, Binoculars performs worse (10% versus 21% at 30 tokens).

Without the base model (not downloaded), the application falls back to the three measures at every length,
with lower rates (21 to 26%).

Calibrated on 640 French texts: 400 written by humans before 2022 (150 Wikipedia excerpts in their late-2021
version, 100 Wikinews articles, 150 Allociné film reviews) and 240 generated on the same topics and genres by
four assistants, 60 each: Claude (Sonnet and Opus), ChatGPT, Gemini and Mistral. For each length, the
threshold is set so that only 5% of human texts are wrongly flagged; rates are measured by cross-validation,
on texts never seen during training.

| Length (tokens) | Decision       | AI texts detected | Human texts wrongly flagged |
| --------------- | -------------- | ----------------- | --------------------------- |
| 30              | three measures | 21%               | 5%                          |
| 50              | Binoculars     | 24%               | 5%                          |
| 80              | Binoculars     | 29%               | 5%                          |
| 120             | Binoculars     | 29%               | 5%                          |
| 200             | Binoculars     | 37%               | 5%                          |

By assistant, from 80 tokens, Binoculars detects about 12% of Gemini texts, 28% of ChatGPT, 34% of Claude
and 53% of Mistral. False alarms are no longer concentrated on Wikipedia: about 7% of excerpts, 4% of news
articles and 3% of reviews (versus 10%, 2% and 0% with the three measures alone).

At this level of caution, the measure can **confirm** an AI but never clear a text: below the threshold, it
barely pushes towards "human" and is not enough to decide.

For a PDF or a Word file, only prose is measured (tables of contents, tables and code are left out). The
models are calibrated on prose only: a poem or verse (short lines, rhymes) is recognised, and its measure
never pushes towards "human".

### Calibration corpus

The corpus texts live in a private repository,
[SonicDarkSly/MefIAnce-corpus](https://github.com/SonicDarkSly/MefIAnce-corpus), mounted as a submodule at
`server/data/corpus/` (the licences of the human texts do not allow publishing them here). To fetch it, with a
GitHub account that has access to that repository: `git submodule update --init server/data/corpus`. The
Claude Code skills in `.claude/skills/` describe the procedures (fetch, add an assistant, recalibrate,
synchronise).

The scripts in `scripts/corpus/` rebuild or extend the corpus:

```bash
node scripts/corpus/fetch-human.mjs        # human texts from before 2022
node scripts/corpus/consignes.mjs          # prompts shared by all assistants (+ consignes.md)
node scripts/corpus/import.mjs chatgpt lot1.txt   # an assistant's answer to a batch of prompts
npm run build -w server
node scripts/corpus/measure.mjs            # three measures from the Instruct model, resumes where it stopped
node scripts/corpus/binoculars.mjs         # Binoculars score (base and Instruct), also resumes
node scripts/corpus/train.mjs              # compares calibrations
node scripts/corpus/export.mjs             # server/calibration-samples.json, rewrites the default calibration
```

### Learning

At the bottom of the verdict, « Apprentissage » (Learning) lets you state where a text really comes from (AI,
and which one, or human). Only the measures (the three measures, the Binoculars score and the length) are kept
in `server/data/answers.json`, never the text. From 20 answers on prose, the application proposes a
recalibration: current and proposed rates measured by cross-validation, and how many of your answers each one
classifies correctly. Nothing is applied without your consent, and the default calibration remains available.
An answer is only valid for the model that made the measure; answers given before the switch to three
measures no longer count. The measures of the original corpus (without the texts) are in
`server/calibration-samples.json`.

### Whole project (.zip)

For code, the strongest evidence lies around the files, not inside them. A .zip archive of a project
(dependencies, `dist`, `build`… are ignored) is analysed file by file, looking for:

- **assistant configuration files**: `CLAUDE.md`, `.claude/`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`,
  `.cursor/`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`, `.aider*`, `.kiro/`,
  `.junie/`…;
- **saved conversation histories** (`.aider.chat.history.md`, `.specstory/`);
- **commits signed by an assistant** in the git history (last 1,000): `Co-authored-by: Claude`, "Generated
  with Claude Code", Copilot agent, Codex, Jules, Cursor, Aider, Devin. The history is read without needing
  git on the machine (isomorphic-git).

These traces prove that an assistant was used in the project, not which files it wrote. Their absence proves
nothing: an assistant inside the editor, or code copied from a chat, leaves none.

### Source code

The language model does not measure code. Clues come from comments: typography that cannot be typed on a
keyboard (long dashes, arrows, « » quotation marks, ellipses), file headers in the form "ROLE — description",
chatbot sentences, placeholders (`YOUR_API_KEY`, `# Example usage`), emojis in logs, comments that repeat the
next line ("// Gets the user" above `getUser()`, a weak clue: 0.2% of files flagged out of 1,719 open-source
library files). Measured on 70 files written by Claude and 225 open-source library files: 54 AI files out of
70 above 50%, no human file.

### Style and rhythm

Over-represented vocabulary, recurring phrasings, long dashes, regular sentence lengths. Tendencies only:
style alone never goes above about 60%.

### Publisher watermarks

To comply with Article 50 of the EU AI Act, publishers mark generated texts:

| Assistant         | Since                                      | Verification                               |
| ----------------- | ------------------------------------------ | ------------------------------------------ |
| Claude            | 2 August 2026, recent models, worldwide    | Anthropic interface, restricted access     |
| ChatGPT and Codex | October 2026, European Union ("textGrain") | detector reserved for approved researchers |
| Gemini            | 2024 (SynthID Text)                        | no public service for text                 |

This is not a hidden character but a slight statistical bias in word choice, computed with a secret key: only
the publisher can read it. The application does not send the text off to be checked. It shows an
informational clue (with no effect on the score) that explains this and says whether the text would be long
enough for a watermark to be readable: about 80% detection at 200 tokens and 95% at 400 according to OpenAI,
for 1% false alarms. Rewriting, translation or edits erase it; it is weak on code. Its absence does not prove
that a human wrote the text.

## Reading the result

- **Verdict**: overall score, technical evidence, text predictability, style. Without usable traces on a
  short text, the verdict is "cannot be determined", with an indicative tendency.
- **Which tool?**: software identified in the metadata, and the share of each assistant. The tool declared by
  the file (metadata, C2PA) takes precedence over markers in the text. Without a clear trace, the assistant is
  "not identifiable": no tool can honestly say which one wrote a cleanly copied text.
- **Clues found**, **Metadata**, **Statistics**, **Analysed text** (highlighted and labelled passages, invisible
  characters, a cleaned version to copy).
- **Layout**: grid, single column or summary. The « Organiser » (Arrange) button lets you place the blocks by
  drag and drop: up to three side by side on a row, stacked in a cell, or alone on a full-width row. The
  layout is remembered for each mode.

## Limitations

- No trace does not mean human: an AI text that was edited or rephrased can go unnoticed.
- A human with a very academic style can get a high score. Never accuse anyone on the basis of a score.
- Metadata disappears when a file is saved again, printed or captured.
- The invisible watermarks of Claude, ChatGPT and Gemini can only be read by their publisher. The invisible
  characters spotted by the application are something else.

## Architecture

npm monorepo (`server`, `client`).

- `server`: NestJS 11, DDD / CQRS structure (`@nestjs/cqrs`)
  - `detection/domain`: `Analysis` aggregate, signal detectors, verdict and attribution policies
  - `detection/application`: commands, queries, event handlers
  - `detection/infrastructure`: PDF (pdfjs-dist) / DOCX / text reading, model measurement, history
  - `detection/presentation`: HTTP API
- `client`: React 18, Vite 6, Ant Design 5

API: `POST /api/analyze/text`, `POST /api/analyze/file`, `GET /api/model`, `GET /api/model/activity`,
`GET /api/calibration`, `POST /api/calibration/apply`, `POST /api/calibration/reset`,
`GET|PUT|DELETE /api/reports/:id/answer`, `GET /api/reports`, `GET /api/reports/:id`,
`DELETE /api/reports/:id`, `DELETE /api/reports`, `GET /api/health`.

Analyses are kept in `server/data/reports` (200 at most).

Environment variable: `MEFIANCE_MODEL=off` disables the models, `MEFIANCE_MODEL=<uri or path>` forces another
one (without the Binoculars observer: decision on the three measures).
