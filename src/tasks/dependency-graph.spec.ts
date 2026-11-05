import { DependencyEdge, findDependencyPath, wouldCreateCycle } from './dependency-graph';

const edge = (taskId: string, dependsOnId: string): DependencyEdge => ({ taskId, dependsOnId });

describe('findDependencyPath', () => {
  const edges = [edge('C', 'B'), edge('B', 'A'), edge('D', 'A')];

  it('encontra o caminho transitivo entre duas tarefas', () => {
    expect(findDependencyPath(edges, 'C', 'A')).toEqual(['C', 'B', 'A']);
  });

  it('retorna null quando não existe caminho', () => {
    expect(findDependencyPath(edges, 'A', 'C')).toBeNull();
    expect(findDependencyPath(edges, 'D', 'B')).toBeNull();
  });

  it('considera que uma tarefa alcança a si mesma', () => {
    expect(findDependencyPath(edges, 'A', 'A')).toEqual(['A']);
  });
});

describe('wouldCreateCycle', () => {
  it('detecta tarefa dependendo de si mesma', () => {
    expect(wouldCreateCycle([], 'A', 'A')).toEqual(['A', 'A']);
  });

  it('detecta ciclo direto (A -> B e B -> A)', () => {
    expect(wouldCreateCycle([edge('B', 'A')], 'A', 'B')).toEqual(['A', 'B', 'A']);
  });

  it('detecta ciclo indireto e devolve o caminho completo', () => {
    const edges = [edge('B', 'A'), edge('C', 'B')];

    expect(wouldCreateCycle(edges, 'A', 'C')).toEqual(['A', 'C', 'B', 'A']);
  });

  it('permite dependências que não formam ciclo', () => {
    const edges = [edge('B', 'A'), edge('C', 'B')];

    expect(wouldCreateCycle(edges, 'C', 'A')).toBeNull();
    expect(wouldCreateCycle(edges, 'D', 'C')).toBeNull();
  });

  it('funciona com grafos com vários caminhos possíveis', () => {
    const edges = [edge('D', 'B'), edge('D', 'C'), edge('B', 'A'), edge('C', 'A')];

    expect(wouldCreateCycle(edges, 'A', 'D')).not.toBeNull();
    expect(wouldCreateCycle(edges, 'E', 'D')).toBeNull();
  });
});
