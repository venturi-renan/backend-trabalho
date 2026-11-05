import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TaskStatus } from '../generated/prisma/enums';
import { ProjectsService } from '../projects/projects.service';
import { calculateWorkload, suggestAssignee } from './workload';

@Injectable()
export class WorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async projectWorkload(projectId: string, userId: string, days: number, now = new Date()) {
    await this.projects.ensureMember(projectId, userId);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, weeklyCapacityHours: true } } },
    });
    const memberIds = members.map((m) => m.user.id);

    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: { in: memberIds },
        status: { not: TaskStatus.DONE },
        dueDate: { not: null },
      },
      select: { assigneeId: true, estimatedHours: true, dueDate: true },
    });

    const workload = calculateWorkload(
      members.map((m) => m.user),
      tasks.map((t) => ({ ...t, assigneeId: t.assigneeId as string })),
      now,
      days,
    );

    return {
      periodDays: days,
      overloaded: workload.filter((m) => m.status === 'OVERLOADED').map((m) => m.userId),
      members: workload,
    };
  }

  async suggest(projectId: string, userId: string, hours: number, days: number) {
    const { members } = await this.projectWorkload(projectId, userId, days);
    return { estimatedHours: hours, suggestion: suggestAssignee(members, hours) };
  }
}
