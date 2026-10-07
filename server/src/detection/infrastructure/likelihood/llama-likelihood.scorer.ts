import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { readFileSync, statSync } from 'node:fs';
import { LLM_DIR, LLM_MODELS_FILE } from '../../../shared/config/paths.js';
import { CALIBRATION } from '../../domain/likelihood/calibration.js';
import type {
  ActiveModel,
  LanguageModelInfo,
  LikelihoodMeasure,
  LikelihoodScorer,
  LikelihoodStatus,
  ModelActivity,
} from '../../domain/likelihood/likelihood-scorer.js';

const MAX_TOKENS = CALIBRATION.maxTokens;
const CONTEXT_SIZE = 512;
const TOP_K = 256;
const IDLE_UNLOAD_MS = 2 * 60 * 1000;

// node-llama-cpp est un module ESM : import() natif malgré la compilation en CommonJS
const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

interface Loaded {
  model: any;
  name: string;
  vocabulary: number;
  // observateur Binoculars (même modèle, version de base) ; absent s'il n'est pas téléchargé
  observer: any | null;
  models: ActiveModel[];
  gpu: string | null;
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
  private current: ModelActivity | null = null;
  private state: LikelihoodStatus = process.env.MEFIANCE_MODEL === 'off' ? 'disabled' : 'idle';

  status(): LikelihoodStatus {
    return this.state;
  }

  activity(): ModelActivity | null {
    return this.current;
  }

  async describe(): Promise<LanguageModelInfo> {
    const uri = modelUris()[0] ?? null;
    let sizeBytes: number | null = null;
    if (uri && this.state !== 'disabled') {
      try {
        const nlc = await esmImport('node-llama-cpp');
        for (const candidate of modelUris()) {
          try {
            const path = await nlc.resolveModelFile(candidate, {
              directory: LLM_DIR,
              download: false,
              cli: false,
            });
            sizeBytes = statSync(path).size;
            break;
          } catch {
            continue;
          }
        }
        if (sizeBytes === null && this.state === 'idle') this.state = 'missing';
      } catch {
        sizeBytes = null;
      }
    }
    const name = uri ? modelName(uri) : null;
    return {
      name,
      status: this.state,
      parameters: name?.match(/(\d+(?:\.\d+)?)B\b/i)?.[1]?.replace('.', ',') ?? null,
      quantization:
        uri
          ?.split(':')
          .pop()
          ?.match(/^Q\w+$/i)?.[0] ?? null,
      sizeBytes,
      maxTokens: MAX_TOKENS,
      minTokens: CALIBRATION.minTokens,
      contextSize: CONTEXT_SIZE,
    };
  }

  modelName(): string | null {
    if (this.state === 'disabled') return null;
    const uri = modelUris()[0];
    return uri ? modelName(uri) : null;
  }

  async measure(text: string): Promise<LikelihoodMeasure | null> {
    return (await this.measurePrefixes(text))[0] ?? null;
  }

  // mesures sur les premiers tokens du texte, en une seule passe (constitution du corpus de calibration)
  measurePrefixes(text: string, lengths?: number[]): Promise<LikelihoodMeasure[]> {
    if (this.state === 'disabled') return Promise.resolve([]);
    const run = this.queue.then(() => this.run(text, lengths));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async onModuleDestroy(): Promise<void> {
    await this.unload();
  }

  private async run(text: string, lengths?: number[]): Promise<LikelihoodMeasure[]> {
    try {
      return await this.evaluate(text, lengths);
    } finally {
      this.current = null;
    }
  }

  private async evaluate(text: string, lengths?: number[]): Promise<LikelihoodMeasure[]> {
    if (this.state !== 'ready') {
      const planned: ActiveModel[] = [
        { name: this.modelName() ?? '', role: 'performer', sizeBytes: null },
        ...observerUris()
          .slice(0, 1)
          .map((uri): ActiveModel => ({ name: modelName(uri), role: 'observer', sizeBytes: null })),
      ];
      this.current = {
        phase: 'loading',
        model: planned.map((m) => m.name).join(' + '),
        tokens: null,
        since: Date.now(),
        step: 0,
        steps: planned.length,
        models: planned,
        gpu: null,
      };
    }
    const loaded = await this.load();
    if (!loaded) return [];
    this.scheduleUnload();
    const started = Date.now();
    const tokens: number[] = loaded.model.tokenize(text).slice(0, MAX_TOKENS);
    if (tokens.length < 8) return [];
    const steps = loaded.observer ? 2 : 1;
    const observerModel = loaded.models.find((m) => m.role === 'observer');
    if (loaded.observer && observerModel) {
      this.current = {
        phase: 'observing',
        model: observerModel.name,
        tokens: tokens.length,
        since: Date.now(),
        step: 1,
        steps,
        models: loaded.models,
        gpu: loaded.gpu,
      };
    }

    // Binoculars : ce que le modèle de base attendait à chaque position (ses TOP_K tokens les plus probables)
    const observed = loaded.observer ? await observe(loaded.observer, tokens) : null;
    this.current = {
      phase: 'measuring',
      model: loaded.name,
      tokens: tokens.length,
      since: Date.now(),
      step: steps,
      steps,
      models: loaded.models,
      gpu: loaded.gpu,
    };

    const context = await loaded.model.createContext({ contextSize: CONTEXT_SIZE });
    try {
      const sequence = context.getSequence();
      const input = tokens.map((token, i) =>
        i < tokens.length - 1
          ? [
              token,
              {
                generateNext: {
                  logits: {
                    filter: {
                      tokens: [tokens[i + 1], ...(observed?.[i]?.top.keys() ?? [])],
                      includeTop: TOP_K,
                    },
                  },
                  totalLogitWeight: true,
                  options: { temperature: 1, topK: 0, topP: 1, minP: 0 },
                },
              },
            ]
          : token,
      );
      const outputs: (TokenOutput | undefined)[] = await sequence.controlledEvaluate(input);

      const positions: { at: number; logProb: number; mean: number; variance: number }[] = [];
      const crossed: { at: number; logPpl: number; xPpl: number }[] = [];
      for (let i = 0; i < tokens.length - 1; i++) {
        const next = outputs[i]?.next;
        if (!next?.logits || !next.totalLogitWeight) continue;
        // les trois mesures ne voient que le top-K et le token écrit, comme lors de la calibration
        const own = topWith(next.logits, tokens[i + 1]);
        const stats = positionStats(own, next.totalLogitWeight, tokens[i + 1], loaded.vocabulary);
        if (stats) positions.push({ at: i, ...stats });
        const seen = observed?.[i];
        const cross = seen ? crossEntropy(seen, next.logits, next.totalLogitWeight) : null;
        if (stats && cross !== null) crossed.push({ at: i, logPpl: -stats.logProb, xPpl: cross });
      }
      const elapsedMs = Date.now() - started;

      const measures: LikelihoodMeasure[] = [];
      // un texte plus court que la longueur demandée est mesuré en entier, une seule fois
      const sizes = [...new Set((lengths ?? [tokens.length]).map((l) => Math.min(l, tokens.length)))];
      for (const length of sizes) {
        let logLikelihood = 0;
        let expected = 0;
        let variance = 0;
        let counted = 0;
        for (const p of positions) {
          if (p.at >= length - 1) break;
          logLikelihood += p.logProb;
          expected += p.mean;
          variance += p.variance;
          counted++;
        }
        if (counted === 0 || variance <= 0) continue;
        const kept = crossed.filter((c) => c.at < length - 1);
        const mean = (key: 'logPpl' | 'xPpl') => kept.reduce((a, c) => a + c[key], 0) / kept.length;
        measures.push({
          model: loaded.name,
          tokens: counted + 1,
          meanLogProb: logLikelihood / counted,
          meanEntropy: -expected / counted,
          criterion: (logLikelihood - expected) / Math.sqrt(variance),
          binoculars: kept.length ? mean('logPpl') / mean('xPpl') : undefined,
          elapsedMs,
        });
      }
      return measures;
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
        const loadedObserver = await this.loadObserver(nlc, llama, model);
        const observer = loadedObserver?.model ?? null;
        this.state = 'ready';
        this.logger.log(
          `${name} chargé en ${((Date.now() - started) / 1000).toFixed(1)} s${observer ? ', avec son observateur Binoculars' : ''}`,
        );
        const models: ActiveModel[] = [
          { name, role: 'performer', sizeBytes: fileSize(path) },
          ...(loadedObserver
            ? [
                {
                  name: loadedObserver.name,
                  role: 'observer' as const,
                  sizeBytes: fileSize(loadedObserver.path),
                },
              ]
            : []),
        ];
        return {
          model,
          name,
          vocabulary: model.fileInsights?.vocabularySize ?? 151_936,
          observer,
          models,
          gpu: typeof llama.gpu === 'string' ? llama.gpu : null,
        };
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

  // modèle de base du même découpage ; sans lui, la décision repose sur les trois mesures seules
  private async loadObserver(
    nlc: any,
    llama: any,
    performer: any,
  ): Promise<{ model: any; name: string; path: string } | null> {
    for (const uri of observerUris()) {
      try {
        const path = await nlc.resolveModelFile(uri, { directory: LLM_DIR, download: false, cli: false });
        const observer = await llama.loadModel({ modelPath: path });
        const probe = 'Le barrage de Bergerac est un ouvrage hydraulique construit sur la Dordogne.';
        if (observer.tokenize(probe).join() === performer.tokenize(probe).join()) {
          return { model: observer, name: modelName(uri), path };
        }
        this.logger.warn(`observateur Binoculars ignoré (${uri}) : découpage en tokens différent`);
        await observer.dispose();
      } catch {
        continue;
      }
    }
    this.logger.warn('observateur Binoculars absent : décision sur les trois mesures (relancer le lanceur)');
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
    await loaded.observer?.dispose();
    await loaded.model.dispose();
    this.state = 'idle';
    this.logger.log(`${loaded.name} libéré (inactif)`);
  }
}

export function modelUris(): string[] {
  if (process.env.MEFIANCE_MODEL && process.env.MEFIANCE_MODEL !== 'off') return [process.env.MEFIANCE_MODEL];
  try {
    return (JSON.parse(readFileSync(LLM_MODELS_FILE, 'utf8')) as { likelihood: string[] }).likelihood;
  } catch {
    return [];
  }
}

export function observerUris(): string[] {
  if (process.env.MEFIANCE_MODEL) return [];
  try {
    return (
      (JSON.parse(readFileSync(LLM_MODELS_FILE, 'utf8')) as { binocularsObserver?: string[] })
        .binocularsObserver ?? []
    );
  } catch {
    return [];
  }
}

interface Observed {
  // probabilités de l'observateur sur ses TOP_K tokens, renormalisées
  top: Map<number, number>;
}

async function observe(observer: any, tokens: number[]): Promise<(Observed | null)[]> {
  const context = await observer.createContext({ contextSize: CONTEXT_SIZE });
  try {
    const input = tokens.map((token, i) =>
      i < tokens.length - 1
        ? [
            token,
            {
              generateNext: {
                logits: { filter: { includeTop: TOP_K } },
                totalLogitWeight: true,
                options: { temperature: 1, topK: 0, topP: 1, minP: 0 },
              },
            },
          ]
        : token,
    );
    const outputs: (TokenOutput | undefined)[] = await context.getSequence().controlledEvaluate(input);
    return outputs.slice(0, tokens.length - 1).map((o) => {
      const next = o?.next;
      if (!next?.logits || !next.totalLogitWeight) return null;
      const logZ = (next.logits.values().next().value ?? 0) + Math.log(next.totalLogitWeight);
      const top = new Map([...next.logits].map(([token, logit]) => [token, Math.exp(logit - logZ)]));
      const mass = [...top.values()].reduce((a, p) => a + p, 0);
      for (const [token, p] of top) top.set(token, p / mass);
      return { top };
    });
  } finally {
    await context.dispose();
  }
}

// -Σ p_observateur(v) · log p_exécutant(v), sur le top-K de l'observateur
function crossEntropy(observed: Observed, logits: Map<number, number>, totalWeight: number): number | null {
  const logZ = (logits.values().next().value ?? 0) + Math.log(totalWeight);
  let cross = 0;
  for (const [token, p] of observed.top) {
    const logit = logits.get(token);
    if (logit === undefined) return null;
    cross -= p * (logit - logZ);
  }
  return cross;
}

// les TOP_K premiers logits (la Map est triée du plus grand au plus petit) et celui du token écrit
function topWith(logits: Map<number, number>, actual: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const [token, logit] of logits) {
    if (out.size >= TOP_K) break;
    out.set(token, logit);
  }
  const own = logits.get(actual);
  if (own !== undefined) out.set(actual, own);
  return out;
}

function fileSize(path: string): number | null {
  try {
    return statSync(path).size;
  } catch {
    return null;
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
