import { describe, expect, it } from 'vitest';
import type {
  DiagramTarget,
  Methodology,
  Project,
  Threat,
  ThreatDraft,
} from './contracts';

// These tests exist mainly so `tsc` checks the contracts against realistic usage.
// If a contract changes in a way that breaks plug-in authors, this file stops compiling.

const now = '2026-11-18T00:00:00.000Z';

const sampleProject: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 'Sample',
  owner: 'alice',
  description: 'Sample project',
  reviewers: ['bob'],
  methodologyIds: ['stub'],
  elements: [
    { id: 'e1', type: 'process', name: 'API', position: { x: 0, y: 0 }, properties: {} },
  ],
  dataFlows: [],
  trustBoundaries: [],
  threats: [],
  createdAt: now,
  updatedAt: now,
};

const stubMethodology: Methodology = {
  id: 'stub',
  name: 'Stub',
  version: '0.0.0',
  kind: 'methodology',
  permissions: [{ type: 'model', access: 'read' }],
  categories: ['Spoofing'],
  rules: [
    { id: 'r1', name: 'Process spoofing', description: '', category: 'Spoofing', appliesTo: ['element'] },
  ],
  evaluate(target: DiagramTarget): ThreatDraft[] {
    if (target.kind !== 'element' || target.item.type !== 'process') return [];
    return [
      {
        title: `Spoofing of ${target.item.name}`,
        description: 'An attacker may impersonate this process.',
        category: 'Spoofing',
        priority: 'high',
        ruleId: 'r1',
      },
    ];
  },
};

describe('contracts', () => {
  it('lets a methodology plug-in produce drafts from a project', () => {
    const el = sampleProject.elements[0]!;
    const drafts = stubMethodology.evaluate({ kind: 'element', item: el }, { project: sampleProject });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.ruleId).toBe('r1');
  });

  it('models user-modified generated threats (FR 2.3)', () => {
    const t: Threat = {
      id: 't1',
      title: 'Spoofing of API',
      description: '',
      category: 'Spoofing',
      methodologyId: 'stub',
      target: { kind: 'element', id: 'e1' },
      origin: 'generated',
      modified: true,
      ruleId: 'r1',
      priority: 'high',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    const survivesRefresh = t.origin === 'user' || t.modified;
    expect(survivesRefresh).toBe(true);
  });
});
