import { describe, it, expect } from 'vitest';

describe('Unit Test Example', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should be able to mock things', () => {
    const mockFn = vi.fn();
    mockFn('hello');
    expect(mockFn).toHaveBeenCalledWith('hello');
  });
});
