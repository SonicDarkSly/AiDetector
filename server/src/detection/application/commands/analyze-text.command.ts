import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, type ICommandHandler } from '@nestjs/cqrs';
import type { AnalysisSnapshot } from '../../domain/analysis.js';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';
import { Analyzer } from '../../domain/analyzer.js';
import { pastedText } from '../../domain/document/source-document.js';

export class AnalyzeTextCommand {
  constructor(
    readonly text: string,
    readonly origin: string,
  ) {}
}

@CommandHandler(AnalyzeTextCommand)
export class AnalyzeTextHandler implements ICommandHandler<AnalyzeTextCommand, AnalysisSnapshot> {
  constructor(
    private readonly analyzer: Analyzer,
    private readonly publisher: EventPublisher,
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository,
  ) {}

  async execute({ text, origin }: AnalyzeTextCommand): Promise<AnalysisSnapshot> {
    const analysis = this.publisher.mergeObjectContext(await this.analyzer.analyze(pastedText(text), origin));
    await this.repository.save(analysis);
    analysis.commit();
    return analysis.snapshot();
  }
}
