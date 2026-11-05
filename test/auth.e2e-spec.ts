import request from 'supertest';
import { createTestApp, registerUser, resetDatabase, TestContext } from './helpers';

describe('Autenticação e usuário (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('cadastra o usuário e retorna token sem expor a senha', async () => {
      const response = await http()
        .post('/auth/register')
        .send({ name: 'Ana', email: 'ANA@Teste.com', password: 'senha-forte-123' })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        name: 'Ana',
        email: 'ana@teste.com',
        weeklyCapacityHours: 40,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('retorna 409 para e-mail já cadastrado', async () => {
      const body = { name: 'Ana', email: 'ana@teste.com', password: 'senha-forte-123' };
      await http().post('/auth/register').send(body).expect(201);

      await http().post('/auth/register').send(body).expect(409);
    });

    it('retorna 400 com os campos inválidos', async () => {
      const response = await http()
        .post('/auth/register')
        .send({ name: 'A', email: 'invalido', password: '123' })
        .expect(400);

      expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual([
        'name',
        'email',
        'password',
      ]);
    });
  });

  describe('POST /auth/login', () => {
    it('autentica com credenciais corretas', async () => {
      const user = await registerUser(ctx.app);

      const response = await http()
        .post('/auth/login')
        .send({ email: user.email, password: 'senha-forte-123' })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('retorna 401 com senha errada ou e-mail inexistente', async () => {
      const user = await registerUser(ctx.app);

      await http().post('/auth/login').send({ email: user.email, password: 'errada' }).expect(401);
      await http()
        .post('/auth/login')
        .send({ email: 'ninguem@teste.com', password: 'qualquer' })
        .expect(401);
    });
  });

  describe('rotas protegidas', () => {
    it('recusa requisição sem token ou com token inválido', async () => {
      await http().get('/users/me').expect(401);
      await http().get('/users/me').set('Authorization', 'Bearer token-falso').expect(401);
      await http().get('/users/me').set('Authorization', 'Basic abc').expect(401);
    });

    it('a rota de health é pública', async () => {
      await http().get('/health').expect(200);
    });
  });

  describe('/users/me', () => {
    it('retorna, atualiza e exclui o próprio usuário', async () => {
      const user = await registerUser(ctx.app, { name: 'Bruno' });
      const auth = `Bearer ${user.token}`;

      const me = await http().get('/users/me').set('Authorization', auth).expect(200);
      expect(me.body).toMatchObject({ id: user.id, name: 'Bruno' });

      const updated = await http()
        .patch('/users/me')
        .set('Authorization', auth)
        .send({ weeklyCapacityHours: 20 })
        .expect(200);
      expect(updated.body.weeklyCapacityHours).toBe(20);

      await http().patch('/users/me').set('Authorization', auth).send({}).expect(400);

      await http().delete('/users/me').set('Authorization', auth).expect(204);
      await http().get('/users/me').set('Authorization', auth).expect(404);
    });
  });
});
