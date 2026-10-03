import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { LLM_DIR, LLM_MODELS_FILE } from '../../../shared/config/paths.js';
import type {
  LikelihoodMeasure,
  LikelihoodScorer,
  LikelihoodStatus,
} from '../../domain/likelihood/likelihood-scorer.js';

const MAX_TOKENS = 400;
const CONTEXT_SIZE = 512;
const TOP_K = 256;
const IDLE_UNLOAD_MS = 10 * 60 * 1000;

// node-llama-cpp est un module ESM : import() natif malgré la compilation en CommonJS
const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

interface Loaded {
  model: any;
  name: string;
  vocabulary: number;
}

interface TokenOutput {
  next?: { logits?: Map<number, number>; totalLogitWeight?: number };
}

@Injectable()
export class LlamaLikelihoodScorer implements LikelihoodScorer, OnModuleDestroy {
  private readonly logger = new Logger('Modèle');
  private loading: Promise<Loaded | null> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer: NodeJS.Timeout | null = null;
  private state: LikelihoodStatus = process.env.AIDETECTOR_MODEL === 'off' ? 'disabled' : 'idle';

  status(): LikelihoodStatus {
    return this.state;
  }

  modelName(): string | null {
    if (this.state === 'disabled') return null;
    const uri = modelUris()[0];
    return uri ? modelName(uri) : null;
  }

  measure(text: string): Promise<LikelihoodMeasure | null> {
    if (this.state === 'disabled') return Promise.resolve(null);
    const run = this.queue.then(() => this.run(text));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async onModuleDestroy(): Promise<void> {
    await this.unload();
  }

  private async run(text: string): Promise<LikelihoodMeasure | null> {
    const loaded = await this.load();
    if (!loaded) return null;
    this.scheduleUnload();
    const started = Date.now();
    const tokens: number[] = loaded.model.tokenize(text).slice(0, MAX_TOKENS);
    if (tokens.length < 8) return null;

    const context = await loaded.model.createContext({ contextSize: CONTEXT_SIZE });
    try {
      const sequence = context.getSequence();
      const input = tokens.map((token, i) =>
        i < tokens.length - 1
          ? [
              token,
              {
                generateNext: {
                  logits: { filter: { tokens: [tokens[i + 1]], includeTop: TOP_K } },
                  totalLogitWeight: true,
                  options: { temperature: 1, topK: 0, topP: 1, minP: 0 },
                },
              },
            ]
          : token,
      );
      const outputs: (TokenOutput | undefined)[] = await sequence.controlledEvaluate(input);

      let logLikelihood = 0;
      let expected = 0;
      let variance = 0;
      let counted = 0;
      for (let i = 0; i < tokens.length - 1; i++) {
        const next = outputs[i]?.next;
        if (!next?.logits || !next.totalLogitWeight) continue;
        const stats = positionStats(next.logits, next.totalLogitWeight, tokens[i + 1], loaded.vocabulary);
        if (!stats) continue;
        logLikelihood += stats.logProb;
        expected += stats.mean;
        variance += stats.variance;
        counted++;
      }
      if (counted === 0 || variance <= 0) return null;

      return {
        model: loaded.name,
        tokens: counted + 1,
        meanLogProb: logLikelihood / counted,
        meanEntropy: -expected / counted,
        criterion: (logLikelihood - expected) / Math.sqrt(variance),
        elapsedMs: Date.now() - started,
      };
    } finally {
      await context.dispose();
    }
  }

  private load(): Promise<Loaded | null> {
    if (!this.loading) {
      this.loading = this.loadModel().then((loaded) => {
        if (!loaded) this.loading = null;
        return loaded;
      });
    }
    return this.loading;
  }

  private async loadModel(): Promise<Loaded | null> {
    const nlc = await esmImport('node-llama-cpp');
    const uris = modelUris();
    for (const uri of uris) {
      let path: string;
      try {
        path = await nlc.resolveModelFile(uri, { directory: LLM_DIR, download: false, cli: false });
      } catch {
        continue;
      }
      try {
        const started = Date.now();
        const llama = await nlc.getLlama();
        const model = await llama.loadModel({ modelPath: path });
        const name = modelName(uri);
        this.state = 'ready';
        this.logger.log(`${name} chargé en ${((Date.now() - started) / 1000).toFixed(1)} s`);
        return { model, name, vocabulary: model.fileInsights?.vocabularySize ?? 151_936 };
      } catch (err) {
        this.state = 'error';
        this.logger.error(`chargement impossible (${uri}) : ${err instanceof Error ? err.message : err}`);
        return null;
      }
    }
    this.state = 'missing';
    this.logger.warn('aucun modèle trouvé dans server/data/llm (lancer le lanceur pour le télécharger)');
    return null;
  }

  private scheduleUnload(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => void this.unload(), IDLE_UNLOAD_MS);
    this.idleTimer.unref();
  }

  private async unload(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const loading = this.loading;
    this.loading = null;
    const loaded = await loading;
    if (!loaded) return;
    await this.queue;
    await loaded.model.dispose();
    this.state = 'idle';
    this.logger.log(`${loaded.name} libéré (inactif)`);
  }
}

export function modelUris(): string[] {
  if (process.env.AIDETECTOR_MODEL && process.env.AIDETECTOR_MODEL !== 'off')
    return [process.env.AIDETECTOR_MODEL];
  try {
    return (JSON.parse(readFileSync(LLM_MODELS_FILE, 'utf8')) as { likelihood: string[] }).likelihood;
  } catch {
    return [];
  }
}

function modelName(uri: string): string {
  const repo = uri.split('/').pop() ?? uri;
  return repo.split(':')[0].replace(/-GGUF$/i, '');
}

export function positionStats(
  logits: Map<number, number>,
  totalWeight: number,
  actual: number,
  vocabulary: number,
): { logProb: number; mean: number; variance: number } | null {
  const actualLogit = logits.get(actual);
  const maxLogit = logits.values().next().value;
  if (actualLogit === undefined || maxLogit === undefined) return null;
  const logZ = maxLogit + Math.log(totalWeight);

  let mass = 0;
  let s1 = 0;
  let s2 = 0;
  let kept = 0;
  for (const logit of logits.values()) {
    const lp = logit - logZ;
    const p = Math.exp(lp);
    mass += p;
    s1 += p * lp;
    s2 += p * lp * lp;
    kept++;
  }
  // masse résiduelle hors top-K : répartie uniformément sur le reste du vocabulaire
  const tail = 1 - mass;
  if (tail > 1e-9 && vocabulary > kept) {
    const lp = Math.log(tail / (vocabulary - kept));
    s1 += tail * lp;
    s2 += tail * lp * lp;
  }
  return { logProb: actualLogit - logZ, mean: s1, variance: Math.max(0, s2 - s1 * s1) };
}
