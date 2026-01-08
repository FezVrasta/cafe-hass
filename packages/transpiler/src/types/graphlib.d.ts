declare module 'graphlib' {
  export class Graph {
    constructor(opts?: { directed?: boolean; compound?: boolean; multigraph?: boolean });

    setNode(v: string, value?: unknown): this;
    setEdge(v: string, w: string, value?: unknown, name?: string): this;

    node(v: string): unknown;
    edge(v: string, w: string, name?: string): unknown;

    hasNode(v: string): boolean;
    hasEdge(v: string, w: string, name?: string): boolean;

    removeNode(v: string): this;
    removeEdge(v: string, w: string, name?: string): this;

    nodes(): string[];
    edges(): Array<{ v: string; w: string; name?: string }>;

    predecessors(v: string): string[] | undefined;
    successors(v: string): string[] | undefined;

    inEdges(v: string, u?: string): Array<{ v: string; w: string }> | undefined;
    outEdges(v: string, w?: string): Array<{ v: string; w: string }> | undefined;

    nodeCount(): number;
    edgeCount(): number;

    isDirected(): boolean;
    isMultigraph(): boolean;
    isCompound(): boolean;
  }

  export namespace alg {
    function isAcyclic(g: Graph): boolean;
    function topsort(g: Graph): string[];
    function findCycles(g: Graph): string[][];
    function components(g: Graph): string[][];
    function dijkstra(
      g: Graph,
      source: string,
      weightFn?: (e: { v: string; w: string }) => number,
      edgeFn?: (v: string) => Array<{ v: string; w: string }>
    ): Record<string, { distance: number; predecessor?: string }>;
  }
}
