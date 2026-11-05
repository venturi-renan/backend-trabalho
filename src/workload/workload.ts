export type WorkloadStatus = 'AVAILABLE' | 'BALANCED' | 'ATTENTION' | 'OVERLOADED';

export interface WorkloadTask {
  assigneeId: string;
  estimatedHours: number | null;
  dueDate: Date | null;
}

export interface WorkloadMember {
  id: string;
  name: string;
  weeklyCapacityHours: number;
}

export interface MemberWorkload {
  userId: string;
  name: string;
  capacityHours: number;
  plannedHours: number;
  unestimatedTasks: number;
  utilization: number;
  status: WorkloadStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function workloadStatus(utilization: number): WorkloadStatus {
  if (utilization > 1) return 'OVERLOADED';
  if (utilization >= 0.8) return 'ATTENTION';
  if (utilization >= 0.4) return 'BALANCED';
  return 'AVAILABLE';
}

export function isInHorizon(dueDate: Date | null, now: Date, horizonDays: number): boolean {
  if (!dueDate) return false;
  return dueDate.getTime() <= now.getTime() + horizonDays * DAY_MS;
}

export function calculateWorkload(
  members: WorkloadMember[],
  tasks: WorkloadTask[],
  now: Date,
  horizonDays: number,
): MemberWorkload[] {
  return members
    .map((member) => {
      const memberTasks = tasks.filter(
        (task) => task.assigneeId === member.id && isInHorizon(task.dueDate, now, horizonDays),
      );

      const plannedHours = memberTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
      const unestimatedTasks = memberTasks.filter((task) => task.estimatedHours === null).length;
      const capacityHours = Math.round((member.weeklyCapacityHours * horizonDays) / 7);
      const utilization = capacityHours > 0 ? plannedHours / capacityHours : 0;

      return {
        userId: member.id,
        name: member.name,
        capacityHours,
        plannedHours,
        unestimatedTasks,
        utilization: Math.round(utilization * 100) / 100,
        status: workloadStatus(utilization),
      };
    })
    .sort((a, b) => b.utilization - a.utilization);
}

export function suggestAssignee(
  workload: MemberWorkload[],
  extraHours: number,
): (MemberWorkload & { utilizationAfter: number }) | null {
  const candidates = workload
    .map((member) => ({
      ...member,
      utilizationAfter:
        member.capacityHours > 0
          ? Math.round(((member.plannedHours + extraHours) / member.capacityHours) * 100) / 100
          : Number.POSITIVE_INFINITY,
    }))
    .filter((member) => member.capacityHours > 0)
    .sort(
      (a, b) => a.utilizationAfter - b.utilizationAfter || a.unestimatedTasks - b.unestimatedTasks,
    );

  return candidates[0] ?? null;
}
