import { z } from 'zod';
import { ProjectRole } from '../generated/prisma/enums';

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(120),
  description: z.string().trim().max(1000).optional(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo para atualizar');

export const addMemberSchema = z.object({
  email: z.email('E-mail inválido').toLowerCase(),
  role: z.enum(ProjectRole).default(ProjectRole.MEMBER),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
