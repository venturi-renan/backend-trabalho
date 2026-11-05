import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({
      name: z.string().min(2),
      age: z.coerce.number().int(),
    }),
  );

  it('retorna o valor já transformado quando é válido', () => {
    expect(pipe.transform({ name: 'Ana', age: '20' })).toEqual({ name: 'Ana', age: 20 });
  });

  it('lança BadRequest com os campos inválidos', () => {
    try {
      pipe.transform({ name: 'A', age: 'abc' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        errors: { field: string }[];
      };
      expect(response.errors.map((e) => e.field)).toEqual(['name', 'age']);
    }
  });
});
