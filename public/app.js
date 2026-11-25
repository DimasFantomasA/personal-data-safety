const API = {
  email: '/api/email/check',
  domain: '/api/domain/summary'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const ICONS = {
  shieldOk: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`,
  alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`,
  lockMini: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
};

const DATA_TYPE_LABELS = {
  'passwords': 'Пароли',
  'password hints': 'Подсказки к паролям',
  'email addresses': 'Email-адреса',
  'recovery email addresses': 'Резервные email-адреса',
  'usernames': 'Имена пользователей',
  'nicknames': 'Никнеймы',
  'names': 'Имена',
  'full names': 'ФИО',
  'salutations': 'Обращения',
  'dates of birth': 'Даты рождения',
  'dob': 'Даты рождения',
  'ip addresses': 'IP-адреса',
  'mac addresses': 'MAC-адреса',
  'imei numbers': 'IMEI-номера',
  'phone numbers': 'Номера телефонов',
  'physical addresses': 'Физические адреса',
  'geographic locations': 'Геолокация',
  'locations': 'Местоположение',
  'time zones': 'Часовые пояса',
  'genders': 'Пол',
  'credit cards': 'Банковские карты',
  'credit card cvv': 'CVV-коды карт',
  'partial credit card data': 'Частичные данные карт',
  'bank account numbers': 'Банковские счета',
  'payment histories': 'История платежей',
  'purchases': 'История покупок',
  'account balances': 'Баланс счетов',
  'social security numbers': 'Номера соцстрахования (SSN)',
  'passport numbers': 'Паспортные данные',
  'government issued ids': 'Государственные ID',
  "driver's licenses": 'Водительские удостоверения',
  'security questions and answers': 'Секретные вопросы и ответы',
  'auth tokens': 'Токены авторизации',
  'session tokens': 'Сессионные токены',
  'api keys': 'API-ключи',
  'private messages': 'Личные сообщения',
  'chat logs': 'Переписки и чаты',
  'avatars': 'Аватары',
  'bios': 'Описания профиля',
  'profile photos': 'Фото профиля',
  'social media profiles': 'Профили соцсетей',
  'social connections': 'Список контактов',
  'employers': 'Место работы',
  'job titles': 'Должности',
  'occupations': 'Род занятий',
  'education levels': 'Образование',
  'marital statuses': 'Семейное положение',
  'nationalities': 'Гражданство',
  'ethnicities': 'Национальность',
  'spoken languages': 'Языки',
  'device information': 'Данные об устройствах',
  'browser user agent details': 'Данные браузера',
  'website activity': 'Активность на сайте',
  'browsing histories': 'История браузера',
  'search histories': 'История поиска'
};

const CRITICAL_KEYWORDS = [
  'password', 'password hint', 'credit card', 'bank', 'financial',
  'auth token', 'session token', 'api key', 'security question',
  'ssn', 'passport', 'government issued', 'private key',
  'парол', 'карт', 'токен', 'секретн', 'паспорт', 'счет'
];

const SENSITIVE_KEYWORDS = [
  'phone', 'physical address', 'address', 'date of birth', 'dob', 'birth',
  'ip address', 'mac address', 'imei', 'geolocation', 'location',
  'gender', 'employer', 'private message', 'chat', 'purchase', 'payment',
  'телефон', 'адрес', 'рождени', 'ip', 'гео', 'сообщени', 'покуп'
];

const TIER_WEIGHT = { critical: 3, sensitive: 2, basic: 1 };

function $(sel) { return document.querySelector(sel); }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function yearFrom(value) {
  if (!value) return null;
  const m = String(value).match(/\d{4}/);
  return m ? m[0] : null;
}

function normalizeDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

function cleanDataTypes(rawTypes) {
  if (!Array.isArray(rawTypes)) return [];
  return rawTypes
    .map((t) => String(t ?? '').trim())
    .filter(Boolean);
}

function translateDataType(rawLabel) {
  const clean = String(rawLabel ?? '').trim();
  if (!clean) return '';
  return DATA_TYPE_LABELS[clean.toLowerCase()] || clean;
}

function classifyDataType(label) {
  const norm = String(label).toLowerCase();
  if (CRITICAL_KEYWORDS.some((kw) => norm.includes(kw))) return 'critical';
  if (SENSITIVE_KEYWORDS.some((kw) => norm.includes(kw))) return 'sensitive';
  return 'basic';
}

function getBreachTier(dataTypes) {
  if (!Array.isArray(dataTypes) || dataTypes.length === 0) return 'basic';
  let maxTier = 'basic';
  for (const t of dataTypes) {
    const tier = classifyDataType(t);
    if (TIER_WEIGHT[tier] > TIER_WEIGHT[maxTier]) {
      maxTier = tier;
    }
  }
  return maxTier;
}

function renderChip(rawLabel) {
  const tier = classifyDataType(rawLabel);
  const safeLabel = escapeHtml(translateDataType(rawLabel));

  if (tier === 'critical') {
    return `<li class="chip chip--critical" title="Критичные данные">${ICONS.lockMini}<span>${safeLabel}</span></li>`;
  }
  if (tier === 'sensitive') {
    return `<li class="chip chip--sensitive" title="Чувствительные данные"><span>${safeLabel}</span></li>`;
  }
  return `<li class="chip chip--basic" title="Базовые данные"><span>${safeLabel}</span></li>`;
}

function cachedBadge(isCached) {
  return isCached ? '<span class="badge-cached">из кэша</span>' : '';
}

function setFieldError(input, errorEl, message) {
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
}

function renderSkeleton(container, mode = 'list') {
  if (mode === 'grid') {
    container.innerHTML = `
      <div class="skeleton-grid" aria-label="Загрузка данных">
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="skeleton-stack" aria-label="Загрузка данных">
      <div class="skeleton-box" style="height: 52px"></div>
      <div class="skeleton-box"></div>
      <div class="skeleton-box"></div>
    </div>`;
}

function renderError(container, message, retryAfter) {
  const hint = retryAfter ? ` Попробуйте через ${retryAfter} сек.` : '';
  container.innerHTML = `
    <div class="state error">
      ${ICONS.error}
      <span>${escapeHtml(message)}${hint}</span>
    </div>`;
}

function renderEmpty(container, message) {
  container.innerHTML = `
    <div class="state empty">
      ${ICONS.shieldOk}
      <span>${escapeHtml(message)}</span>
    </div>`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function renderEmailResult(container, data, queriedEmail) {
  if (!data.found || !Array.isArray(data.breaches) || data.breaches.length === 0) {
    renderEmpty(container, data.message || 'В базе XposedOrNot утечек для этого адреса не найдено.');
    return;
  }

  const enrichedBreaches = data.breaches.map((b) => {
    const cleaned = cleanDataTypes(b.dataTypes);
    const sortedTypes = [...cleaned].sort(
      (a, z) => TIER_WEIGHT[classifyDataType(z)] - TIER_WEIGHT[classifyDataType(a)]
    );
    return {
      ...b,
      sortedTypes,
      tier: getBreachTier(sortedTypes),
      numericYear: Number(yearFrom(b.year)) || 0
    };
  });

  const hasCritical = enrichedBreaches.some((b) => b.tier === 'critical');
  const hasSensitive = enrichedBreaches.some((b) => b.tier === 'sensitive');

  let riskLevel = 'low';
  let riskLabel = 'Базовый уровень риска';
  if (hasCritical || data.breachCount >= 5) {
    riskLevel = 'high';
    riskLabel = 'Высокий уровень риска';
  } else if (hasSensitive || data.breachCount >= 2) {
    riskLevel = 'medium';
    riskLabel = 'Средний уровень риска';
  }

  let sortDesc = true;
  let onlyCritical = false;

  const toolbarHtml = enrichedBreaches.length > 3
    ? `
      <div class="breach-toolbar">
        <label class="filter-toggle">
          <input type="checkbox" id="filter-critical" />
          <span>Только с критичными данными</span>
        </label>
        <button type="button" class="sort-btn" id="sort-breaches">Сначала новые ↓</button>
      </div>`
    : '';

  container.innerHTML = `
    <div class="state alert">
      ${ICONS.alert}
      <span>Обнаружено утечек: <strong>${data.breachCount}</strong></span>
      <div class="state-actions">
        ${cachedBadge(data.cached)}
        <button type="button" class="copy-btn" id="copy-report-btn">
          ${ICONS.copy}
          <span>Копировать отчёт</span>
        </button>
      </div>
    </div>

    <div class="risk-bar" data-risk="${riskLevel}">
      <div class="risk-meter">
        <div class="risk-segments" aria-hidden="true"><span></span><span></span><span></span></div>
        <span>${riskLabel}</span>
      </div>
      <div class="tier-legend" aria-label="Обозначение уровней данных">
        <span class="legend-item"><span class="legend-dot legend-dot--critical"></span>Критично</span>
        <span class="legend-item"><span class="legend-dot legend-dot--sensitive"></span>Чувствительно</span>
        <span class="legend-item"><span class="legend-dot legend-dot--basic"></span>Базово</span>
      </div>
    </div>

    ${toolbarHtml}
    <ul class="breach-list" id="breach-list"></ul>
  `;

  const listEl = container.querySelector('#breach-list');

  function renderList() {
    const filtered = onlyCritical
      ? enrichedBreaches.filter((b) => b.tier === 'critical')
      : enrichedBreaches;

    const sorted = [...filtered].sort((a, b) =>
      sortDesc ? b.numericYear - a.numericYear : a.numericYear - b.numericYear
    );

    if (sorted.length === 0) {
      listEl.innerHTML = `<li class="breach"><p class="notice">Утечек с критичными данными (пароли, карты) не обнаружено.</p></li>`;
      return;
    }

    listEl.innerHTML = sorted.map((b, index) => {
      const year = yearFrom(b.year);
      const meta = year ? `${year} год` : 'Год неизвестен';
      const chips = b.sortedTypes.length
        ? `<ul class="chips">${b.sortedTypes.map(renderChip).join('')}</ul>`
        : '';

      return `
        <li class="breach" data-tier="${b.tier}" style="animation-delay: ${Math.min(index * 40, 240)}ms">
          <div class="breach-header">
            <h3>${escapeHtml(b.service || 'Неизвестный сервис')}</h3>
            <span class="breach-year">${meta}</span>
          </div>
          ${chips}
        </li>`;
    }).join('');
  }

  renderList();

  const filterCheckbox = container.querySelector('#filter-critical');
  if (filterCheckbox) {
    filterCheckbox.addEventListener('change', () => {
      onlyCritical = filterCheckbox.checked;
      renderList();
    });
  }

  const sortBtn = container.querySelector('#sort-breaches');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      sortDesc = !sortDesc;
      sortBtn.textContent = sortDesc ? 'Сначала новые ↓' : 'Сначала старые ↑';
      renderList();
    });
  }

  const copyBtn = container.querySelector('#copy-report-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const lines = [
        `Отчёт проверки утечек: ${queriedEmail}`,
        `Найдено утечек: ${data.breachCount} (${riskLabel})`,
        '',
        ...enrichedBreaches.map((b) => {
          const year = yearFrom(b.year) || 'год неизвестен';
          const types = b.sortedTypes.length
            ? b.sortedTypes.map(translateDataType).join(', ')
            : 'состав данных не указан';
          return `• ${b.service || 'Неизвестный сервис'} (${year}): ${types}`;
        })
      ];

      await copyText(lines.join('\n'));
      copyBtn.innerHTML = `${ICONS.check}<span>Скопировано</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = `${ICONS.copy}<span>Копировать отчёт</span>`;
      }, 2000);
    });
  }
}

function renderDomainResult(container, data) {
  if (!data || typeof data.breachCount !== 'number') {
    renderError(container, 'Не удалось получить сводку по домену.');
    return;
  }

  if (data.breachCount === 0) {
    renderEmpty(container, `Для домена ${data.domain} утечек не найдено.`);
    return;
  }

  const cards = [
    `<div class="summary-item" style="animation-delay: 0ms">
      <div class="label">Инцидентов</div>
      <div class="value">${data.breachCount}</div>
    </div>`
  ];

  if (typeof data.affectedAccounts === 'number') {
    cards.push(`
      <div class="summary-item" style="animation-delay: 50ms">
        <div class="label">Аккаунтов</div>
        <div class="value">${data.affectedAccounts.toLocaleString('ru-RU')}</div>
      </div>`);
  }

  if (typeof data.pasteCount === 'number') {
    cards.push(`
      <div class="summary-item" style="animation-delay: 100ms">
        <div class="label">Паст</div>
        <div class="value">${data.pasteCount.toLocaleString('ru-RU')}</div>
      </div>`);
  }

  const latest = yearFrom(data.latestBreachDate);
  if (latest) {
    cards.push(`
      <div class="summary-item" style="animation-delay: 150ms">
        <div class="label">Последняя утечка</div>
        <div class="value">${latest}</div>
      </div>`);
  }

  container.innerHTML = `
    <div class="summary-header">
      <span>Домен: <span class="summary-domain">${escapeHtml(data.domain)}</span></span>
      ${cachedBadge(data.cached)}
    </div>
    <div class="summary-grid">${cards.join('')}</div>
  `;
}

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    const err = new Error('Не удалось связаться с сервером. Проверьте подключение.');
    err.code = 'NETWORK';
    throw err;
  }

  let payload = null;
  try { payload = await response.json(); } catch { /* ignore */ }

  if (!response.ok) {
    const err = new Error(payload?.error?.message || `Ошибка сервера (HTTP ${response.status}).`);
    err.code = payload?.error?.code || `HTTP_${response.status}`;
    err.retryAfter = payload?.error?.retryAfterSeconds || Number(response.headers.get('Retry-After')) || null;
    throw err;
  }
  return payload;
}

const emailForm = $('#email-form');
const emailInput = $('#email-input');
const emailError = $('#email-error');
const emailResult = $('#email-result');
const emailBtn = emailForm.querySelector('button[type="submit"]');

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = emailInput.value.trim();

  if (!value) return setFieldError(emailInput, emailError, 'Введите email-адрес.');
  if (!EMAIL_RE.test(value)) return setFieldError(emailInput, emailError, 'Проверьте корректность email-адреса.');
  setFieldError(emailInput, emailError, null);

  emailBtn.disabled = true;
  renderSkeleton(emailResult, 'list');

  try {
    const data = await postJson(API.email, { email: value });
    renderEmailResult(emailResult, data, value);
  } catch (err) {
    renderError(emailResult, err.message, err.code === 'UPSTREAM_RATE_LIMIT' ? err.retryAfter : null);
  } finally {
    emailBtn.disabled = false;
  }
});

const domainForm = $('#domain-form');
const domainInput = $('#domain-input');
const domainError = $('#domain-error');
const domainResult = $('#domain-result');
const domainBtn = domainForm.querySelector('button[type="submit"]');

domainForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const normalized = normalizeDomain(domainInput.value);
  domainInput.value = normalized;
  updateClearButton(domainInput);

  if (!normalized) return setFieldError(domainInput, domainError, 'Введите домен, например example.com.');
  if (!DOMAIN_RE.test(normalized)) {
    return setFieldError(domainInput, domainError, 'Укажите корректный домен вида example.com.');
  }
  setFieldError(domainInput, domainError, null);

  domainBtn.disabled = true;
  renderSkeleton(domainResult, 'grid');

  try {
    const data = await postJson(API.domain, { domain: normalized });
    renderDomainResult(domainResult, data);
  } catch (err) {
    renderError(domainResult, err.message, err.code === 'UPSTREAM_RATE_LIMIT' ? err.retryAfter : null);
  } finally {
    domainBtn.disabled = false;
  }
});

document.querySelectorAll('[data-preset-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.presetTarget;
    const value = btn.dataset.presetValue;

    if (target === 'email') {
      emailInput.value = value;
      updateClearButton(emailInput);
      emailForm.dispatchEvent(new Event('submit', { cancelable: true }));
    } else if (target === 'domain') {
      domainInput.value = value;
      updateClearButton(domainInput);
      domainForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
});

function updateClearButton(input) {
  const btn = document.querySelector(`[data-clear="${input.id}"]`);
  if (btn) btn.hidden = input.value.length === 0;
}

document.querySelectorAll('.input-wrap input').forEach((input) => {
  input.addEventListener('input', () => updateClearButton(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      updateClearButton(input);
    }
  });
});

document.querySelectorAll('[data-clear]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.clear);
    if (!input) return;
    input.value = '';
    btn.hidden = true;
    input.focus();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    emailInput.focus();
  }
});

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
});

const themeToggle = $('#theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const applyTheme = () => {
      const isDark = document.documentElement.classList.toggle('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    };

    if (document.startViewTransition) {
      document.startViewTransition(applyTheme);
    } else {
      applyTheme();
    }
  });
}