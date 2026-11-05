import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { TaskDependenciesController } from './task-dependencies.controller';
import { TaskDependenciesService } from './task-dependencies.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectsModule],
  controllers: [TasksController, TaskDependenciesController],
  providers: [TasksService, TaskDependenciesService],
  exports: [TasksService],
})
export class TasksModule {}
