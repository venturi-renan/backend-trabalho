import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrioritizationService } from './prioritization.service';

const nextTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

@Controller()
export class PrioritizationController {
  constructor(private readonly prioritization: PrioritizationService) {}

  @Get('projects/:projectId/tasks/prioritized')
  prioritizeProject(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.prioritization.prioritizeProject(projectId, user.id);
  }

  @Get('users/me/next-tasks')
  nextTasks(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(nextTasksQuerySchema)) query: { limit: number },
  ) {
    return this.prioritization.nextTasksForUser(user.id, query.limit);
  }
}
