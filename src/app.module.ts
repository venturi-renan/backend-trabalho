import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { PrioritizationModule } from './prioritization/prioritization.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { WorkloadModule } from './workload/workload.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    PrioritizationModule,
    WorkloadModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: PrismaExceptionFilter }],
})
export class AppModule {}
