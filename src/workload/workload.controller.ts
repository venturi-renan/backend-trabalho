import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ApiZodQuery } from '../common/api-docs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkloadService } from './workload.service';

const periodSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

const suggestSchema = periodSchema.extend({
  hours: z.coerce.number().int().min(1).max(200),
});

@ApiTags('Carga de trabalho')
@Controller('projects/:projectId/workload')
export class WorkloadController {
  constructor(private readonly workload: WorkloadService) {}

  @Get()
  @ApiZodQuery(periodSchema)
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(new ZodValidationPipe(periodSchema)) query: z.infer<typeof periodSchema>,
  ) {
    return this.workload.projectWorkload(projectId, user.id, query.days);
  }

  @Get('suggest-assignee')
  @ApiZodQuery(suggestSchema)
  suggest(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(new ZodValidationPipe(suggestSchema)) query: z.infer<typeof suggestSchema>,
  ) {
    return this.workload.suggest(projectId, user.id, query.hours, query.days);
  }
}
