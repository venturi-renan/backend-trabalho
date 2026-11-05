import request from 'supertest';
import {
  createProject,
  createTask,
  createTestApp,
  daysFromNow,
  registerUser,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Priorização e carga de trabalho (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const http = () => request(ctx.app.getHttpServer());

  describe('priorização', () => {
    it('ordena as tarefas abertas do projeto por prioridade com os motivos', async () => {
      const owner = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      const auth = `Bearer ${owner.token}`;

      await createTask(ctx.app, owner.token, projectId, { title: 'Baixa', importance: 'LOW' });
      await createTask(ctx.app, owner.token, projectId, {
        title: 'Atrasada',
        importance: 'HIGH',
        dueDate: daysFromNow(-2),
      });
      const done = await createTask(ctx.app, owner.token, projectId, { title: 'Feita' });
      await http().patch(`/tasks/${done}`).set('Authorization', auth).send({ status: 'DONE' });

      const response = await http()
        .get(`/projects/${projectId}/tasks/prioritized`)
        .set('Authorization', auth)
        .expect(200);

      expect(response.body.map((t: { title: string }) => t.title)).toEqual(['Atrasada', 'Baixa']);
      expect(response.body[0].priority).toMatchObject({
        score: 75,
        blocked: false,
        reasons: ['Importância alta', 'Atrasada há 2 dias'],
      });
    });

    it('tarefa que libera outras sobe e a bloqueada desce', async () => {
      const owner = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      const auth = `Bearer ${owner.token}`;
      const base = await createTask(ctx.app, owner.token, projectId, { title: 'Base' });
      const next = await createTask(ctx.app, owner.token, projectId, {
        title: 'Depende',
        importance: 'CRITICAL',
      });
      await http()
        .post(`/tasks/${next}/dependencies`)
        .set('Authorization', auth)
        .send({ dependsOnId: base });

      const response = await http()
        .get(`/projects/${projectId}/tasks/prioritized`)
        .set('Authorization', auth)
        .expect(200);

      expect(response.body[0]).toMatchObject({ title: 'Base', priority: { score: 30 } });
      expect(response.body[1]).toMatchObject({ title: 'Depende', priority: { blocked: true } });
    });

    it('next-tasks traz só as tarefas desbloqueadas do usuário, de todos os projetos', async () => {
      const user = await registerUser(ctx.app);
      const other = await registerUser(ctx.app);
      const p1 = await createProject(ctx.app, user.token, 'P1');
      const p2 = await createProject(ctx.app, user.token, 'P2');
      const auth = `Bearer ${user.token}`;
      await ctx.prisma.projectMember.create({ data: { projectId: p1, userId: other.id } });

      const mine1 = await createTask(ctx.app, user.token, p1, { assigneeId: user.id });
      await createTask(ctx.app, user.token, p2, { assigneeId: user.id, importance: 'CRITICAL' });
      await createTask(ctx.app, user.token, p1, { assigneeId: other.id });
      const blocked = await createTask(ctx.app, user.token, p1, { assigneeId: user.id });
      await http()
        .post(`/tasks/${blocked}/dependencies`)
        .set('Authorization', auth)
        .send({ dependsOnId: mine1 });

      const response = await http()
        .get('/users/me/next-tasks')
        .set('Authorization', auth)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({ importance: 'CRITICAL', project: { name: 'P2' } });

      const limited = await http()
        .get('/users/me/next-tasks?limit=1')
        .set('Authorization', auth)
        .expect(200);
      expect(limited.body).toHaveLength(1);
    });

    it('não mostra priorização de projeto para quem não é membro', async () => {
      const owner = await registerUser(ctx.app);
      const stranger = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);

      await http()
        .get(`/projects/${projectId}/tasks/prioritized`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);
    });
  });

  describe('carga de trabalho', () => {
    async function setup() {
      const ana = await registerUser(ctx.app, { name: 'Ana', weeklyCapacityHours: 10 });
      const bia = await registerUser(ctx.app, { name: 'Bia', weeklyCapacityHours: 40 });
      const projectId = await createProject(ctx.app, ana.token);
      await ctx.prisma.projectMember.create({ data: { projectId, userId: bia.id } });
      return { ana, bia, projectId };
    }

    it('identifica membros sobrecarregados considerando todos os projetos', async () => {
      const { ana, bia, projectId } = await setup();
      const otherProject = await createProject(ctx.app, ana.token, 'Outro');

      await createTask(ctx.app, ana.token, projectId, {
        assigneeId: ana.id,
        estimatedHours: 6,
        dueDate: daysFromNow(2),
      });
      await createTask(ctx.app, ana.token, otherProject, {
        assigneeId: ana.id,
        estimatedHours: 6,
        dueDate: daysFromNow(3),
      });
      await createTask(ctx.app, ana.token, projectId, {
        assigneeId: bia.id,
        estimatedHours: 20,
        dueDate: daysFromNow(30),
      });

      const response = await http()
        .get(`/projects/${projectId}/workload`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);

      expect(response.body.periodDays).toBe(7);
      expect(response.body.overloaded).toEqual([ana.id]);
      expect(response.body.members).toEqual([
        expect.objectContaining({ userId: ana.id, plannedHours: 12, status: 'OVERLOADED' }),
        expect.objectContaining({ userId: bia.id, plannedHours: 0, status: 'AVAILABLE' }),
      ]);

      const month = await http()
        .get(`/projects/${projectId}/workload?days=30`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);
      expect(month.body.overloaded).toEqual([]);
    });

    it('sugere o membro com mais folga para uma nova tarefa', async () => {
      const { ana, bia, projectId } = await setup();
      await createTask(ctx.app, ana.token, projectId, {
        assigneeId: ana.id,
        estimatedHours: 5,
        dueDate: daysFromNow(1),
      });

      const response = await http()
        .get(`/projects/${projectId}/workload/suggest-assignee?hours=4`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        estimatedHours: 4,
        suggestion: { userId: bia.id, utilizationAfter: 0.1 },
      });

      await http()
        .get(`/projects/${projectId}/workload/suggest-assignee`)
        .set('Authorization', `Bearer ${ana.token}`)
        .expect(400);
    });
  });
});
