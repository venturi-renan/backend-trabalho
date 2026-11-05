import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { wouldCreateCycle } from './dependency-graph';
import { TasksService } from './tasks.service';

@Injectable()
export class TaskDependenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async add(taskId: string, dependsOnId: string, userId: string) {
    const task = await this.tasks.getTaskForMember(taskId, userId);

    const dependsOn = await this.prisma.task.findUnique({ where: { id: dependsOnId } });
    if (!dependsOn || dependsOn.projectId !== task.projectId) {
      throw new NotFoundException('Tarefa de dependência não encontrada neste projeto');
    }

    const existing = await this.prisma.taskDependency.findUnique({
      where: { taskId_dependsOnId: { taskId, dependsOnId } },
    });
    if (existing) throw new ConflictException('Essa dependência já existe');

    const edges = await this.prisma.taskDependency.findMany({
      where: { task: { projectId: task.projectId } },
      select: { taskId: true, dependsOnId: true },
    });

    const cycle = wouldCreateCycle(edges, taskId, dependsOnId);
    if (cycle) {
      throw new BadRequestException({
        message: 'Essa dependência criaria um ciclo entre tarefas',
        cycle,
      });
    }

    await this.prisma.taskDependency.create({ data: { taskId, dependsOnId } });
    return this.tasks.findOne(taskId, userId);
  }

  async remove(taskId: string, dependsOnId: string, userId: string) {
    await this.tasks.getTaskForMember(taskId, userId);

    const { count } = await this.prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnId },
    });
    if (count === 0) throw new NotFoundException('Dependência não encontrada');
  }
}
