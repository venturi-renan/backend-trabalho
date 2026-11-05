import { loadEnv } from './env';

describe('loadEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tarefas',
    JWT_SECRET: 'um-segredo-bem-grande-aqui',
  };

  it('aplica os valores padrão quando variáveis opcionais não são informadas', () => {
    const env = loadEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN).toBe('1d');
  });

  it('converte PORT de string para número', () => {
    const env = loadEnv({ ...validEnv, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('lança erro listando as variáveis inválidas', () => {
    expect(() => loadEnv({ JWT_SECRET: 'curto' })).toThrowError(/DATABASE_URL[\s\S]*JWT_SECRET/);
  });
});
