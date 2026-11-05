import { Controller, Get, INestApplication, Post, Query } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { ApiZodBody, ApiZodQuery, setupSwagger } from './api-docs';

const bodySchema = z.object({ title: z.string().min(2), done: z.boolean().optional() });
const querySchema = z.object({
  page: z.coerce.number().int().default(1),
  search: z.string(),
});

@Controller('exemplo')
class ExampleController {
  @Post()
  @ApiZodBody(bodySchema)
  create() {
    return {};
  }

  @Get()
  @ApiZodQuery(querySchema)
  list(@Query() _query: unknown) {
    return [];
  }
}

describe('api-docs', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExampleController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('gera o corpo da requisição a partir do schema do Zod', () => {
    const document = SwaggerModule.createDocument(app, { openapi: '3.0.0', info: {} as never });
    const body = document.paths['/exemplo'].post?.requestBody as {
      content: Record<string, { schema: { required: string[]; properties: object } }>;
    };

    const schema = body.content['application/json'].schema;
    expect(schema.required).toEqual(['title']);
    expect(Object.keys(schema.properties)).toEqual(['title', 'done']);
  });

  it('gera os parâmetros de query indicando quais são obrigatórios', () => {
    const document = SwaggerModule.createDocument(app, { openapi: '3.0.0', info: {} as never });
    const parameters = document.paths['/exemplo'].get?.parameters as {
      name: string;
      required: boolean;
    }[];

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page', required: false }),
        expect.objectContaining({ name: 'search', required: true }),
      ]),
    );
  });

  it('registra a documentação na rota /docs', () => {
    const setup = vi.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);

    setupSwagger(app);

    expect(setup).toHaveBeenCalledWith('docs', app, expect.any(Object));
    setup.mockRestore();
  });
});
