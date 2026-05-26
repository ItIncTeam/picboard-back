// Jest manual mock for uuid v14 (ESM) — returns deterministic values for tests
module.exports = {
  v4: () => '00000000-0000-4000-8000-000000000000',
  v1: () => '00000000-0000-1000-8000-000000000000',
  v3: () => '00000000-0000-3000-8000-000000000000',
  v5: () => '00000000-0000-5000-8000-000000000000',
  NIL: '00000000-0000-0000-0000-000000000000',
  MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  parse: () => new Uint8Array(16),
  stringify: () => '00000000-0000-0000-0000-000000000000',
  validate: () => true,
  version: () => 4,
};
