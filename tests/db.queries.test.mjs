import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.EMAIL_CACHE_SECRET = 'test-secret-for-vitest';
});

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('pg', () => {
  function Pool() {
    return { query: queryMock };
  }
  return { default: { Pool }, Pool };
});

import * as queries from '../db/queries.mjs';

describe('db/queries.mjs', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('экспортирует pool и функции', () => {
    expect(queries.pool).toBeDefined();
    expect(typeof queries.getEmailCheckCache).toBe('function');
    expect(typeof queries.saveEmailCheckCache).toBe('function');
    expect(typeof queries.getDomainSummary).toBe('function');
    expect(typeof queries.saveDomainSummary).toBe('function');
    expect(typeof queries.incrementCheckCount).toBe('function');
  });

  it('getEmailCheckCache: пустой результат → null', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await queries.getEmailCheckCache('user@example.com');
    expect(result).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('getEmailCheckCache: попадание возвращает сохранённый result', async () => {
    const cached = { breaches: ['Adobe'], details: [{ service: 'Adobe' }] };
    queryMock.mockResolvedValueOnce({ rows: [{ result: cached }] });

    const result = await queries.getEmailCheckCache('user@example.com');

    expect(result).toEqual(cached);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('getEmailCheckCache: email в SQL не передаётся открытым текстом', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const email = 'user@example.com';
    await queries.getEmailCheckCache(email);
    const args = queryMock.mock.calls[0];
    const flat = JSON.stringify(args);
    expect(flat).not.toContain(email);
  });

  it('saveEmailCheckCache вызывает query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await queries.saveEmailCheckCache('user@example.com', { breaches: [] });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('getDomainSummary: пустой результат → null', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await queries.getDomainSummary('example.com');
    expect(result).toBeNull();
  });

  it('saveDomainSummary вызывает query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await queries.saveDomainSummary('example.com', 3);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('incrementCheckCount вызывает query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    await queries.incrementCheckCount('email', 'hit');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});