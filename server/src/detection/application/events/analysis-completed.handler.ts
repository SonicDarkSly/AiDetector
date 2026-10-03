import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { AnalysisCompletedEvent } from '../../domain/events/analysis-completed.event.js';

@EventsHandler(AnalysisCompletedEvent)
export class AnalysisCompletedHandler implements IEventHandler<AnalysisCompletedEvent> {
  private readonly logger = new Logger('Analyse');

  handle(e: AnalysisCompletedEvent): void {
    const result = e.undetermined ? 'indéterminable' : `${e.score} % (${e.verdict})`;
    const vendor = e.topVendor ? ` · piste : ${e.topVendor}` : '';
    this.logger.log(`${e.origin} · ${e.label} → ${result}${vendor}`);
  }
}
