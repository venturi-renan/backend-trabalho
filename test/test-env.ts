export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5441/tarefas_test?schema=public',
  JWT_SECRET: 'segredo-usado-apenas-nos-testes',
  JWT_EXPIRES_IN: '1h',
};
