export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class UpstreamError extends Error {
  constructor(message = 'Внешний сервис временно недоступен', options = {}) {
    super(message, options);
    this.name = 'UpstreamError';
    this.statusCode = 502;
  }
}

export class UpstreamTimeoutError extends UpstreamError {
  constructor(message = 'Внешний сервис не ответил вовремя', options = {}) {
    super(message, options);
    this.name = 'UpstreamTimeoutError';
    this.statusCode = 504;
  }
}

export class UpstreamRateLimitError extends UpstreamError {
  constructor(retryAfterSeconds = null, message = 'Превышен лимит запросов XposedOrNot') {
    super(message);
    this.name = 'UpstreamRateLimitError';
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds !== null && retryAfterSeconds !== undefined &&
      Number.isFinite(Number(retryAfterSeconds))
      ? Math.max(1, Number(retryAfterSeconds))
      : null;
  }
}
