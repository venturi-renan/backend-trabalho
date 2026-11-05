import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.email('E-mail inválido').toLowerCase(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(72),
  weeklyCapacityHours: z.number().int().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.email('E-mail inválido').toLowerCase(),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
