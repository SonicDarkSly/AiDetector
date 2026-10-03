import { Module } from '@nestjs/common';
import { DetectionModule } from './detection/detection.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DetectionModule],
  controllers: [HealthController],
})
export class AppModule {}
