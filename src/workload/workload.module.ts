import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WorkloadController } from './workload.controller';
import { WorkloadService } from './workload.service';

@Module({
  imports: [ProjectsModule],
  controllers: [WorkloadController],
  providers: [WorkloadService],
})
export class WorkloadModule {}
