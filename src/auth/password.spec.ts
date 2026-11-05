import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const a = await hashPassword('senha-secreta');
    const b = await hashPassword('senha-secreta');

    expect(a).not.toBe(b);
    expect(a).not.toContain('senha-secreta');
  });

  it('aceita a senha correta', async () => {
    const hash = await hashPassword('senha-secreta');

    await expect(verifyPassword('senha-secreta', hash)).resolves.toBe(true);
  });

  it('rejeita a senha errada', async () => {
    const hash = await hashPassword('senha-secreta');

    await expect(verifyPassword('outra-senha', hash)).resolves.toBe(false);
  });

  it('rejeita hash em formato inválido', async () => {
    await expect(verifyPassword('qualquer', 'formato-invalido')).resolves.toBe(false);
  });
});
