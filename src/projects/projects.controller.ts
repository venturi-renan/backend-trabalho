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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ApiZodBody } from '../common/api-docs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  AddMemberDto,
  addMemberSchema,
  CreateProjectDto,
  createProjectSchema,
  UpdateProjectDto,
  updateProjectSchema,
} from './projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projetos')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiZodBody(createProjectSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, body);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.projectsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiZodBody(updateProjectSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id, user.id);
  }

  @Get(':id/members')
  listMembers(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.listMembers(id, user.id);
  }

  @Post(':id/members')
  @ApiZodBody(addMemberSchema)
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberDto,
  ) {
    return this.projectsService.addMember(id, user.id, body);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.projectsService.removeMember(id, user.id, memberId);
  }
}
