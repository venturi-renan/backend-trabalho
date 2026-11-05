import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.map(exception.code);

    response.status(status).json({ statusCode: status, message });
  }

  private map(code: string): { status: number; message: string } {
    switch (code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'Registro já existe' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Registro não encontrado' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Referência inválida' };
      default:
        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erro interno no servidor' };
    }
  }
}
