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

describe('Tarefas (e2e)', () => {
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

  async function setup() {
    const owner = await registerUser(ctx.app);
    const member = await registerUser(ctx.app);
    const projectId = await createProject(ctx.app, owner.token);
    await ctx.prisma.projectMember.create({ data: { projectId, userId: member.id } });
    return { owner, member, projectId };
  }

  describe('CRUD', () => {
    it('cria, lista, detalha, atualiza e exclui uma tarefa', async () => {
      const { owner, member, projectId } = await setup();
      const auth = `Bearer ${owner.token}`;

      const created = await http()
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', auth)
        .send({
          title: 'Escrever introdução',
          importance: 'HIGH',
          estimatedHours: 4,
          dueDate: daysFromNow(5),
          assigneeId: member.id,
        })
        .expect(201);
      expect(created.body).toMatchObject({
        title: 'Escrever introdução',
        status: 'TODO',
        creatorId: owner.id,
        assignee: { id: member.id },
      });
      const id = created.body.id;

      const list = await http()
        .get(`/projects/${projectId}/tasks`)
        .set('Authorization', auth)
        .expect(200);
      expect(list.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });

      const detail = await http().get(`/tasks/${id}`).set('Authorization', auth).expect(200);
      expect(detail.body).toMatchObject({ id, dependsOn: [], blocks: [] });

      const updated = await http()
        .patch(`/tasks/${id}`)
        .set('Authorization', auth)
        .send({ title: 'Introdução revisada', assigneeId: null })
        .expect(200);
      expect(updated.body).toMatchObject({ title: 'Introdução revisada', assigneeId: null });

      await http().delete(`/tasks/${id}`).set('Authorization', auth).expect(204);
      await http().get(`/tasks/${id}`).set('Authorization', auth).expect(404);
    });

    it('preenche e limpa a data de conclusão conforme o status', async () => {
      const { owner, projectId } = await setup();
      const id = await createTask(ctx.app, owner.token, projectId);
      const patch = (status: string) =>
        http()
          .patch(`/tasks/${id}`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ status })
          .expect(200);

      const done = await patch('DONE');
      expect(done.body.completedAt).not.toBeNull();

      const reopened = await patch('IN_PROGRESS');
      expect(reopened.body.completedAt).toBeNull();
    });

    it('filtra, ordena e pagina a listagem', async () => {
      const { owner, member, projectId } = await setup();
      await createTask(ctx.app, owner.token, projectId, { title: 'Sem prazo' });
      await createTask(ctx.app, owner.token, projectId, {
        title: 'Prazo longo',
        dueDate: daysFromNow(10),
        assigneeId: member.id,
      });
      await createTask(ctx.app, owner.token, projectId, {
        title: 'Prazo curto',
        dueDate: daysFromNow(1),
      });
      const auth = `Bearer ${owner.token}`;

      const byDue = await http()
        .get(`/projects/${projectId}/tasks?sort=dueDate`)
        .set('Authorization', auth)
        .expect(200);
      expect(byDue.body.items.map((t: { title: string }) => t.title)).toEqual([
        'Prazo curto',
        'Prazo longo',
        'Sem prazo',
      ]);

      const byAssignee = await http()
        .get(`/projects/${projectId}/tasks?assigneeId=${member.id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(byAssignee.body.total).toBe(1);

      const paged = await http()
        .get(`/projects/${projectId}/tasks?page=2&pageSize=2`)
        .set('Authorization', auth)
        .expect(200);
      expect(paged.body.items).toHaveLength(1);
      expect(paged.body.total).toBe(3);

      await http()
        .get(`/projects/${projectId}/tasks?status=INVALIDO`)
        .set('Authorization', auth)
        .expect(400);
    });
  });

  describe('regras de acesso', () => {
    it('não permite atribuir tarefa a quem não é membro', async () => {
      const { owner, projectId } = await setup();
      const stranger = await registerUser(ctx.app);

      await http()
        .post(`/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Tarefa', assigneeId: stranger.id })
        .expect(400);
    });

    it('quem não é membro não acessa as tarefas', async () => {
      const { owner, projectId } = await setup();
      const stranger = await registerUser(ctx.app);
      const id = await createTask(ctx.app, owner.token, projectId);
      const auth = `Bearer ${stranger.token}`;

      await http().get(`/tasks/${id}`).set('Authorization', auth).expect(404);
      await http().get(`/projects/${projectId}/tasks`).set('Authorization', auth).expect(404);
      await http()
        .patch(`/tasks/${id}`)
        .set('Authorization', auth)
        .send({ title: 'Invadido' })
        .expect(404);
    });

    it('apenas o criador ou o dono do projeto excluem a tarefa', async () => {
      const { owner, member, projectId } = await setup();
      const ownerTask = await createTask(ctx.app, owner.token, projectId);
      const memberTask = await createTask(ctx.app, member.token, projectId);

      await http()
        .delete(`/tasks/${ownerTask}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
      await http()
        .delete(`/tasks/${memberTask}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(204);
      await http()
        .delete(`/tasks/${ownerTask}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);
    });
  });

  describe('dependências', () => {
    it('bloqueia o início da tarefa até as dependências serem concluídas', async () => {
      const { owner, projectId } = await setup();
      const auth = `Bearer ${owner.token}`;
      const research = await createTask(ctx.app, owner.token, projectId, { title: 'Pesquisa' });
      const writing = await createTask(ctx.app, owner.token, projectId, { title: 'Escrita' });

      const added = await http()
        .post(`/tasks/${writing}/dependencies`)
        .set('Authorization', auth)
        .send({ dependsOnId: research })
        .expect(201);
      expect(added.body.dependsOn).toEqual([{ id: research, title: 'Pesquisa', status: 'TODO' }]);

      const blocked = await http()
        .patch(`/tasks/${writing}`)
        .set('Authorization', auth)
        .send({ status: 'IN_PROGRESS' })
        .expect(409);
      expect(blocked.body.blockedBy).toEqual([{ id: research, title: 'Pesquisa', status: 'TODO' }]);

      await http()
        .patch(`/tasks/${research}`)
        .set('Authorization', auth)
        .send({ status: 'DONE' })
        .expect(200);
      await http()
        .patch(`/tasks/${writing}`)
        .set('Authorization', auth)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      const detail = await http().get(`/tasks/${research}`).set('Authorization', auth).expect(200);
      expect(detail.body.blocks).toHaveLength(1);
    });

    it('impede ciclos e retorna o caminho do ciclo', async () => {
      const { owner, projectId } = await setup();
      const auth = `Bearer ${owner.token}`;
      const [a, b, c] = await Promise.all(
        ['Etapa A', 'Etapa B', 'Etapa C'].map((title) =>
          createTask(ctx.app, owner.token, projectId, { title }),
        ),
      );
      const depend = (task: string, on: string) =>
        http()
          .post(`/tasks/${task}/dependencies`)
          .set('Authorization', auth)
          .send({ dependsOnId: on });

      await depend(b, a).expect(201);
      await depend(c, b).expect(201);
      await depend(b, a).expect(409);
      await depend(a, a).expect(400);

      const cycle = await depend(a, c).expect(400);
      expect(cycle.body.cycle).toEqual([a, c, b, a]);
    });

    it('não permite dependência com tarefa de outro projeto', async () => {
      const { owner, projectId } = await setup();
      const otherProject = await createProject(ctx.app, owner.token, 'Outro');
      const task = await createTask(ctx.app, owner.token, projectId);
      const foreign = await createTask(ctx.app, owner.token, otherProject);

      await http()
        .post(`/tasks/${task}/dependencies`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ dependsOnId: foreign })
        .expect(404);
    });

    it('remove dependência existente e retorna 404 para inexistente', async () => {
      const { owner, projectId } = await setup();
      const auth = `Bearer ${owner.token}`;
      const a = await createTask(ctx.app, owner.token, projectId);
      const b = await createTask(ctx.app, owner.token, projectId);
      await http()
        .post(`/tasks/${b}/dependencies`)
        .set('Authorization', auth)
        .send({ dependsOnId: a })
        .expect(201);

      await http().delete(`/tasks/${b}/dependencies/${a}`).set('Authorization', auth).expect(204);
      await http().delete(`/tasks/${b}/dependencies/${a}`).set('Authorization', auth).expect(404);
    });
  });
});
