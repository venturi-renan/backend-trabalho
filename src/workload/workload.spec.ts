import {
  calculateWorkload,
  isInHorizon,
  MemberWorkload,
  suggestAssignee,
  WorkloadMember,
  WorkloadTask,
  workloadStatus,
} from './workload';

const now = new Date('2026-11-10T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const ana: WorkloadMember = { id: 'ana', name: 'Ana', weeklyCapacityHours: 20 };
const bia: WorkloadMember = { id: 'bia', name: 'Bia', weeklyCapacityHours: 40 };

const taskFor = (
  assigneeId: string,
  estimatedHours: number | null,
  dueInDays: number | null,
): WorkloadTask => ({
  assigneeId,
  estimatedHours,
  dueDate: dueInDays === null ? null : inDays(dueInDays),
});

describe('workloadStatus', () => {
  it.each([
    [0, 'AVAILABLE'],
    [0.39, 'AVAILABLE'],
    [0.4, 'BALANCED'],
    [0.79, 'BALANCED'],
    [0.8, 'ATTENTION'],
    [1, 'ATTENTION'],
    [1.01, 'OVERLOADED'],
  ])('utilização %f é %s', (utilization, expected) => {
    expect(workloadStatus(utilization)).toBe(expected);
  });
});

describe('isInHorizon', () => {
  it('considera tarefas atrasadas e dentro do período', () => {
    expect(isInHorizon(inDays(-3), now, 7)).toBe(true);
    expect(isInHorizon(inDays(7), now, 7)).toBe(true);
  });

  it('ignora tarefas fora do período ou sem prazo', () => {
    expect(isInHorizon(inDays(8), now, 7)).toBe(false);
    expect(isInHorizon(null, now, 7)).toBe(false);
  });
});

describe('calculateWorkload', () => {
  it('soma as horas das tarefas no período e compara com a capacidade', () => {
    const tasks = [taskFor('ana', 10, 2), taskFor('ana', 15, 5), taskFor('bia', 8, 1)];

    const [first, second] = calculateWorkload([ana, bia], tasks, now, 7);

    expect(first).toEqual({
      userId: 'ana',
      name: 'Ana',
      capacityHours: 20,
      plannedHours: 25,
      unestimatedTasks: 0,
      utilization: 1.25,
      status: 'OVERLOADED',
    });
    expect(second).toMatchObject({ userId: 'bia', plannedHours: 8, status: 'AVAILABLE' });
  });

  it('ajusta a capacidade ao tamanho do período', () => {
    const [result] = calculateWorkload([bia], [], now, 14);

    expect(result.capacityHours).toBe(80);
  });

  it('conta tarefas sem estimativa separadamente', () => {
    const tasks = [taskFor('ana', null, 1), taskFor('ana', null, 2), taskFor('ana', 4, 3)];

    const [result] = calculateWorkload([ana], tasks, now, 7);

    expect(result.plannedHours).toBe(4);
    expect(result.unestimatedTasks).toBe(2);
  });

  it('ignora tarefas fora do período e de outras pessoas', () => {
    const tasks = [taskFor('ana', 10, 30), taskFor('ana', 10, null), taskFor('bia', 10, 1)];

    const [result] = calculateWorkload([ana], tasks, now, 7);

    expect(result.plannedHours).toBe(0);
  });

  it('trata capacidade zero sem dividir por zero', () => {
    const [result] = calculateWorkload(
      [{ id: 'x', name: 'X', weeklyCapacityHours: 0 }],
      [taskFor('x', 5, 1)],
      now,
      7,
    );

    expect(result.utilization).toBe(0);
  });
});

describe('suggestAssignee', () => {
  const member = (overrides: Partial<MemberWorkload>): MemberWorkload => ({
    userId: 'id',
    name: 'Nome',
    capacityHours: 40,
    plannedHours: 0,
    unestimatedTasks: 0,
    utilization: 0,
    status: 'AVAILABLE',
    ...overrides,
  });

  it('sugere quem fica com menor utilização depois de receber a tarefa', () => {
    const workload = [
      member({ userId: 'ana', capacityHours: 20, plannedHours: 10 }),
      member({ userId: 'bia', capacityHours: 40, plannedHours: 16 }),
    ];

    const suggestion = suggestAssignee(workload, 4);

    expect(suggestion?.userId).toBe('bia');
    expect(suggestion?.utilizationAfter).toBe(0.5);
  });

  it('desempata pela quantidade de tarefas sem estimativa', () => {
    const workload = [
      member({ userId: 'ana', unestimatedTasks: 3 }),
      member({ userId: 'bia', unestimatedTasks: 0 }),
    ];

    expect(suggestAssignee(workload, 4)?.userId).toBe('bia');
  });

  it('ignora membros sem capacidade e retorna null se não houver ninguém', () => {
    expect(suggestAssignee([member({ capacityHours: 0 })], 4)).toBeNull();
    expect(suggestAssignee([], 4)).toBeNull();
  });
});
