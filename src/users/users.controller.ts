import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ApiZodBody } from '../common/api-docs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UpdateUserDto, updateUserSchema } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Usuário')
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Patch()
  @ApiZodBody(updateUserSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser) {
    return this.usersService.remove(user.id);
  }
}
