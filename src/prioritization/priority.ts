import { TaskImportance, TaskStatus } from '../generated/prisma/enums';

export interface PriorityInput {
  status: TaskStatus;
  importance: TaskImportance;
  dueDate: Date | null;
  estimatedHours: number | null;
  pendingDependencies: number;
  pendingDependents: number;
}

export interface PriorityResult {
  score: number;
  blocked: boolean;
  reasons: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const IMPORTANCE_POINTS: Record<TaskImportance, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 40,
  CRITICAL: 55,
};

const IMPORTANCE_LABEL: Record<TaskImportance, string> = {
  LOW: 'baixa',
  MEDIUM: 'média',
  HIGH: 'alta',
  CRITICAL: 'crítica',
};

const BLOCKED_FACTOR = 0.3;
const POINTS_PER_DEPENDENT = 5;
const MAX_DEPENDENT_POINTS = 15;
const QUICK_WIN_HOURS = 2;

export function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function deadlinePoints(dueDate: Date | null, now: Date): { points: number; reason?: string } {
  if (!dueDate) return { points: 0 };

  const days = daysUntil(dueDate, now);

  if (days < 0) {
    const late = Math.abs(days);
    return { points: 35, reason: `Atrasada há ${late} dia${late > 1 ? 's' : ''}` };
  }
  if (days <= 1) return { points: 30, reason: 'Prazo vence em até 1 dia' };
  if (days <= 3) return { points: 20, reason: `Prazo vence em ${days} dias` };
  if (days <= 7) return { points: 10, reason: `Prazo vence em ${days} dias` };

  return { points: 0 };
}

export function calculatePriority(task: PriorityInput, now = new Date()): PriorityResult {
  if (task.status === TaskStatus.DONE) {
    return { score: 0, blocked: false, reasons: ['Tarefa concluída'] };
  }

  const reasons: string[] = [];
  let score = IMPORTANCE_POINTS[task.importance];
  reasons.push(`Importância ${IMPORTANCE_LABEL[task.importance]}`);

  const deadline = deadlinePoints(task.dueDate, now);
  score += deadline.points;
  if (deadline.reason) reasons.push(deadline.reason);

  if (task.pendingDependents > 0) {
    score += Math.min(task.pendingDependents * POINTS_PER_DEPENDENT, MAX_DEPENDENT_POINTS);
    const n = task.pendingDependents;
    reasons.push(`Libera ${n} tarefa${n > 1 ? 's' : ''} que depende${n > 1 ? 'm' : ''} dela`);
  }

  if (task.estimatedHours !== null && task.estimatedHours <= QUICK_WIN_HOURS) {
    score += 5;
    reasons.push('Tarefa rápida (até 2h)');
  }

  if (task.status === TaskStatus.IN_PROGRESS) {
    score += 5;
    reasons.push('Já está em andamento');
  }

  const blocked = task.pendingDependencies > 0;
  if (blocked) {
    score *= BLOCKED_FACTOR;
    const n = task.pendingDependencies;
    reasons.push(`Bloqueada por ${n} tarefa${n > 1 ? 's' : ''} pendente${n > 1 ? 's' : ''}`);
  }

  return { score: Math.round(score), blocked, reasons };
}
