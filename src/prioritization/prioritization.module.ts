import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { PrioritizationController } from './prioritization.controller';
import { PrioritizationService } from './prioritization.service';

@Module({
  imports: [ProjectsModule],
  controllers: [PrioritizationController],
  providers: [PrioritizationService],
})
export class PrioritizationModule {}
