import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { toPublicUser } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await hashPassword(data.password),
        weeklyCapacityHours: data.weeklyCapacityHours,
      },
    });

    return { user: toPublicUser(user), accessToken: await this.signToken(user.id, user.email) };
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    return { user: toPublicUser(user), accessToken: await this.signToken(user.id, user.email) };
  }

  private signToken(userId: string, email: string) {
    return this.jwt.signAsync({ sub: userId, email });
  }
}
