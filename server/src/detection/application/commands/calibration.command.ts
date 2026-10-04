import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { activeCalibration, type Calibration } from '../../domain/likelihood/calibration.js';
import { CALIBRATION_STORE, type CalibrationStore } from '../../domain/likelihood/calibration.store.js';
import { MIN_ANSWERS, propose } from '../../domain/likelihood/recalibration.js';

export class NotEnoughAnswersError extends Error {}

export class ApplyCalibrationCommand {}

@CommandHandler(ApplyCalibrationCommand)
export class ApplyCalibrationHandler implements ICommandHandler<ApplyCalibrationCommand, Calibration> {
  constructor(@Inject(CALIBRATION_STORE) private readonly store: CalibrationStore) {}

  async execute(): Promise<Calibration> {
    const proposal = propose(
      await this.store.baseSamples(),
      Object.values(await this.store.answers()),
      activeCalibration(),
    );
    if (!proposal)
      throw new NotEnoughAnswersError(`il faut au moins ${MIN_ANSWERS} réponses sur de la prose`);
    const calibration = { ...proposal.calibration, appliedAt: new Date().toISOString() };
    await this.store.save(calibration);
    return calibration;
  }
}

export class ResetCalibrationCommand {}

@CommandHandler(ResetCalibrationCommand)
export class ResetCalibrationHandler implements ICommandHandler<ResetCalibrationCommand, Calibration> {
  constructor(@Inject(CALIBRATION_STORE) private readonly store: CalibrationStore) {}

  async execute(): Promise<Calibration> {
    await this.store.save(null);
    return activeCalibration();
  }
}
