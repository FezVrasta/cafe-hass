import { describe, expect, it } from 'vitest';
import { buildQuickAddConnection, getAvailableQuickAddTypes } from '@/lib/quick-add';

describe('quick-add helpers', () => {
  describe('getAvailableQuickAddTypes', () => {
    it('excludes Trigger when dragging forward (new node needs a target handle)', () => {
      const types = getAvailableQuickAddTypes('forward').map((c) => c.type);
      expect(types).not.toContain('trigger');
      expect(types).toContain('action');
      expect(types).toContain('condition');
    });

    it('offers every simple type (including Trigger) when dragging backward', () => {
      const types = getAvailableQuickAddTypes('backward').map((c) => c.type);
      expect(types).toContain('trigger');
      expect(types).toContain('action');
      expect(types.length).toBeGreaterThan(getAvailableQuickAddTypes('forward').length);
    });
  });

  describe('buildQuickAddConnection', () => {
    it('wires the dragged source handle to the new node (forward)', () => {
      const conn = buildQuickAddConnection('forward', 'src-node', 'true', 'new-node');
      expect(conn).toEqual({
        source: 'src-node',
        sourceHandle: 'true',
        target: 'new-node',
        targetHandle: null,
      });
    });

    it('wires the new node into the dragged target handle (backward)', () => {
      const conn = buildQuickAddConnection('backward', 'dst-node', null, 'new-node');
      expect(conn).toEqual({
        source: 'new-node',
        sourceHandle: null,
        target: 'dst-node',
        targetHandle: null,
      });
    });
  });
});
