import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TaskDependenciesService } from './task-dependencies.service';

const addDependencySchema = z.object({ dependsOnId: z.uuid() });

@Controller('tasks/:id/dependencies')
export class TaskDependenciesController {
  constructor(private readonly dependencies: TaskDependenciesService) {}

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(addDependencySchema)) body: { dependsOnId: string },
  ) {
    return this.dependencies.add(taskId, body.dependsOnId, user.id);
  }

  @Delete(':dependsOnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Param('dependsOnId', ParseUUIDPipe) dependsOnId: string,
  ) {
    return this.dependencies.remove(taskId, dependsOnId, user.id);
  }
}
