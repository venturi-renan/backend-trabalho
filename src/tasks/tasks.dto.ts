import { z } from 'zod';
import { TaskImportance, TaskStatus } from '../generated/prisma/enums';

const taskFields = {
  title: z.string().trim().min(2, 'Título deve ter pelo menos 2 caracteres').max(200),
  description: z.string().trim().max(5000).nullable(),
  status: z.enum(TaskStatus),
  importance: z.enum(TaskImportance),
  estimatedHours: z.number().int().min(1).max(200).nullable(),
  dueDate: z.coerce.date().nullable(),
  assigneeId: z.uuid().nullable(),
};

export const createTaskSchema = z.object({
  title: taskFields.title,
  description: taskFields.description.optional(),
  importance: taskFields.importance.optional(),
  estimatedHours: taskFields.estimatedHours.optional(),
  dueDate: taskFields.dueDate.optional(),
  assigneeId: taskFields.assigneeId.optional(),
});

export const updateTaskSchema = z
  .object(taskFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo para atualizar');

export const listTasksQuerySchema = z.object({
  status: z.enum(TaskStatus).optional(),
  assigneeId: z.uuid().optional(),
  sort: z.enum(['createdAt', 'dueDate']).default('createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
