import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AnalyzeFileHandler } from './application/commands/analyze-file.command.js';
import { AnalyzeTextHandler } from './application/commands/analyze-text.command.js';
import { ClearHistoryHandler } from './application/commands/clear-history.command.js';
import { DeleteAnalysisHandler } from './application/commands/delete-analysis.command.js';
import { SetAnswerHandler } from './application/commands/answer.command.js';
import {
  ApplyCalibrationHandler,
  ResetCalibrationHandler,
} from './application/commands/calibration.command.js';
import { GetAnswerHandler, GetCalibrationHandler } from './application/queries/calibration.query.js';
import { AnalysisCompletedHandler } from './application/events/analysis-completed.handler.js';
import { GetAnalysisHandler } from './application/queries/get-analysis.query.js';
import { GetHistoryHandler } from './application/queries/get-history.query.js';
import {
  GetLanguageModelHandler,
  GetModelActivityHandler,
} from './application/queries/get-language-model.query.js';
import { ANALYSIS_REPOSITORY } from './domain/analysis.repository.js';
import { Analyzer } from './domain/analyzer.js';
import { ArtefactDetector } from './domain/detectors/artefact.detector.js';
import { CodeDetector } from './domain/detectors/code.detector.js';
import { MetadataDetector } from './domain/detectors/metadata.detector.js';
import { ProjectDetector } from './domain/detectors/project.detector.js';
import { StatsDetector } from './domain/detectors/stats.detector.js';
import { StyleDetector } from './domain/detectors/style.detector.js';
import { UnicodeDetector } from './domain/detectors/unicode.detector.js';
import { WatermarkDetector } from './domain/detectors/watermark.detector.js';
import { DOCUMENT_READER } from './domain/document/document-reader.js';
import { LIKELIHOOD_SCORER, type LikelihoodScorer } from './domain/likelihood/likelihood-scorer.js';
import { CALIBRATION_STORE } from './domain/likelihood/calibration.store.js';
import { FileCalibrationStore } from './infrastructure/calibration/file-calibration.store.js';
import { FileAnalysisRepository } from './infrastructure/persistence/file-analysis.repository.js';
import { LlamaLikelihoodScorer } from './infrastructure/likelihood/llama-likelihood.scorer.js';
import { FileDocumentReader } from './infrastructure/readers/file-document.reader.js';
import { AnalysisController } from './presentation/analysis.controller.js';

@Module({
  imports: [CqrsModule],
  controllers: [AnalysisController],
  providers: [
    { provide: LIKELIHOOD_SCORER, useClass: LlamaLikelihoodScorer },
    {
      provide: Analyzer,
      inject: [LIKELIHOOD_SCORER],
      useFactory: (scorer: LikelihoodScorer) =>
        new Analyzer(
          [
            new ProjectDetector(),
            new MetadataDetector(),
            new ArtefactDetector(),
            new UnicodeDetector(),
            new CodeDetector(),
            new StyleDetector(),
            new StatsDetector(),
            new WatermarkDetector(),
          ],
          scorer,
        ),
    },
    { provide: DOCUMENT_READER, useClass: FileDocumentReader },
    { provide: ANALYSIS_REPOSITORY, useClass: FileAnalysisRepository },
    { provide: CALIBRATION_STORE, useClass: FileCalibrationStore },
    AnalyzeTextHandler,
    AnalyzeFileHandler,
    DeleteAnalysisHandler,
    ClearHistoryHandler,
    GetHistoryHandler,
    GetAnalysisHandler,
    GetLanguageModelHandler,
    GetModelActivityHandler,
    SetAnswerHandler,
    GetAnswerHandler,
    GetCalibrationHandler,
    ApplyCalibrationHandler,
    ResetCalibrationHandler,
    AnalysisCompletedHandler,
  ],
})
export class DetectionModule {}
