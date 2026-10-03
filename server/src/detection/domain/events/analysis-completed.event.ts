export class AnalysisCompletedEvent {
  constructor(
    readonly analysisId: string,
    readonly origin: string,
    readonly label: string,
    readonly score: number,
    readonly verdict: string,
    readonly undetermined: boolean,
    readonly topVendor: string | null,
  ) {}
}
