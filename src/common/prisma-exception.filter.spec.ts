import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erro', { code, clientVersion: 'test' });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 400],
    ['P9999', 500],
  ])('converte o código %s para HTTP %i', (code, expected) => {
    const { host, status, json } = makeHost();

    filter.catch(prismaError(code), host);

    expect(status).toHaveBeenCalledWith(expected);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: expected }));
  });
});
