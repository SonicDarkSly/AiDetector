import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, type ICommandHandler } from '@nestjs/cqrs';
import type { AnalysisSnapshot } from '../../domain/analysis.js';
import { ANALYSIS_REPOSITORY, type AnalysisRepository } from '../../domain/analysis.repository.js';
import { Analyzer } from '../../domain/analyzer.js';
import {
  DOCUMENT_READER,
  UnreadableDocumentError,
  type DocumentReader,
  type UploadedFile,
} from '../../domain/document/document-reader.js';

export class AnalyzeFileCommand {
  constructor(
    readonly file: UploadedFile,
    readonly origin: string,
  ) {}
}

@CommandHandler(AnalyzeFileCommand)
export class AnalyzeFileHandler implements ICommandHandler<AnalyzeFileCommand, AnalysisSnapshot> {
  constructor(
    private readonly analyzer: Analyzer,
    private readonly publisher: EventPublisher,
    @Inject(DOCUMENT_READER) private readonly reader: DocumentReader,
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository,
  ) {}

  async execute({ file, origin }: AnalyzeFileCommand): Promise<AnalysisSnapshot> {
    const doc = await this.reader.read(file);
    if (!doc.text.trim() && doc.metadata.length === 0) {
      throw new UnreadableDocumentError('Aucun texte ni métadonnée exploitable dans ce fichier.');
    }
    const analysis = this.publisher.mergeObjectContext(await this.analyzer.analyze(doc, origin));
    await this.repository.save(analysis);
    analysis.commit();
    return analysis.snapshot();
  }
}
