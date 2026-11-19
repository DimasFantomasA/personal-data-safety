import {
  UpstreamError,
  UpstreamRateLimitError,
  UpstreamTimeoutError
} from '../utils/errors.mjs';

const DEFAULT_API_BASE_URL = 'https://api.xposedornot.com';
const DEFAULT_MCP_URL = 'https://api.xposedornot.com/mcp';
const DEFAULT_TIMEOUT_MS = 10_000;

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function flattenBreachNames(value) {
  return toArray(value)
    .flat(Infinity)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return String(item.breach ?? item.name ?? item.site ?? item.title ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function extractDataTypes(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function mapBreachDetails(details) {
  return toArray(details).filter((item) => item && typeof item === 'object').map((item) => ({
    service: String(item.breach ?? item.name ?? item.site ?? item.title ?? 'Неизвестный сервис'),
    year: item.xposed_date ?? item.breached_date ?? item.breach_date ?? item.date ?? null,
    dataTypes: extractDataTypes(item.xposed_data ?? item.exposed_data ?? item.data_types),
    domain: item.domain ?? null
  }));
}

function getQuickBreachNames(payload) {
  return flattenBreachNames(
    payload?.breaches ?? payload?.BreachList ?? payload?.breach_names ?? []
  );
}

function getAnalyticsDetails(payload) {
  return (
    payload?.ExposedBreaches?.breaches_details ??
    payload?.exposedBreaches?.breaches_details ??
    payload?.exposed_breaches?.breaches_details ??
    payload?.ExposedBreaches?.breachesDetails ??
    payload?.breaches_details ??
    []
  );
}

function isNotFoundPayload(payload) {
  const errorText = String(payload?.Error ?? payload?.error ?? '').toLowerCase();
  return errorText.includes('not found') || payload?.status === 'not_found';
}

function parseRetryAfter(response, payload) {
  const headerValue = response.headers.get('retry-after');
  const bodyValue = payload?.retry_after ?? payload?.retryAfter;
  const seconds = Number(headerValue ?? bodyValue);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

async function parseResponseBody(response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new UpstreamError('XposedOrNot вернул ответ в неизвестном формате.');
  }
}

function normalizeKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findValueByAliases(value, aliases) {
  if (!value || typeof value !== 'object') return undefined;
  const wanted = new Set(aliases.map(normalizeKey));

  for (const [key, child] of Object.entries(value)) {
    if (wanted.has(normalizeKey(key))) return child;
  }

  for (const child of Object.values(value)) {
    const found = findValueByAliases(child, aliases);
    if (found !== undefined) return found;
  }

  return undefined;
}

function asCount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.trunc(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number.parseInt(value, 10);
  if (Array.isArray(value)) return value.length;
  return undefined;
}

function parseTextCount(text, expression) {
  const match = text.match(expression);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function unwrapMcpResult(payload) {
  if (payload?.error) {
    const retryAfter = payload.error.data?.retry_after;
    if (payload.error.code === -32000 && retryAfter) {
      throw new UpstreamRateLimitError(retryAfter, payload.error.message);
    }
    throw new UpstreamError(payload.error.message || 'Ошибка MCP XposedOrNot.');
  }

  const result = payload?.result ?? payload;
  if (result?.isError) {
    const message = toArray(result.content)
      .map((item) => item?.text)
      .filter(Boolean)
      .join('\n');
    if (/rate limit/i.test(message)) throw new UpstreamRateLimitError(null, message);
    throw new UpstreamError(message || 'Ошибка при получении сводки домена.');
  }

  if (result?.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }

  const textParts = toArray(result?.content)
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text);

  if (textParts.length) {
    const combined = textParts.join('\n');
    try {
      return JSON.parse(combined);
    } catch {
      return { text: combined };
    }
  }

  return result;
}

export function normalizeDomainSummary(payload, domain) {
  const breachValue = findValueByAliases(payload, [
    'breach_count', 'breachCount', 'total_breaches', 'totalBreaches', 'breaches_count', 'breaches'
  ]);
  let breachCount = asCount(breachValue);

  const text = typeof payload?.text === 'string' ? payload.text : '';
  if (breachCount === undefined && text) {
    breachCount = parseTextCount(text, /(\d+)\s+(?:known\s+)?breaches?/i);
  }

  if (breachCount === undefined) {
    throw new UpstreamError('Не удалось распознать количество утечек в ответе XposedOrNot.');
  }

  const accountsValue = findValueByAliases(payload, [
    'affected_accounts', 'affectedAccounts', 'accounts_affected', 'exposed_accounts', 'total_accounts'
  ]);
  let affectedAccounts = asCount(accountsValue);
  if (affectedAccounts === undefined && text) {
    affectedAccounts = parseTextCount(text, /(\d+)\s+(?:affected\s+)?accounts?/i);
  }

  const pastesValue = findValueByAliases(payload, ['paste_count', 'pasteCount', 'total_pastes', 'pastes']);
  let pasteCount = asCount(pastesValue);
  if (pasteCount === undefined && text) {
    pasteCount = parseTextCount(text, /(\d+)\s+pastes?/i);
  }

  const latestBreachDate = findValueByAliases(payload, [
    'most_recent_breach_date', 'mostRecentBreachDate', 'latest_breach_date', 'latestBreachDate', 'most_recent_breach'
  ]) ?? null;

  return {
    domain,
    breachCount,
    ...(affectedAccounts !== undefined ? { affectedAccounts } : {}),
    ...(pasteCount !== undefined ? { pasteCount } : {}),
    ...(latestBreachDate ? { latestBreachDate } : {})
  };
}

export class XposedOrNotClient {
  constructor({
    apiBaseUrl = process.env.XON_API_BASE_URL || DEFAULT_API_BASE_URL,
    mcpUrl = process.env.XON_MCP_URL || DEFAULT_MCP_URL,
    timeoutMs = Number.parseInt(process.env.XON_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10),
    fetchImpl = globalThis.fetch
  } = {}) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.mcpUrl = mcpUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  
  async requestJson(url, { method = 'GET', headers = {} } = {}) {
    let response;

    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PersonalDataSafety/1.0',
          ...headers
        },
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new UpstreamTimeoutError(undefined, { cause: error });
      }

      throw new UpstreamError(
        'Не удалось связаться с XposedOrNot.',
        { cause: error }
      );
    }

    // Сначала проверяем HTTP-статус, затем разбираем JSON.
    const contentType = response.headers.get('content-type') || '';
    const isCloudflareChallenge =
      response.headers.get('cf-mitigated') === 'challenge';

    if (isCloudflareChallenge) {
      throw new UpstreamError(
        'XposedOrNot заблокировал серверный запрос проверкой Cloudflare (403).'
      );
    }

    let payload = {};

    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        throw new UpstreamError(
          'XposedOrNot вернул некорректный JSON.'
        );
      }
    }

    if (response.status === 429) {
      throw new UpstreamRateLimitError(
        parseRetryAfter(response, payload)
      );
    }

    if (!response.ok) {
      if (response.status === 404 && isNotFoundPayload(payload)) {
        return payload;
      }

      throw new UpstreamError(
        `XposedOrNot вернул HTTP ${response.status}.`
      );
    }

    if (!contentType.includes('application/json')) {
      throw new UpstreamError(
        'XposedOrNot вернул ответ не в формате JSON.'
      );
    }

    return payload;
  }


  async checkEmail(email) {
    const encodedEmail = encodeURIComponent(email);
    const quickResult = await this.requestJson(
      `${this.apiBaseUrl}/v1/check-email/${encodedEmail}`
    );

    if (isNotFoundPayload(quickResult)) {
      return { found: false, breachCount: 0, breaches: [], message: 'В базе XposedOrNot совпадений не найдено.' };
    }

    const quickNames = getQuickBreachNames(quickResult);
    if (quickNames.length === 0) {
      return { found: false, breachCount: 0, breaches: [], message: 'В базе XposedOrNot совпадений не найдено.' };
    }

    const analytics = await this.requestJson(
      `${this.apiBaseUrl}/v1/breach-analytics?email=${encodedEmail}`
    );
    const detailedBreaches = mapBreachDetails(getAnalyticsDetails(analytics));

    const normalizedByName = new Map(detailedBreaches.map((item) => [item.service.toLowerCase(), item]));
    const breaches = quickNames.map((name) => normalizedByName.get(name.toLowerCase()) ?? {
      service: name,
      year: null,
      dataTypes: [],
      domain: null
    });

    // Some API responses may return more details than the quick-check name list.
    for (const item of detailedBreaches) {
      if (!breaches.some((existing) => existing.service.toLowerCase() === item.service.toLowerCase())) {
        breaches.push(item);
      }
    }

    return {
      found: breaches.length > 0,
      breachCount: breaches.length,
      breaches,
      message: breaches.length > 0 ? null : 'В базе XposedOrNot совпадений не найдено.'
    };
  }

  async callMcpTool(name, arguments_) {
    let response;
    try {
      response = await this.fetchImpl(this.mcpUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: arguments_ }
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new UpstreamTimeoutError(undefined, { cause: error });
      }
      throw new UpstreamError('Не удалось связаться с MCP XposedOrNot.', { cause: error });
    }

    const payload = await parseResponseBody(response);
    if (response.status === 429) {
      throw new UpstreamRateLimitError(parseRetryAfter(response, payload));
    }
    if (!response.ok) {
      throw new UpstreamError(`MCP XposedOrNot вернул HTTP ${response.status}.`);
    }

    const unwrapped = unwrapMcpResult(payload);
    return normalizeDomainSummary(unwrapped, arguments_.domain);
  }

  async fetchDomainSummary(domain) {
    return this.callMcpTool('domain_breach_summary', { domain });
  }
}
