import { fileURLToPath } from 'node:url';
import express from 'express';
import * as database from '../db/queries.mjs';
import { XposedOrNotClient } from './services/xposedornot.mjs';
import { normalizeDomain, normalizeEmail } from './utils/validation.mjs';
import {
  UpstreamError,
  UpstreamRateLimitError,
  UpstreamTimeoutError,
  ValidationError
} from './utils/errors.mjs';

function getAllowedOrigins() {
  const value = process.env.CORS_ORIGIN?.trim();
  if (!value || value === '*') return '*';
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function applyApiHeaders(request, response, next) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.get('origin');

  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });

  if (allowedOrigins === '*') {
    response.set('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.set('Access-Control-Allow-Origin', requestOrigin);
    response.vary('Origin');
  }

  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204);
  }

  return next();
}

async function recordCheck(db, logger, type, outcome) {
  try {
    await db.incrementCheckCount(type, outcome);
  } catch (error) {
    logger.error?.('Could not update anonymous daily counters', {
      operation: 'incrementCheckCount',
      message: error?.message ?? 'unknown database error'
    });
  }
}

function createErrorHandler(logger) {
  return (error, _request, response, _next) => {
    if (response.headersSent) return;

    if (error instanceof ValidationError) {
      return response.status(400).json({
        error: { code: 'INVALID_INPUT', message: error.message }
      });
    }

    if (error instanceof UpstreamRateLimitError) {
      if (error.retryAfterSeconds) {
        response.set('Retry-After', String(error.retryAfterSeconds));
      }
      return response.status(429).json({
        error: {
          code: 'UPSTREAM_RATE_LIMIT',
          message: error.message,
          ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {})
        }
      });
    }

    if (error instanceof UpstreamTimeoutError) {
      return response.status(504).json({
        error: { code: 'UPSTREAM_TIMEOUT', message: error.message }
      });
    }

    if (error instanceof UpstreamError) {
      return response.status(502).json({
        error: { code: 'UPSTREAM_UNAVAILABLE', message: error.message }
      });
    }

    const invalidJson = error?.type === 'entity.parse.failed';
    if (invalidJson) {
      return response.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Тело запроса должно содержать корректный JSON.' }
      });
    }

    logger.error?.('Unhandled API error', {
      message: error?.message ?? 'unknown error'
    });
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера.' }
    });
  };
}

export function createApp({
  xposedOrNot = new XposedOrNotClient(),
  db = database,
  logger = console
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(applyApiHeaders);
  app.use(express.json({ limit: '8kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  
  app.post('/api/email/check', async (request, response, next) => {
    let email;

    try {
      email = normalizeEmail(request.body?.email);
    } catch (error) {
      return next(error);
    }

    try {
      try {
        const cached = await db.getEmailCheckCache(email);

        if (cached) {
          await recordCheck(
            db,
            logger,
            'email',
            cached.found ? 'found' : 'not_found'
          );

          return response.json({
            ...cached,
            cached: true
          });
        }
      } catch (error) {
        logger.error?.('Email cache lookup failed; requesting fresh result', {
          operation: 'getEmailCheckCache',
          message: error?.message ?? 'unknown database error'
        });
      }

      const result = await xposedOrNot.checkEmail(email);

      try {
        await db.saveEmailCheckCache(email, result);
      } catch (error) {
        logger.error?.('Email cache write failed', {
          operation: 'saveEmailCheckCache',
          message: error?.message ?? 'unknown database error'
        });
      }

      await recordCheck(
        db,
        logger,
        'email',
        result.found ? 'found' : 'not_found'
      );

      return response.json({
        ...result,
        cached: false
      });

    } catch (error) {
      await recordCheck(db, logger, 'email', 'error');
      return next(error);
    }
  });


  app.post('/api/domain/summary', async (request, response, next) => {
    let domain;
    try {
      domain = normalizeDomain(request.body?.domain);
    } catch (error) {
      return next(error);
    }

    try {
      try {
        const cached = await db.getDomainSummary(domain);
        if (cached) {
          const breachCount = Number(cached.breachCount);
          await recordCheck(db, logger, 'domain', breachCount > 0 ? 'found' : 'not_found');
          return response.json({
            domain,
            breachCount,
            cached: true,
            expiresAt: cached.expiresAt
          });
        }
      } catch (error) {
        logger.error?.('Domain cache lookup failed; requesting fresh summary', {
          operation: 'getDomainSummary',
          message: error?.message ?? 'unknown database error'
        });
      }

      const summary = await xposedOrNot.fetchDomainSummary(domain);

      try {
        await db.saveDomainSummary(domain, summary.breachCount);
      } catch (error) {
        logger.error?.('Domain cache write failed', {
          operation: 'saveDomainSummary',
          message: error?.message ?? 'unknown database error'
        });
      }

      await recordCheck(db, logger, 'domain', summary.breachCount > 0 ? 'found' : 'not_found');
      return response.json({ ...summary, cached: false });
    } catch (error) {
      await recordCheck(db, logger, 'domain', 'error');
      return next(error);
    }
  });

  const frontendPath = fileURLToPath(new URL('../docs/', import.meta.url));
  
  app.use(express.static(frontendPath));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Маршрут API не найден.' }
    });
  });

  app.use(createErrorHandler(logger));
  return app;
}
