import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.mjs';

function createMocks() {
  const db = {
    getEmailCheckCache: vi.fn().mockResolvedValue(null),
    saveEmailCheckCache: vi.fn().mockResolvedValue(undefined),
    incrementCheckCount: vi.fn().mockResolvedValue(undefined),
    getDomainSummary: vi.fn().mockResolvedValue(null),
    saveDomainSummary: vi.fn().mockResolvedValue(undefined),
  };
  const xposedOrNot = {
    checkEmail: vi.fn().mockResolvedValue({ breaches: [], details: [] }),
    fetchDomainSummary: vi.fn().mockResolvedValue({ breaches: [], details: [] }),
    callMcpTool: vi.fn().mockResolvedValue({}),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { db, xposedOrNot, logger };
}

describe('createApp', () => {
  it('возвращает express-приложение', () => {
    const { db, xposedOrNot, logger } = createMocks();
    const app = createApp({ db, xposedOrNot, logger });
    expect(typeof app).toBe('function');
    expect(typeof app.listen).toBe('function');
  });

  it('неизвестный маршрут → 404', async () => {
    const { db, xposedOrNot, logger } = createMocks();
    const app = createApp({ db, xposedOrNot, logger });
    await request(app).get('/api/unknown-route').expect(404);
  });
});

describe('POST /api/email/check', () => {
  let app;
  let mocks;

  beforeEach(() => {
    mocks = createMocks();
    app = createApp(mocks);
  });

  it('400 на некорректный email и не трогает upstream', async () => {
    await request(app)
      .post('/api/email/check')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(mocks.xposedOrNot.checkEmail).not.toHaveBeenCalled();
  });

  it('400 при отсутствии email в теле', async () => {
    await request(app)
      .post('/api/email/check')
      .send({})
      .expect(400);
    expect(mocks.xposedOrNot.checkEmail).not.toHaveBeenCalled();
  });

  it('200 на валидный email, вызывает checkEmail и пишет в кэш', async () => {
    await request(app)
      .post('/api/email/check')
      .send({ email: 'user@example.com' })
      .expect(200);
    expect(mocks.xposedOrNot.checkEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.db.saveEmailCheckCache).toHaveBeenCalled();
    expect(mocks.db.incrementCheckCount).toHaveBeenCalled();
  });

  it('нормализует email перед upstream (регистр домена, пробелы)', async () => {
    await request(app)
      .post('/api/email/check')
      .send({ email: '  User@Example.COM  ' })
      .expect(200);
    expect(mocks.xposedOrNot.checkEmail).toHaveBeenCalledWith('User@example.com');
  });

  it('при попадании в кэш не вызывает upstream', async () => {
    mocks.db.getEmailCheckCache.mockResolvedValueOnce({
      breaches: ['CachedBreach'],
      details: [],
    });
    await request(app)
      .post('/api/email/check')
      .send({ email: 'cached@example.com' })
      .expect(200);
    expect(mocks.xposedOrNot.checkEmail).not.toHaveBeenCalled();
  });

  it('429 от upstream пробрасывается клиенту', async () => {
    const { UpstreamRateLimitError } = await import('../src/utils/errors.mjs');
    mocks.xposedOrNot.checkEmail.mockRejectedValueOnce(
      new UpstreamRateLimitError(60)
    );
    await request(app)
      .post('/api/email/check')
      .send({ email: 'user@example.com' })
      .expect(429);
  });
});