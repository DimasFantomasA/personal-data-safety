import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizeDomain } from '../src/utils/validation.mjs';
import { ValidationError } from '../src/utils/errors.mjs';

describe('normalizeEmail', () => {
  it('обрезает пробелы и приводит домен к нижнему регистру', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('Test@example.com');
  });

  it('сохраняет регистр локальной части', () => {
    expect(normalizeEmail('John.Doe@Example.com')).toBe('John.Doe@example.com');
  });

  it('принимает плюс и точки в локальной части', () => {
    expect(normalizeEmail('a.b+tag@example.com')).toBe('a.b+tag@example.com');
  });

  it('принимает IDN-домен и переводит его в punycode', () => {
    expect(normalizeEmail('user@пример.рф')).toBe('user@xn--e1afmkfd.xn--p1ai');
  });

  it.each([
    ['не строка (число)', 123],
    ['null', null],
    ['undefined', undefined],
    ['пустая строка', ''],
    ['только пробелы', '   '],
    ['без @', 'invalid-email'],
    ['два @', 'a@@example.com'],
    ['@ в начале', '@example.com'],
    ['локальная часть начинается с точки', '.user@example.com'],
    ['локальная часть заканчивается точкой', 'user.@example.com'],
    ['две точки подряд', 'us..er@example.com'],
    ['пробел в локальной части', 'us er@example.com'],
    ['локальная часть длиннее 64', 'a'.repeat(65) + '@example.com'],
    ['домен без точки', 'user@localhost'],
    ['домен с цифровым TLD', 'user@example.123'],
  ])('бросает ValidationError: %s', (_label, value) => {
    expect(() => normalizeEmail(value)).toThrow(ValidationError);
  });
});

describe('normalizeDomain', () => {
  it('убирает точку в конце и приводит к нижнему регистру', () => {
    expect(normalizeDomain('Example.COM.')).toBe('example.com');
  });

  it('обрезает пробелы по краям', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });

  it('переводит IDN в punycode', () => {
    expect(normalizeDomain('пример.рф')).toBe('xn--e1afmkfd.xn--p1ai');
  });

  it.each([
    ['не строка (число)', 42],
    ['null', null],
    ['пустая строка', ''],
    ['пробел внутри', 'exa mple.com'],
    ['слэш', 'example.com/path'],
    ['двоеточие', 'example.com:8080'],
    ['собака @', 'user@example.com'],
    ['вопросительный знак', 'example.com?x=1'],
    ['решётка', 'example.com#frag'],
    ['обратный слэш', 'example.com\\path'],
    ['без точки', 'localhost'],
    ['метка длиннее 63 символов', 'a'.repeat(64) + '.com'],
    ['пустая метка', 'example..com'],
    ['цифровой TLD', 'example.123'],
    ['TLD из одной буквы', 'example.c'],
  ])('бросает ValidationError: %s', (_label, value) => {
    expect(() => normalizeDomain(value)).toThrow(ValidationError);
  });
});