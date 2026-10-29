import { sanitizeLogMessage } from '../src/api/client';

describe('API Security', () => {
  it('should redact sensitive credentials and tokens in log messages', () => {
    const raw = 'Login failure for test@example.com with password secret123 and token eyJhbGciOi...';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('secret123');
    expect(sanitized).not.toContain('eyJhbGciOi...');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('should redact password and token with colons and equals signs', () => {
    const raw = 'Config: password: my-secret-password, token=abc123token, Bearer eyJhbGciOiJIUzI1NiJ9.test.sig';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('my-secret-password');
    expect(sanitized).not.toContain('abc123token');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9.test.sig');
    expect(sanitized).toContain('[REDACTED]');
  });
});
