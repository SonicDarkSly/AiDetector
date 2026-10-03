import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { AnalysisSnapshot } from '../../domain/analysis.js';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';

export class GetAnalysisQuery {
  constructor(readonly id: string) {}
}

@QueryHandler(GetAnalysisQuery)
export class GetAnalysisHandler implements IQueryHandler<GetAnalysisQuery, AnalysisSnapshot | null> {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository) {}

  async execute({ id }: GetAnalysisQuery): Promise<AnalysisSnapshot | null> {
    return (await this.repository.findById(id))?.snapshot() ?? null;
  }
}
