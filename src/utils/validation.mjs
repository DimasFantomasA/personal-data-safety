import { domainToASCII } from 'node:url';
import { ValidationError } from './errors.mjs';

const LOCAL_PART_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('Укажи email в текстовом формате.');
  }

  const email = value.trim();
  if (!email || email.length > 254) {
    throw new ValidationError('Укажи корректный email-адрес.');
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) {
    throw new ValidationError('Укажи корректный email-адрес.');
  }

  const localPart = email.slice(0, atIndex);
  const rawDomain = email.slice(atIndex + 1);

  if (
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !LOCAL_PART_RE.test(localPart)
  ) {
    throw new ValidationError('Укажи корректный email-адрес.');
  }

  const domain = normalizeDomain(rawDomain);
  return `${localPart}@${domain}`;
}

export function normalizeDomain(value) {
  if (typeof value !== 'string') {
    throw new ValidationError('Укажи домен в текстовом формате.');
  }

  const trimmed = value.trim().replace(/\.$/, '').toLowerCase();
  if (/[\s/:?#@\\]/.test(trimmed)) {
    throw new ValidationError('Укажи корректный домен, например example.com.');
  }
  const domain = domainToASCII(trimmed);

  if (!domain || domain.length > 253 || !domain.includes('.')) {
    throw new ValidationError('Укажи корректный домен, например example.com.');
  }

  const labels = domain.split('.');
  if (
    labels.some((label) => !label || label.length > 63 || !DOMAIN_LABEL_RE.test(label)) ||
    !/^[a-z]{2,63}$|^xn--[a-z0-9-]{2,59}$/i.test(labels.at(-1))
  ) {
    throw new ValidationError('Укажи корректный домен, например example.com.');
  }

  return domain;
}
