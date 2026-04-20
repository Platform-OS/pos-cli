import { vi } from 'vitest';

/** Returns a fresh spinner mock with all ora-compatible methods stubbed. */
const makeSpinner = () => ({ start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() });

export { makeSpinner };
