import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE task_dependencies, tasks, project_members, projects, users CASCADE',
  );
}

let counter = 0;

export async function registerUser(
  app: INestApplication<App>,
  overrides: { name?: string; weeklyCapacityHours?: number } = {},
) {
  counter += 1;
  const email = `usuario${counter}@teste.com`;

  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      name: overrides.name ?? `Usuário ${counter}`,
      email,
      password: 'senha-forte-123',
      ...overrides,
    })
    .expect(201);

  return {
    id: response.body.user.id as string,
    email,
    token: response.body.accessToken as string,
  };
}

export async function createProject(app: INestApplication<App>, token: string, name = 'Projeto') {
  const response = await request(app.getHttpServer())
    .post('/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
    .expect(201);

  return response.body.id as string;
}

export async function createTask(
  app: INestApplication<App>,
  token: string,
  projectId: string,
  data: Record<string, unknown> = {},
) {
  const response = await request(app.getHttpServer())
    .post(`/projects/${projectId}/tasks`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Tarefa de teste', ...data })
    .expect(201);

  return response.body.id as string;
}

export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
