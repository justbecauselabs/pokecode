import { describe, it, expect } from 'vitest';
import { config } from '@/config';

describe('Config', () => {
  it('should have required environment variables', () => {
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(config.PORT).toBeDefined();
  });

  it('should have valid port number', () => {
    expect(typeof config.PORT).toBe('number');
    expect(config.PORT).toBeGreaterThan(0);
    expect(config.PORT).toBeLessThanOrEqual(65535);
  });
});