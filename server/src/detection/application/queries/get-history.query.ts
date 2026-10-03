import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { AnalysisSummary } from '../../domain/analysis.js';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';

export class GetHistoryQuery {}

@QueryHandler(GetHistoryQuery)
export class GetHistoryHandler implements IQueryHandler<GetHistoryQuery, AnalysisSummary[]> {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository) {}

  execute(): Promise<AnalysisSummary[]> {
    return this.repository.history();
  }
}
