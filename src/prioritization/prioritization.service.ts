import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { TaskStatus } from '../generated/prisma/enums';
import { ProjectsService } from '../projects/projects.service';
import { calculatePriority } from './priority';

const pendingFilter = { status: { not: TaskStatus.DONE } } as const;

const taskWithDependencyCounts = {
  assignee: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  _count: {
    select: {
      dependsOn: { where: { dependsOn: pendingFilter } },
      dependents: { where: { task: pendingFilter } },
    },
  },
} satisfies Prisma.TaskInclude;

type TaskWithCounts = Prisma.TaskGetPayload<{ include: typeof taskWithDependencyCounts }>;

@Injectable()
export class PrioritizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async prioritizeProject(projectId: string, userId: string) {
    await this.projects.ensureMember(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, ...pendingFilter },
      include: taskWithDependencyCounts,
    });

    return this.rank(tasks);
  }

  async nextTasksForUser(userId: string, limit: number) {
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        ...pendingFilter,
        project: { members: { some: { userId } } },
      },
      include: taskWithDependencyCounts,
    });

    return this.rank(tasks)
      .filter((task) => !task.priority.blocked)
      .slice(0, limit);
  }

  private rank(tasks: TaskWithCounts[], now = new Date()) {
    return tasks
      .map(({ _count, ...task }) => ({
        ...task,
        priority: calculatePriority(
          {
            ...task,
            pendingDependencies: _count.dependsOn,
            pendingDependents: _count.dependents,
          },
          now,
        ),
      }))
      .sort((a, b) => b.priority.score - a.priority.score);
  }
}
