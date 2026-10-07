import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';
import {
  CALIBRATION_STORE,
  type Answer,
  type AnswerLabel,
  type CalibrationStore,
} from '../../domain/likelihood/calibration.store.js';

export class AnswerNotPossibleError extends Error {}

export class SetAnswerCommand {
  constructor(
    readonly reportId: string,
    readonly label: AnswerLabel | null,
    readonly vendor: string | null = null,
  ) {}
}

@CommandHandler(SetAnswerCommand)
export class SetAnswerHandler implements ICommandHandler<SetAnswerCommand, Answer | null> {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository,
    @Inject(CALIBRATION_STORE) private readonly store: CalibrationStore,
  ) {}

  async execute({ reportId, label, vendor }: SetAnswerCommand): Promise<Answer | null> {
    const answers = await this.store.answers();
    if (label === null) {
      delete answers[reportId];
      await this.store.saveAnswers(answers);
      return null;
    }
    const usage = (await this.repository.findById(reportId))?.snapshot().languageModel;
    if (usage?.status !== 'used' || usage.meanLogProb === undefined || !usage.tokens) {
      throw new AnswerNotPossibleError("cette analyse n'a pas de mesure du modèle de langage");
    }
    if (usage.meanEntropy === undefined || usage.criterion === undefined) {
      throw new AnswerNotPossibleError(
        'analyse faite avant la mise à jour de la mesure : relancez-la pour pouvoir répondre',
      );
    }
    const answer: Answer = {
      label,
      vendor: label === 'ai' ? vendor : null,
      tokens: usage.tokens,
      meanLogProb: usage.meanLogProb,
      meanEntropy: usage.meanEntropy,
      criterion: usage.criterion,
      domain: usage.domain ?? 'prose',
      model: usage.name ?? undefined,
      at: new Date().toISOString(),
    };
    answers[reportId] = answer;
    await this.store.saveAnswers(answers);
    return answer;
  }
}
