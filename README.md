# API de Gerenciamento de Tarefas

Projeto de back-end da disciplina. É uma API para organizar projetos em equipe: cada projeto tem membros e tarefas, e as tarefas podem depender umas das outras.

Além do CRUD, a API ajuda a decidir **o que fazer primeiro** e **quem deve pegar a próxima tarefa**:

- **Priorização automática**: cada tarefa recebe uma pontuação calculada a partir da importância, do prazo, de quantas outras tarefas ela libera, do esforço estimado e de já estar ou não em andamento. A resposta traz os motivos da pontuação (ex.: "Atrasada há 2 dias", "Libera 3 tarefas que dependem dela").
- **Dependências entre tarefas**: uma tarefa só pode ser iniciada quando as tarefas das quais ela depende estiverem concluídas. A API impede dependências circulares (A → B → C → A) e mostra o caminho do ciclo.
- **Carga de trabalho**: compara as horas estimadas das tarefas de cada pessoa com a capacidade semanal dela, considerando todos os projetos em que participa, e aponta quem está sobrecarregado. Também sugere o membro com mais folga para receber uma nova tarefa.

## Tecnologias

| | |
|---|---|
| Linguagem | TypeScript (Node.js 22) |
| Framework | NestJS 11 |
| Banco de dados | PostgreSQL 16 |
| ORM | Prisma 7 |
| Validação | Zod |
| Autenticação | JWT, senhas com scrypt |
| Testes | Vitest e Supertest |
| Lint e formatação | Biome |
| Documentação | Swagger (OpenAPI) |
| CI | GitHub Actions |

## Como rodar

Pré-requisitos: Node.js 22, pnpm e Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

A API sobe em `http://localhost:3000` e a documentação interativa fica em `http://localhost:3000/docs`.

O seed cria três usuários para teste (`ana@demo.com`, `bruno@demo.com` e `carla@demo.com`, todos com a senha `senha-demo-123`) e um projeto já com tarefas, dependências e prazos.

## Testes

```bash
pnpm test        # testes unitários
pnpm test:e2e    # testes de ponta a ponta (precisa do banco de testes: docker compose up -d)
pnpm test:cov    # todos os testes com relatório de cobertura
```

Os testes unitários cobrem as regras de negócio isoladas (cálculo de prioridade, detecção de ciclos, carga de trabalho, validação). Os testes e2e sobem a aplicação inteira contra um banco PostgreSQL separado (porta 5441) e testam as rotas de verdade, incluindo permissões e casos de erro. O CI exige no mínimo 90% de cobertura.

## Estrutura

```
src/
  auth/            cadastro, login, guard JWT e hash de senha
  users/           dados do usuário logado
  projects/        CRUD de projetos e membros
  tasks/           CRUD de tarefas e dependências
  prioritization/  cálculo de prioridade e próximas tarefas
  workload/        carga de trabalho e sugestão de responsável
  common/          validação com Zod, tratamento de erros e Swagger
  config/          validação das variáveis de ambiente
  database/        conexão com o banco via Prisma
prisma/            schema, migrations e seed
test/              testes e2e
docs/              atas de reunião e relatório de impeditivos
```

As regras principais (`priority.ts`, `dependency-graph.ts` e `workload.ts`) são funções puras, sem acesso ao banco. Os services buscam os dados e chamam essas funções. Assim as regras podem ser testadas sem banco de dados.

## Rotas

Todas as rotas, exceto cadastro, login e health, exigem o header `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cadastro |
| POST | `/auth/login` | Login |
| GET / PATCH / DELETE | `/users/me` | Dados da própria conta |
| GET | `/users/me/next-tasks` | Próximas tarefas do usuário, já priorizadas |
| POST / GET | `/projects` | Criar e listar projetos |
| GET / PATCH / DELETE | `/projects/:id` | Detalhar, editar e excluir projeto |
| GET / POST | `/projects/:id/members` | Listar e adicionar membros |
| DELETE | `/projects/:id/members/:userId` | Remover membro |
| POST / GET | `/projects/:id/tasks` | Criar e listar tarefas (filtros, ordenação e paginação) |
| GET | `/projects/:id/tasks/prioritized` | Tarefas abertas ordenadas por prioridade |
| GET | `/projects/:id/workload` | Carga de trabalho dos membros |
| GET | `/projects/:id/workload/suggest-assignee` | Sugestão de responsável |
| GET / PATCH / DELETE | `/tasks/:id` | Detalhar, editar e excluir tarefa |
| POST | `/tasks/:id/dependencies` | Adicionar dependência |
| DELETE | `/tasks/:id/dependencies/:dependsOnId` | Remover dependência |

## Como a prioridade é calculada

| Fator | Pontos |
|---|---|
| Importância baixa / média / alta / crítica | 10 / 25 / 40 / 55 |
| Atrasada | +35 |
| Prazo em até 1 dia / 3 dias / 7 dias | +30 / +20 / +10 |
| Cada tarefa pendente que depende dela | +5 (máximo +15) |
| Estimativa de até 2 horas | +5 |
| Já está em andamento | +5 |
| Bloqueada por dependências | pontuação × 0,3 |

## Carga de trabalho

Para cada membro, somamos as horas estimadas das tarefas abertas com prazo dentro do período consultado (7 dias por padrão), incluindo tarefas atrasadas e de outros projetos. Essa soma é comparada com a capacidade da pessoa no período:

| Utilização | Situação |
|---|---|
| abaixo de 40% | Disponível |
| 40% a 79% | Equilibrado |
| 80% a 100% | Atenção |
| acima de 100% | Sobrecarregado |
