export interface DependencyEdge {
  taskId: string;
  dependsOnId: string;
}

export function findDependencyPath(
  edges: DependencyEdge[],
  from: string,
  to: string,
): string[] | null {
  const graph = new Map<string, string[]>();
  for (const { taskId, dependsOnId } of edges) {
    const list = graph.get(taskId) ?? [];
    list.push(dependsOnId);
    graph.set(taskId, list);
  }

  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift() as string;

    if (current === to) {
      const path: string[] = [];
      for (let node: string | null = current; node !== null; node = previous.get(node) ?? null) {
        path.unshift(node);
      }
      return path;
    }

    for (const next of graph.get(current) ?? []) {
      if (!previous.has(next)) {
        previous.set(next, current);
        queue.push(next);
      }
    }
  }

  return null;
}

export function wouldCreateCycle(
  edges: DependencyEdge[],
  taskId: string,
  dependsOnId: string,
): string[] | null {
  if (taskId === dependsOnId) return [taskId, taskId];

  const path = findDependencyPath(edges, dependsOnId, taskId);
  return path ? [taskId, ...path] : null;
}
