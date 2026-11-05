import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { ProjectRole, TaskStatus } from '../generated/prisma/enums';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto, ListTasksQuery, UpdateTaskDto } from './tasks.dto';

const userSummary = { select: { id: true, name: true, email: true } } as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async create(projectId: string, userId: string, data: CreateTaskDto) {
    await this.projects.ensureMember(projectId, userId);
    if (data.assigneeId) await this.ensureAssigneeIsMember(projectId, data.assigneeId);

    return this.prisma.task.create({
      data: { ...data, projectId, creatorId: userId },
      include: { assignee: userSummary },
    });
  }

  async findAll(projectId: string, userId: string, query: ListTasksQuery) {
    await this.projects.ensureMember(projectId, userId);

    const where: Prisma.TaskWhereInput = {
      projectId,
      status: query.status,
      assigneeId: query.assigneeId,
    };
    const orderBy: Prisma.TaskOrderByWithRelationInput =
      query.sort === 'dueDate'
        ? { dueDate: { sort: 'asc', nulls: 'last' } }
        : { createdAt: 'desc' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { assignee: userSummary },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: userSummary,
        creator: userSummary,
        dependsOn: { select: { dependsOn: { select: { id: true, title: true, status: true } } } },
        dependents: { select: { task: { select: { id: true, title: true, status: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada');

    await this.projects.ensureMember(task.projectId, userId);

    const { dependsOn, dependents, ...rest } = task;
    return {
      ...rest,
      dependsOn: dependsOn.map((d) => d.dependsOn),
      blocks: dependents.map((d) => d.task),
    };
  }

  async update(taskId: string, userId: string, data: UpdateTaskDto) {
    const task = await this.getTaskForMember(taskId, userId);
    if (data.assigneeId) await this.ensureAssigneeIsMember(task.projectId, data.assigneeId);
    if (data.status && data.status !== TaskStatus.TODO && data.status !== task.status) {
      await this.ensureNotBlocked(taskId);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { ...data, completedAt: this.resolveCompletedAt(task.status, data.status) },
      include: { assignee: userSummary },
    });
  }

  async remove(taskId: string, userId: string) {
    const task = await this.getTaskForMember(taskId, userId);
    const membership = await this.projects.ensureMember(task.projectId, userId);

    const canDelete = task.creatorId === userId || membership.role === ProjectRole.OWNER;
    if (!canDelete) {
      throw new ForbiddenException(
        'Apenas quem criou a tarefa ou o dono do projeto pode excluí-la',
      );
    }

    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async getTaskForMember(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');

    await this.projects.ensureMember(task.projectId, userId);
    return task;
  }

  private async ensureNotBlocked(taskId: string) {
    const pending = await this.prisma.task.findMany({
      where: { dependents: { some: { taskId } }, status: { not: TaskStatus.DONE } },
      select: { id: true, title: true, status: true },
    });

    if (pending.length > 0) {
      throw new ConflictException({
        message: 'A tarefa está bloqueada por dependências ainda não concluídas',
        blockedBy: pending,
      });
    }
  }

  private resolveCompletedAt(current: TaskStatus, next?: TaskStatus) {
    if (!next || next === current) return undefined;
    return next === TaskStatus.DONE ? new Date() : null;
  }

  private async ensureAssigneeIsMember(projectId: string, assigneeId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    });
    if (!member) throw new BadRequestException('O responsável precisa ser membro do projeto');
  }
}
