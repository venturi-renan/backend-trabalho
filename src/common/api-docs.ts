import { applyDecorators, INestApplication } from '@nestjs/common';
import { ApiBody, ApiQuery, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z } from 'zod';

function toOpenApi(schema: z.ZodType): SchemaObject {
  const { $schema: _, ...json } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  return json as SchemaObject;
}

export function ApiZodBody(schema: z.ZodType) {
  return ApiBody({ schema: toOpenApi(schema) });
}

export function ApiZodQuery(schema: z.ZodObject) {
  const json = toOpenApi(schema);
  const required = new Set(json.required ?? []);

  return applyDecorators(
    ...Object.entries(json.properties ?? {}).map(([name, property]) =>
      ApiQuery({ name, required: required.has(name), schema: property as SchemaObject }),
    ),
  );
}

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API de Gerenciamento de Tarefas')
    .setDescription(
      'Projetos, tarefas com dependências, priorização automática e análise de carga de trabalho.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
