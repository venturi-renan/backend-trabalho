import { TaskImportance, TaskStatus } from '../generated/prisma/enums';
import { calculatePriority, daysUntil, PriorityInput } from './priority';

const now = new Date('2026-11-10T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

function task(overrides: Partial<PriorityInput> = {}): PriorityInput {
  return {
    status: TaskStatus.TODO,
    importance: TaskImportance.MEDIUM,
    dueDate: null,
    estimatedHours: null,
    pendingDependencies: 0,
    pendingDependents: 0,
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('arredonda para cima frações de dia', () => {
    expect(daysUntil(new Date('2026-11-11T00:00:00Z'), now)).toBe(1);
  });

  it('retorna negativo para datas passadas', () => {
    expect(daysUntil(inDays(-3), now)).toBe(-3);
  });
});

describe('calculatePriority', () => {
  it('usa apenas a importância quando não há outros fatores', () => {
    const result = calculatePriority(task(), now);

    expect(result).toEqual({ score: 25, blocked: false, reasons: ['Importância média'] });
  });

  it.each([
    [TaskImportance.LOW, 10],
    [TaskImportance.MEDIUM, 25],
    [TaskImportance.HIGH, 40],
    [TaskImportance.CRITICAL, 55],
  ])('importância %s vale %i pontos', (importance, expected) => {
    expect(calculatePriority(task({ importance }), now).score).toBe(expected);
  });

  it.each([
    [-2, 35, 'Atrasada há 2 dias'],
    [-1, 35, 'Atrasada há 1 dia'],
    [1, 30, 'Prazo vence em até 1 dia'],
    [3, 20, 'Prazo vence em 3 dias'],
    [7, 10, 'Prazo vence em 7 dias'],
  ])('prazo em %i dia(s) soma %i pontos', (days, points, reason) => {
    const result = calculatePriority(task({ dueDate: inDays(days) }), now);

    expect(result.score).toBe(25 + points);
    expect(result.reasons).toContain(reason);
  });

  it('prazo distante não soma pontos', () => {
    const result = calculatePriority(task({ dueDate: inDays(30) }), now);

    expect(result.score).toBe(25);
    expect(result.reasons).toHaveLength(1);
  });

  it('valoriza tarefas que desbloqueiam outras, com limite de 15 pontos', () => {
    expect(calculatePriority(task({ pendingDependents: 1 }), now).score).toBe(30);
    expect(calculatePriority(task({ pendingDependents: 2 }), now).reasons).toContain(
      'Libera 2 tarefas que dependem dela',
    );
    expect(calculatePriority(task({ pendingDependents: 10 }), now).score).toBe(40);
  });

  it('dá bônus para tarefas rápidas', () => {
    expect(calculatePriority(task({ estimatedHours: 2 }), now).score).toBe(30);
    expect(calculatePriority(task({ estimatedHours: 3 }), now).score).toBe(25);
  });

  it('dá bônus para tarefas já em andamento', () => {
    const result = calculatePriority(task({ status: TaskStatus.IN_PROGRESS }), now);

    expect(result.score).toBe(30);
    expect(result.reasons).toContain('Já está em andamento');
  });

  it('reduz a prioridade de tarefas bloqueadas', () => {
    const result = calculatePriority(
      task({ importance: TaskImportance.CRITICAL, pendingDependencies: 2 }),
      now,
    );

    expect(result.blocked).toBe(true);
    expect(result.score).toBe(17);
    expect(result.reasons).toContain('Bloqueada por 2 tarefas pendentes');
  });

  it('tarefa concluída tem prioridade zero', () => {
    const result = calculatePriority(
      task({ status: TaskStatus.DONE, importance: TaskImportance.CRITICAL, dueDate: inDays(-5) }),
      now,
    );

    expect(result).toEqual({ score: 0, blocked: false, reasons: ['Tarefa concluída'] });
  });

  it('tarefa atrasada e importante fica acima de tarefa crítica sem prazo', () => {
    const lateHigh = calculatePriority(
      task({ importance: TaskImportance.HIGH, dueDate: inDays(-1) }),
      now,
    );
    const critical = calculatePriority(task({ importance: TaskImportance.CRITICAL }), now);

    expect(lateHigh.score).toBeGreaterThan(critical.score);
  });
});
