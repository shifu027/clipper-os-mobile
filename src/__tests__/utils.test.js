import { describe, it, expect } from 'vitest';
import { escapeHtml, todayStr, csvEscape } from '../utils.js';

describe('escapeHtml', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
  it('escapes &', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('does not modify safe strings', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('todayStr', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('matches current date', () => {
    const d = new Date();
    const expected = d.toISOString().split('T')[0];
    expect(todayStr()).toBe(expected);
  });
});

describe('csvEscape', () => {
  it('wraps strings with commas in quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('escapes internal quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('returns plain string when no special chars', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
});
