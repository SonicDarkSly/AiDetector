import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { activeCalibration, type Calibration } from '../../domain/likelihood/calibration.js';
import {
  CALIBRATION_STORE,
  type Answer,
  type CalibrationStore,
} from '../../domain/likelihood/calibration.store.js';
import { MIN_ANSWERS, propose, usableAnswers, type Proposal } from '../../domain/likelihood/recalibration.js';
import { LIKELIHOOD_SCORER, type LikelihoodScorer } from '../../domain/likelihood/likelihood-scorer.js';

export interface CalibrationStatus {
  active: Calibration;
  answers: { ai: number; human: number; unused: number; vendors: Record<string, number> };
  minimum: number;
  proposal: Proposal | null;
}

export class GetCalibrationQuery {}

@QueryHandler(GetCalibrationQuery)
export class GetCalibrationHandler implements IQueryHandler<GetCalibrationQuery, CalibrationStatus> {
  private cache: { key: string; proposal: Proposal | null } | null = null;

  constructor(
    @Inject(CALIBRATION_STORE) private readonly store: CalibrationStore,
    @Inject(LIKELIHOOD_SCORER) private readonly scorer: LikelihoodScorer,
  ) {}

  async execute(): Promise<CalibrationStatus> {
    const answers = Object.values(await this.store.answers());
    const active = activeCalibration();
    const model = this.scorer.modelName();
    const key = `${model}|${active.appliedAt}|${answers.map((a) => a.at).join(',')}`;
    if (this.cache?.key !== key) {
      this.cache = { key, proposal: propose(await this.store.baseSamples(), answers, active, model) };
    }
    const prose = usableAnswers(answers, model);
    const vendors: Record<string, number> = {};
    for (const a of prose)
      if (a.label === 'ai') vendors[a.vendor ?? 'autre'] = (vendors[a.vendor ?? 'autre'] ?? 0) + 1;
    return {
      active,
      answers: {
        ai: prose.filter((a) => a.label === 'ai').length,
        human: prose.filter((a) => a.label === 'human').length,
        unused: answers.length - prose.length,
        vendors,
      },
      minimum: MIN_ANSWERS,
      proposal: this.cache.proposal,
    };
  }
}

export class GetAnswerQuery {
  constructor(readonly reportId: string) {}
}

@QueryHandler(GetAnswerQuery)
export class GetAnswerHandler implements IQueryHandler<GetAnswerQuery, Answer | null> {
  constructor(@Inject(CALIBRATION_STORE) private readonly store: CalibrationStore) {}

  async execute({ reportId }: GetAnswerQuery): Promise<Answer | null> {
    return (await this.store.answers())[reportId] ?? null;
  }
}
