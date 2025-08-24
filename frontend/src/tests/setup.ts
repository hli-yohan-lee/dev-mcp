// Test setup file for vitest
import { vi } from 'vitest'

// Mock global fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn()
}

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}