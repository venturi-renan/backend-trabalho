import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/api-docs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LoginDto, loginSchema, RegisterDto, registerSchema } from './auth.dto';
import { AuthService } from './auth.service';
import { Public } from './decorators';

@ApiTags('Autenticação')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiZodBody(registerSchema)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(loginSchema)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto) {
    return this.authService.login(body);
  }
}
