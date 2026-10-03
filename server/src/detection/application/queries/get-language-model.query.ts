import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import {
  LIKELIHOOD_SCORER,
  type LanguageModelInfo,
  type LikelihoodScorer,
} from '../../domain/likelihood/likelihood-scorer.js';

export class GetLanguageModelQuery {}

@QueryHandler(GetLanguageModelQuery)
export class GetLanguageModelHandler implements IQueryHandler<GetLanguageModelQuery, LanguageModelInfo> {
  constructor(@Inject(LIKELIHOOD_SCORER) private readonly scorer: LikelihoodScorer) {}

  execute(): Promise<LanguageModelInfo> {
    return this.scorer.describe();
  }
}
