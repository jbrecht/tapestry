import { describe, it, expect } from 'vitest';
import { applyExtractionResult } from './extractor.js';
import type { TapestryNode, TapestryEdge } from './schema.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<TapestryNode> & { id: string; label: string }): TapestryNode {
  return {
    type: 'Person',
    description: '',
    attributes: {},
    ...overrides,
  };
}

function makeEdge(overrides: Partial<TapestryEdge> & { id: string; sourceId: string; targetId: string; predicate: string }): TapestryEdge {
  return { ...overrides };
}

function emptyResult(overrides: object = {}) {
  return {
    extractedNodes: [],
    extractedEdges: [],
    edgesToRemove: [],
    suggestedFollowUp: '',
    ...overrides,
  };
}

function extractedNode(overrides: object = {}) {
  return {
    label: 'Alice',
    type: 'Person' as const,
    description: null,
    attributes: { coordinates: null, startTime: null, endTime: null, locationType: null, extraInfo: null },
    ...overrides,
  };
}

// ─── Node tests ─────────────────────────────────────────────────────────────

describe('applyExtractionResult — nodes', () => {
  it('adds a new node when label is not present', () => {
    const { nodes } = applyExtractionResult([], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'Alice' })],
    }));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].label).toBe('Alice');
    expect(nodes[0].id).toBeTruthy();
  });

  it('does not create a duplicate when label matches case-insensitively', () => {
    const existing = makeNode({ id: 'node-1', label: 'Alice' });
    const { nodes } = applyExtractionResult([existing], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'alice' })],
    }));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('node-1');
  });

  it('merges attributes into an existing node', () => {
    const existing = makeNode({ id: 'node-1', label: 'Alice', attributes: { job: 'engineer' } });
    const { nodes } = applyExtractionResult([existing], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'Alice', attributes: { coordinates: null, startTime: null, endTime: null, locationType: null, extraInfo: 'loves hiking' } })],
    }));
    expect(nodes[0].attributes).toMatchObject({ job: 'engineer', extraInfo: 'loves hiking' });
  });

  it('strips null attributes before saving', () => {
    const { nodes } = applyExtractionResult([], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'Alice', attributes: { coordinates: null, startTime: null, endTime: null, locationType: null, extraInfo: 'something' } })],
    }));
    expect(nodes[0].attributes).not.toHaveProperty('coordinates');
    expect(nodes[0].attributes).not.toHaveProperty('startTime');
    expect(nodes[0].attributes).toHaveProperty('extraInfo', 'something');
  });

  it('updates description on an existing node when a new one is provided', () => {
    const existing = makeNode({ id: 'node-1', label: 'Alice', description: 'old description' });
    const { nodes } = applyExtractionResult([existing], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'Alice', description: 'new description' })],
    }));
    expect(nodes[0].description).toBe('new description');
  });

  it('does not overwrite description when new node has no description', () => {
    const existing = makeNode({ id: 'node-1', label: 'Alice', description: 'keep this' });
    const { nodes } = applyExtractionResult([existing], [], emptyResult({
      extractedNodes: [extractedNode({ label: 'Alice', description: null })],
    }));
    expect(nodes[0].description).toBe('keep this');
  });
});

// ─── Edge tests ─────────────────────────────────────────────────────────────

describe('applyExtractionResult — edges', () => {
  const alice = makeNode({ id: 'node-alice', label: 'Alice' });
  const bob = makeNode({ id: 'node-bob', label: 'Bob' });

  it('creates an edge between two existing nodes', () => {
    const { edges } = applyExtractionResult([alice, bob], [], emptyResult({
      extractedEdges: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'KNOWS' }],
    }));
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ sourceId: 'node-alice', targetId: 'node-bob', predicate: 'KNOWS' });
    expect(edges[0].id).toBeTruthy();
  });

  it('matches node labels case-insensitively when creating edges', () => {
    const { edges } = applyExtractionResult([alice, bob], [], emptyResult({
      extractedEdges: [{ sourceLabel: 'alice', targetLabel: 'BOB', predicate: 'KNOWS' }],
    }));
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ sourceId: 'node-alice', targetId: 'node-bob' });
  });

  it('skips an edge when the source node does not exist', () => {
    const { edges } = applyExtractionResult([alice], [], emptyResult({
      extractedEdges: [{ sourceLabel: 'Alice', targetLabel: 'Unknown', predicate: 'KNOWS' }],
    }));
    expect(edges).toHaveLength(0);
  });

  it('skips an edge when the target node does not exist', () => {
    const { edges } = applyExtractionResult([bob], [], emptyResult({
      extractedEdges: [{ sourceLabel: 'Unknown', targetLabel: 'Bob', predicate: 'KNOWS' }],
    }));
    expect(edges).toHaveLength(0);
  });
});

// ─── Edge removal tests ──────────────────────────────────────────────────────

describe('applyExtractionResult — edge removal', () => {
  const alice = makeNode({ id: 'node-alice', label: 'Alice' });
  const bob = makeNode({ id: 'node-bob', label: 'Bob' });
  const existingEdge = makeEdge({ id: 'edge-1', sourceId: 'node-alice', targetId: 'node-bob', predicate: 'SPOUSE_OF' });

  it('removes an edge listed in edgesToRemove', () => {
    const { edges } = applyExtractionResult([alice, bob], [existingEdge], emptyResult({
      edgesToRemove: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'SPOUSE_OF' }],
    }));
    expect(edges).toHaveLength(0);
  });

  it('does not remove an edge with a different predicate', () => {
    const { edges } = applyExtractionResult([alice, bob], [existingEdge], emptyResult({
      edgesToRemove: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'KNOWS' }],
    }));
    expect(edges).toHaveLength(1);
  });

  it('converts a NOT_ prefixed edge predicate into a removal', () => {
    const { edges } = applyExtractionResult([alice, bob], [existingEdge], emptyResult({
      extractedEdges: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'NOT_SPOUSE_OF' }],
    }));
    expect(edges).toHaveLength(0);
  });

  it('strips NOT_ correctly regardless of case', () => {
    const { edges } = applyExtractionResult([alice, bob], [existingEdge], emptyResult({
      extractedEdges: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'not_SPOUSE_OF' }],
    }));
    expect(edges).toHaveLength(0);
  });

  it('does not add a NOT_ edge to the graph', () => {
    const { edges } = applyExtractionResult([alice, bob], [], emptyResult({
      extractedEdges: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'NOT_KNOWS' }],
    }));
    expect(edges).toHaveLength(0);
  });

  it('preserves unrelated edges when removing a specific one', () => {
    const otherEdge = makeEdge({ id: 'edge-2', sourceId: 'node-alice', targetId: 'node-bob', predicate: 'KNOWS' });
    const { edges } = applyExtractionResult([alice, bob], [existingEdge, otherEdge], emptyResult({
      edgesToRemove: [{ sourceLabel: 'Alice', targetLabel: 'Bob', predicate: 'SPOUSE_OF' }],
    }));
    expect(edges).toHaveLength(1);
    expect(edges[0].predicate).toBe('KNOWS');
  });
});
