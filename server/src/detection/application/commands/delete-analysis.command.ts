import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';

export class DeleteAnalysisCommand {
  constructor(readonly id: string) {}
}

@CommandHandler(DeleteAnalysisCommand)
export class DeleteAnalysisHandler implements ICommandHandler<DeleteAnalysisCommand, void> {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository) {}

  execute({ id }: DeleteAnalysisCommand): Promise<void> {
    return this.repository.delete(id);
  }
}
