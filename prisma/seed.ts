import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password';
import { PrismaClient } from '../src/generated/prisma/client';
import { ProjectRole, TaskImportance, TaskStatus } from '../src/generated/prisma/enums';

if (existsSync('.env')) process.loadEnvFile('.env');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = 'senha-demo-123';

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE task_dependencies, tasks, project_members, projects, users CASCADE',
  );

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [ana, bruno, carla] = await Promise.all(
    [
      { name: 'Ana Souza', email: 'ana@demo.com', weeklyCapacityHours: 12 },
      { name: 'Bruno Lima', email: 'bruno@demo.com', weeklyCapacityHours: 30 },
      { name: 'Carla Mendes', email: 'carla@demo.com', weeklyCapacityHours: 20 },
    ].map((data) => prisma.user.create({ data: { ...data, passwordHash } })),
  );

  const project = await prisma.project.create({
    data: {
      name: 'App de Biblioteca',
      description: 'Sistema para empréstimo de livros da biblioteca do campus',
      members: {
        create: [
          { userId: ana.id, role: ProjectRole.OWNER },
          { userId: bruno.id, role: ProjectRole.MEMBER },
          { userId: carla.id, role: ProjectRole.MEMBER },
        ],
      },
    },
  });

  const task = (data: {
    title: string;
    importance?: TaskImportance;
    status?: TaskStatus;
    estimatedHours?: number;
    dueInDays?: number;
    assigneeId?: string;
  }) =>
    prisma.task.create({
      data: {
        projectId: project.id,
        creatorId: ana.id,
        title: data.title,
        importance: data.importance,
        status: data.status,
        estimatedHours: data.estimatedHours,
        assigneeId: data.assigneeId,
        dueDate: data.dueInDays === undefined ? undefined : daysFromNow(data.dueInDays),
        completedAt: data.status === TaskStatus.DONE ? new Date() : undefined,
      },
    });

  const requirements = await task({
    title: 'Levantar requisitos com a bibliotecária',
    importance: TaskImportance.HIGH,
    status: TaskStatus.DONE,
    estimatedHours: 3,
    dueInDays: -5,
    assigneeId: ana.id,
  });
  const database = await task({
    title: 'Modelar banco de dados',
    importance: TaskImportance.CRITICAL,
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 6,
    dueInDays: -1,
    assigneeId: ana.id,
  });
  const loans = await task({
    title: 'Implementar CRUD de empréstimos',
    importance: TaskImportance.HIGH,
    estimatedHours: 10,
    dueInDays: 5,
    assigneeId: bruno.id,
  });
  const notifications = await task({
    title: 'Enviar lembrete de devolução por e-mail',
    importance: TaskImportance.MEDIUM,
    estimatedHours: 5,
    dueInDays: 10,
    assigneeId: carla.id,
  });
  await task({
    title: 'Criar protótipo das telas',
    importance: TaskImportance.MEDIUM,
    estimatedHours: 8,
    dueInDays: 3,
    assigneeId: ana.id,
  });
  await task({
    title: 'Configurar CI no GitHub',
    importance: TaskImportance.LOW,
    estimatedHours: 2,
    dueInDays: 6,
    assigneeId: carla.id,
  });
  await task({ title: 'Escrever README', importance: TaskImportance.LOW, estimatedHours: 1 });

  await prisma.taskDependency.createMany({
    data: [
      { taskId: database.id, dependsOnId: requirements.id },
      { taskId: loans.id, dependsOnId: database.id },
      { taskId: notifications.id, dependsOnId: loans.id },
    ],
  });

  console.log('Dados de demonstração criados.');
  console.log(`Usuários: ana@demo.com, bruno@demo.com, carla@demo.com (senha: ${DEMO_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
