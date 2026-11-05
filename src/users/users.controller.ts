import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UpdateUserDto, updateUserSchema } from './users.dto';
import { UsersService } from './users.service';

@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Patch()
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
