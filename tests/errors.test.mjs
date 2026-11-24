import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  UpstreamError,
  UpstreamTimeoutError,
  UpstreamRateLimitError,
} from '../src/utils/errors.mjs';

describe('ValidationError', () => {
  it('ошибка со статусом 400', () => {
    const err = new ValidationError('bad');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.name).toBe('ValidationError');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad');
  });
});

describe('UpstreamError', () => {
  it('ошибка со статусом 502', () => {
    const err = new UpstreamError();
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.statusCode).toBe(502);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('прокидывает cause в родительский Error', () => {
    const cause = new Error('root');
    const err = new UpstreamError('up', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('UpstreamTimeoutError', () => {
  it('наследуется от UpstreamError и имеет статус 504', () => {
    const err = new UpstreamTimeoutError();
    expect(err).toBeInstanceOf(UpstreamTimeoutError);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.statusCode).toBe(504);
  });
});

describe('UpstreamRateLimitError', () => {
  it('имеет статус 429', () => {
    const err = new UpstreamRateLimitError();
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.statusCode).toBe(429);
  });

  it('по умолчанию retryAfterSeconds = null', () => {
    expect(new UpstreamRateLimitError().retryAfterSeconds).toBeNull();
    expect(new UpstreamRateLimitError(undefined).retryAfterSeconds).toBeNull();
  });

  it('принимает число и строку с числом', () => {
    expect(new UpstreamRateLimitError(60).retryAfterSeconds).toBe(60);
    expect(new UpstreamRateLimitError('60').retryAfterSeconds).toBe(60);
  });

  it('не опускается ниже 1', () => {
    expect(new UpstreamRateLimitError(0).retryAfterSeconds).toBe(1);
    expect(new UpstreamRateLimitError(-5).retryAfterSeconds).toBe(1);
  });

  it('возвращает null для нечисловых значений', () => {
    expect(new UpstreamRateLimitError('abc').retryAfterSeconds).toBeNull();
    expect(new UpstreamRateLimitError(NaN).retryAfterSeconds).toBeNull();
    expect(new UpstreamRateLimitError(Infinity).retryAfterSeconds).toBeNull();
  });
});