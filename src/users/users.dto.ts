import { z } from 'zod';

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    weeklyCapacityHours: z.number().int().min(1).max(80),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Informe ao menos um campo para atualizar');

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
