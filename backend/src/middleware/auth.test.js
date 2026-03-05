import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Set env vars before import
process.env.JWT_SECRET = 'test-jwt-secret-123';
process.env.REFRESH_SECRET = 'test-refresh-secret-456';

// Mock DB
vi.mock('../db/init.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

const {
  authenticateToken, optionalAuth,
  generateToken, generateRefreshToken, hashToken,
} = await import('./auth.js');

function makeReq(token) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

describe('generateToken', () => {
  it('creates a valid JWT with id and email', () => {
    const token = generateToken({ id: 42, email: 'test@test.com' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe(42);
    expect(decoded.email).toBe('test@test.com');
  });

  it('expires in 15 minutes', () => {
    const token = generateToken({ id: 1, email: 'a@b.com' });
    const decoded = jwt.decode(token);
    // exp - iat should be ~900 seconds
    expect(decoded.exp - decoded.iat).toBe(900);
  });
});

describe('generateRefreshToken', () => {
  it('creates a JWT with type=refresh', () => {
    const token = generateRefreshToken({ id: 1, email: 'a@b.com' });
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
    expect(decoded.type).toBe('refresh');
    expect(decoded.id).toBe(1);
  });

  it('expires in 30 days', () => {
    const token = generateRefreshToken({ id: 1, email: 'a@b.com' });
    const decoded = jwt.decode(token);
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(decoded.exp - decoded.iat).toBe(thirtyDays);
  });
});

describe('hashToken', () => {
  it('returns a 64-char hex string (sha256)', () => {
    const hash = hashToken('some-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token1')).not.toBe(hashToken('token2'));
  });
});

describe('authenticateToken middleware', () => {
  it('rejects requests without Authorization header', () => {
    const req = makeReq(null);
    const res = makeRes();
    const next = vi.fn();
    authenticateToken(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Access token required');
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid token and sets req.user', () => {
    const token = generateToken({ id: 5, email: 'user@test.com' });
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(5);
    expect(req.user.email).toBe('user@test.com');
  });

  it('rejects expired tokens with TOKEN_EXPIRED code', () => {
    const token = jwt.sign(
      { id: 1, email: 'a@b.com' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );
    // jwt.verify is sync-ish with callback, so small delay needed
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();
    authenticateToken(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens with TOKEN_INVALID code', () => {
    const req = makeReq('garbage.token.here');
    const res = makeRes();
    const next = vi.fn();
    authenticateToken(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth middleware', () => {
  it('sets req.user for valid tokens', () => {
    const token = generateToken({ id: 7, email: 'opt@test.com' });
    const req = makeReq(token);
    const res = makeRes();
    const next = vi.fn();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(7);
  });

  it('calls next without req.user for missing token', () => {
    const req = makeReq(null);
    const res = makeRes();
    const next = vi.fn();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('calls next without req.user for invalid token', () => {
    const req = makeReq('invalid.token');
    const res = makeRes();
    const next = vi.fn();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
