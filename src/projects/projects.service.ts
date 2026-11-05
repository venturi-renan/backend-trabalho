import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProjectRole } from '../generated/prisma/enums';
import { AddMemberDto, CreateProjectDto, UpdateProjectDto } from './projects.dto';

const memberSelect = {
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, weeklyCapacityHours: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        ...data,
        members: { create: { userId, role: ProjectRole.OWNER } },
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { tasks: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(projectId: string, userId: string) {
    await this.ensureMember(projectId, userId);

    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        members: { select: memberSelect, orderBy: { joinedAt: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async update(projectId: string, userId: string, data: UpdateProjectDto) {
    await this.ensureOwner(projectId, userId);
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  async remove(projectId: string, userId: string) {
    await this.ensureOwner(projectId, userId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async listMembers(projectId: string, userId: string) {
    await this.ensureMember(projectId, userId);

    return this.prisma.projectMember.findMany({
      where: { projectId },
      select: memberSelect,
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(projectId: string, userId: string, data: AddMemberDto) {
    await this.ensureOwner(projectId, userId);

    const newMember = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!newMember) throw new NotFoundException('Nenhum usuário cadastrado com esse e-mail');

    const alreadyMember = await this.findMembership(projectId, newMember.id);
    if (alreadyMember) throw new ConflictException('Usuário já faz parte do projeto');

    return this.prisma.projectMember.create({
      data: { projectId, userId: newMember.id, role: data.role },
      select: memberSelect,
    });
  }

  async removeMember(projectId: string, userId: string, memberId: string) {
    const isSelf = userId === memberId;
    if (!isSelf) await this.ensureOwner(projectId, userId);

    const membership = await this.findMembership(projectId, memberId);
    if (!membership) throw new NotFoundException('Membro não encontrado no projeto');

    if (membership.role === ProjectRole.OWNER) {
      const owners = await this.prisma.projectMember.count({
        where: { projectId, role: ProjectRole.OWNER },
      });
      if (owners === 1) {
        throw new BadRequestException('O projeto precisa ter pelo menos um dono');
      }
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, assigneeId: memberId },
        data: { assigneeId: null },
      }),
      this.prisma.projectMember.delete({
        where: { projectId_userId: { projectId, userId: memberId } },
      }),
    ]);
  }

  async ensureMember(projectId: string, userId: string) {
    const membership = await this.findMembership(projectId, userId);
    if (!membership) throw new NotFoundException('Projeto não encontrado');
    return membership;
  }

  async ensureOwner(projectId: string, userId: string) {
    const membership = await this.ensureMember(projectId, userId);
    if (membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Apenas donos do projeto podem fazer isso');
    }
    return membership;
  }

  private findMembership(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
