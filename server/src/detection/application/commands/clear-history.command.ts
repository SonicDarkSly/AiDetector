import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';

export class ClearHistoryCommand {}

@CommandHandler(ClearHistoryCommand)
export class ClearHistoryHandler implements ICommandHandler<ClearHistoryCommand, void> {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository) {}

  execute(): Promise<void> {
    return this.repository.clear();
  }
}
