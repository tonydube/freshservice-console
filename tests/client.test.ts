import { describe, expect, it } from 'vitest';
import { ApiError, parseNextLink, retryDelay, shouldRetry } from '../src/api/client';
import { buildLabelMaps, label } from '../src/lib/enums';
import { planFromTotal } from '../src/lib/rateLimit';

describe('parseNextLink', () => {
  it('extracts the next path', () => {
    expect(parseNextLink('</api/fs/agents?per_page=100&page=2>; rel="next"')).toBe('agents?per_page=100&page=2');
  });
  it('returns null when absent', () => {
    expect(parseNextLink(null)).toBeNull();
    expect(parseNextLink('</api/fs/agents?page=1>; rel="prev"')).toBeNull();
  });
});

describe('retry policy', () => {
  it('retries 429 using Retry-After, but not 401/404', () => {
    const e429 = new ApiError(429, 'x', 'x', 12);
    expect(shouldRetry(0, e429)).toBe(true);
    expect(retryDelay(0, e429)).toBe(12_000);
    expect(shouldRetry(0, new ApiError(401, 'x', 'x'))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, 'x', 'x'))).toBe(false);
  });
});

describe('enum labels', () => {
  it('falls back to built-in labels', () => {
    const m = buildLabelMaps(undefined);
    expect(label(m, 'status', 2)).toBe('Open');
    expect(label(m, 'priority', 4)).toBe('Urgent');
    expect(label(m, 'status', 99)).toBe('#99');
    expect(label(m, 'status', null)).toBe('—');
  });
  it('merges custom statuses from ticket_form_fields', () => {
    const m = buildLabelMaps([{ id: 1, name: 'status', choices: [{ id: 6, value: 'Waiting on Vendor' }] }]);
    expect(label(m, 'status', 6)).toBe('Waiting on Vendor');
    expect(label(m, 'status', 3)).toBe('Pending');
  });
});

it('maps rate-limit totals to plans', () => {
  expect(planFromTotal(400)).toBe('Pro');
  expect(planFromTotal(123)).toBeNull();
});
