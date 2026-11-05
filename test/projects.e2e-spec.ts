import request from 'supertest';
import {
  createProject,
  createTask,
  createTestApp,
  registerUser,
  resetDatabase,
  TestContext,
} from './helpers';

describe('Projetos (e2e)', () => {
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

  it('faz o CRUD completo de um projeto', async () => {
    const owner = await registerUser(ctx.app);
    const auth = `Bearer ${owner.token}`;

    const created = await http()
      .post('/projects')
      .set('Authorization', auth)
      .send({ name: 'TCC', description: 'Trabalho de conclusão' })
      .expect(201);
    const id = created.body.id;

    const list = await http().get('/projects').set('Authorization', auth).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]._count).toEqual({ tasks: 0, members: 1 });

    const detail = await http().get(`/projects/${id}`).set('Authorization', auth).expect(200);
    expect(detail.body.members[0]).toMatchObject({ role: 'OWNER', user: { id: owner.id } });

    const updated = await http()
      .patch(`/projects/${id}`)
      .set('Authorization', auth)
      .send({ name: 'TCC 2026', description: null })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'TCC 2026', description: null });

    await http().delete(`/projects/${id}`).set('Authorization', auth).expect(204);
    await http().get(`/projects/${id}`).set('Authorization', auth).expect(404);
  });

  it('valida os dados e o id do projeto', async () => {
    const owner = await registerUser(ctx.app);
    const auth = `Bearer ${owner.token}`;

    await http().post('/projects').set('Authorization', auth).send({ name: '' }).expect(400);
    await http().get('/projects/nao-e-uuid').set('Authorization', auth).expect(400);
  });

  it('esconde o projeto de quem não é membro', async () => {
    const owner = await registerUser(ctx.app);
    const stranger = await registerUser(ctx.app);
    const projectId = await createProject(ctx.app, owner.token);

    await http()
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);

    const list = await http()
      .get('/projects')
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  describe('membros', () => {
    it('dono adiciona membro, que passa a ver o projeto mas não pode editá-lo', async () => {
      const owner = await registerUser(ctx.app);
      const member = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);

      const added = await http()
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: member.email })
        .expect(201);
      expect(added.body).toMatchObject({ role: 'MEMBER', user: { id: member.id } });

      const auth = `Bearer ${member.token}`;
      await http().get(`/projects/${projectId}`).set('Authorization', auth).expect(200);
      await http()
        .patch(`/projects/${projectId}`)
        .set('Authorization', auth)
        .send({ name: 'Outro' })
        .expect(403);
      await http().delete(`/projects/${projectId}`).set('Authorization', auth).expect(403);

      const members = await http()
        .get(`/projects/${projectId}/members`)
        .set('Authorization', auth)
        .expect(200);
      expect(members.body).toHaveLength(2);
    });

    it('impede adicionar membro inexistente ou duplicado', async () => {
      const owner = await registerUser(ctx.app);
      const member = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      const add = (email: string) =>
        http()
          .post(`/projects/${projectId}/members`)
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ email });

      await add('naoexiste@teste.com').expect(404);
      await add(member.email).expect(201);
      await add(member.email).expect(409);
    });

    it('apenas o dono adiciona membros', async () => {
      const owner = await registerUser(ctx.app);
      const member = await registerUser(ctx.app);
      const other = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      await ctx.prisma.projectMember.create({ data: { projectId, userId: member.id } });

      await http()
        .post(`/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({ email: other.email })
        .expect(403);
    });

    it('remove membro e libera as tarefas atribuídas a ele', async () => {
      const owner = await registerUser(ctx.app);
      const member = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      await ctx.prisma.projectMember.create({ data: { projectId, userId: member.id } });
      const taskId = await createTask(ctx.app, owner.token, projectId, { assigneeId: member.id });

      await http()
        .delete(`/projects/${projectId}/members/${member.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(204);

      const task = await ctx.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
      expect(task.assigneeId).toBeNull();
    });

    it('membro pode sair do projeto sozinho', async () => {
      const owner = await registerUser(ctx.app);
      const member = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      await ctx.prisma.projectMember.create({ data: { projectId, userId: member.id } });

      await http()
        .delete(`/projects/${projectId}/members/${member.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(204);
    });

    it('não permite remover o último dono nem um membro inexistente', async () => {
      const owner = await registerUser(ctx.app);
      const stranger = await registerUser(ctx.app);
      const projectId = await createProject(ctx.app, owner.token);
      const auth = `Bearer ${owner.token}`;

      await http()
        .delete(`/projects/${projectId}/members/${owner.id}`)
        .set('Authorization', auth)
        .expect(400);
      await http()
        .delete(`/projects/${projectId}/members/${stranger.id}`)
        .set('Authorization', auth)
        .expect(404);
    });
  });
});
