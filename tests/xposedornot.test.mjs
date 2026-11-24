import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  XposedOrNotClient,
  normalizeDomainSummary,
} from '../src/services/xposedornot.mjs';
import { UpstreamRateLimitError } from '../src/utils/errors.mjs';

const fetchMock = vi.fn();

function response({
  ok = true,
  status = 200,
  body = {},
  headers = { 'content-type': 'application/json' },
} = {}) {
  return {
    ok,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    async text() { return JSON.stringify(body); },
    async json() { return body; },
  };
}

describe('XposedOrNotClient', () => {
  let client;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    client = new XposedOrNotClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('checkEmail', () => {
    it('вызывает fetch и возвращает результат при 200', async () => {
      fetchMock.mockResolvedValueOnce(
        response({ body: { breaches: [], details: [] } })
      );
      const result = await client.checkEmail('user@example.com');
      expect(result).toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0];
      expect(decodeURIComponent(String(url))).toContain('user@example.com');
    });

    it('бросает UpstreamRateLimitError при 429', async () => {
      fetchMock.mockResolvedValueOnce(
        response({ ok: false, status: 429, headers: { 'retry-after': '60' } })
      );
      await expect(client.checkEmail('user@example.com'))
        .rejects.toBeInstanceOf(UpstreamRateLimitError);
    });

    it('UpstreamRateLimitError сохраняет retryAfterSeconds', async () => {
      fetchMock.mockResolvedValueOnce(
        response({ ok: false, status: 429, headers: { 'retry-after': '120' } })
      );
      try {
        await client.checkEmail('user@example.com');
        throw new Error('ожидалась ошибка');
      } catch (err) {
        expect(err).toBeInstanceOf(UpstreamRateLimitError);
        expect(err.retryAfterSeconds).toBe(120);
      }
    });
  });

  describe('fetchDomainSummary', () => {
    it('вызывает fetch и возвращает результат при 200', async () => {
      fetchMock.mockResolvedValueOnce(
        response({ body: { breaches: [], details: [] } })
      );
      const result = await client.fetchDomainSummary('example.com');
      expect(result).toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('бросает UpstreamRateLimitError при 429', async () => {
      fetchMock.mockResolvedValueOnce(
        response({ ok: false, status: 429, headers: { 'retry-after': '30' } })
      );
      await expect(client.fetchDomainSummary('example.com'))
        .rejects.toBeInstanceOf(UpstreamRateLimitError);
    });
  });
});

describe('normalizeDomainSummary', () => {
  it('экспортирована как функция', () => {
    expect(typeof normalizeDomainSummary).toBe('function');
  });
});