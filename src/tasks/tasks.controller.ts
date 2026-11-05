import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CreateTaskDto,
  createTaskSchema,
  ListTasksQuery,
  listTasksQuerySchema,
  UpdateTaskDto,
  updateTaskSchema,
} from './tasks.dto';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, user.id, body);
  }

  @Get('projects/:projectId/tasks')
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(new ZodValidationPipe(listTasksQuerySchema)) query: ListTasksQuery,
  ) {
    return this.tasksService.findAll(projectId, user.id, query);
  }

  @Get('tasks/:id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.id, body);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id, user.id);
  }
}
