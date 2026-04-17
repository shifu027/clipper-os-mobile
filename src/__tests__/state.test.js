import { describe, it, expect } from 'vitest';
import { generateId, migrateState, mergeStates, DEFAULT_STATE } from '../state.js';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});

describe('migrateState', () => {
  it('returns default state for null input', () => {
    const s = migrateState(null);
    expect(Array.isArray(s.library)).toBe(true);
    expect(Array.isArray(s.clips)).toBe(true);
    expect(Array.isArray(s.routine)).toBe(true);
  });
  it('fills missing arrays from partial state', () => {
    const s = migrateState({ config: { channel: 'test' } });
    expect(Array.isArray(s.videoAssets)).toBe(true);
    expect(s.config.channel).toBe('test');
  });
  it('preserves existing valid data', () => {
    const s = migrateState({ ...DEFAULT_STATE, library: [{ id: '1', title: 'T', type: 'Vídeo Curto', tags: [], link: '', team: '', notes: '', platform: '', createdAt: Date.now() }] });
    expect(s.library[0].title).toBe('T');
  });
});

describe('mergeStates', () => {
  it('cloud wins for scalar fields', () => {
    const local = { ...DEFAULT_STATE, currentView: 'dashboard' };
    const cloud = { ...DEFAULT_STATE, currentView: 'pipeline' };
    const merged = mergeStates(local, cloud);
    expect(merged.currentView).toBe('pipeline');
  });
  it('preserves local-only array items', () => {
    const localItem = { id: 'local-1', title: 'Local' };
    const cloudItem = { id: 'cloud-1', title: 'Cloud' };
    const local = { ...DEFAULT_STATE, library: [localItem] };
    const cloud = { ...DEFAULT_STATE, library: [cloudItem] };
    const merged = mergeStates(local, cloud);
    expect(merged.library).toHaveLength(2);
    expect(merged.library.map(i => i.id)).toContain('local-1');
    expect(merged.library.map(i => i.id)).toContain('cloud-1');
  });
  it('cloud item wins when same id exists in both', () => {
    const localItem = { id: 'shared', title: 'Local Version' };
    const cloudItem = { id: 'shared', title: 'Cloud Version' };
    const local = { ...DEFAULT_STATE, library: [localItem] };
    const cloud = { ...DEFAULT_STATE, library: [cloudItem] };
    const merged = mergeStates(local, cloud);
    const found = merged.library.find(i => i.id === 'shared');
    expect(found.title).toBe('Cloud Version');
  });
  it('merges config shallowly preferring cloud', () => {
    const local = { ...DEFAULT_STATE, config: { ...DEFAULT_STATE.config, channel: 'local', frequency: '2' } };
    const cloud = { ...DEFAULT_STATE, config: { ...DEFAULT_STATE.config, channel: 'cloud', frequency: '3' } };
    const merged = mergeStates(local, cloud);
    expect(merged.config.channel).toBe('cloud');
    expect(merged.config.frequency).toBe('3');
  });
});
