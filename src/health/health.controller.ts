import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Rota simples para verificar se a API está no ar. */
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
