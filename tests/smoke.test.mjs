import { describe, it, expect } from 'vitest';

describe('smoke: модули импортируются', () => {
  it('services/xposedornot.mjs загружается', async () => {
    const mod = await import('../src/services/xposedornot.mjs');
    expect(mod.XposedOrNotClient).toBeTypeOf('function');
    expect(mod.normalizeDomainSummary).toBeTypeOf('function');
  });

  it('app.mjs загружается и экспортирует createApp', async () => {
    const mod = await import('../src/app.mjs');
    expect(mod.createApp).toBeTypeOf('function');
  });
});