# Security Documentation

## Overview

This document outlines the security measures, best practices, and guidelines implemented in the Claude Code Mobile backend to ensure data protection, system integrity, and user privacy.

## Security Architecture

### Defense in Depth
Multiple layers of security controls:
1. **Network Security**: CORS, rate limiting, firewall rules
2. **Application Security**: Input validation, sanitization, authentication
3. **Data Security**: Encryption, access controls, audit logging
4. **Infrastructure Security**: Environment isolation, secrets management

## Authentication & Authorization

### JWT Implementation
```typescript
// Token generation
const token = jwt.sign(
  { userId, sessionId },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Token verification
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

### Session Security
- Session tokens expire after 24 hours
- Refresh tokens for extended sessions
- Session invalidation on logout
- IP address validation for sensitive operations

## Input Validation

### Schema Validation
All inputs are validated using TypeBox and Zod schemas:

```typescript
// TypeBox for API validation
const MessageSchema = Type.Object({
  content: Type.String({ 
    minLength: 1, 
    maxLength: 10000,
    pattern: '^[^<>]*$' // No HTML tags
  }),
  allowedTools: Type.Optional(
    Type.Array(Type.String())
  )
});

// Zod for environment validation
const EnvSchema = z.object({
  DB_PASSWORD: z.string().min(8),
  JWT_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().optional()
});
```

### SQL Injection Prevention
Drizzle ORM provides parameterized queries by default:

```typescript
// Safe: Parameterized query
await db.query.sessions.findFirst({
  where: eq(sessions.id, userInput)
});

// Never use string concatenation
// UNSAFE: const query = `SELECT * FROM sessions WHERE id = '${userInput}'`;
```

### XSS Prevention
```typescript
// Content sanitization
import DOMPurify from 'isomorphic-dompurify';

function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

// Response headers
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
});
```

## File Security

### Path Traversal Prevention
```typescript
import { normalize, join, isAbsolute } from 'path';

export function validateFilePath(
  basePath: string, 
  requestedPath: string
): string {
  // Normalize and resolve the path
  const resolved = normalize(join(basePath, requestedPath));
  
  // Ensure the resolved path is within base path
  if (!resolved.startsWith(basePath)) {
    throw new SecurityError('Path traversal attempt detected');
  }
  
  // Additional checks
  if (requestedPath.includes('..') || requestedPath.includes('~')) {
    throw new SecurityError('Invalid path characters');
  }
  
  return resolved;
}
```

### File Upload Restrictions
```typescript
const ALLOWED_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.json',
  '.md', '.txt', '.html', '.css', '.py',
  '.java', '.go', '.rs', '.rb', '.php'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(file: UploadedFile) {
  // Check extension
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('File type not allowed');
  }
  
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
  
  // Check content type
  if (!isTextFile(file.mimeType)) {
    throw new Error('Binary files not allowed');
  }
}
```

## Rate Limiting

### Endpoint-Specific Limits
```typescript
// Configuration per endpoint
const rateLimits = {
  '/api/claude-code/sessions/:id/messages': {
    max: 10,
    window: 60000, // 1 minute
    message: 'Too many prompts, please wait'
  },
  '/api/claude-code/sessions/:id/files': {
    max: 100,
    window: 60000,
    message: 'File operation limit exceeded'
  },
  'default': {
    max: 1000,
    window: 60000,
    message: 'Rate limit exceeded'
  }
};

// Implementation
app.addHook('onRequest', async (request, reply) => {
  const limit = getRateLimit(request.url);
  const key = `${request.ip}:${request.url}`;
  
  if (await isRateLimited(key, limit)) {
    reply.code(429).send({ 
      error: limit.message,
      retryAfter: limit.window / 1000
    });
  }
});
```

### DDoS Protection
```typescript
// Connection limits
const server = Fastify({
  maxParamLength: 100,
  bodyLimit: 10485760, // 10MB
  connectionTimeout: 60000,
  keepAliveTimeout: 5000,
  requestTimeout: 30000
});

// Request throttling
app.register(fastifyRateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1'],
  redis: redisClient
});
```

## Secrets Management

### Environment Variables
```typescript
// Never commit secrets
// .env file (git-ignored)
DB_PASSWORD=super-secret-password
JWT_SECRET=32-character-minimum-secret-key
ANTHROPIC_API_KEY=sk-ant-api03-...

// Validate on startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

### Secure Storage
```typescript
// Use encryption for sensitive data
import { createCipheriv, createDecipheriv } from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

## CORS Configuration

### Strict CORS Policy
```typescript
app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://app.example.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 hours
});
```

## Security Headers

### Helmet Configuration
```typescript
app.register(helmet, {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  
  // Cross-Origin Policies
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  
  // Other security headers
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "same-origin" },
  xssFilter: true
});
```

## Logging & Monitoring

### Security Event Logging
```typescript
// Audit log for security events
class SecurityLogger {
  logFailedAuth(userId: string, ip: string) {
    logger.warn({
      event: 'AUTH_FAILED',
      userId,
      ip,
      timestamp: new Date().toISOString()
    }, 'Authentication failed');
  }
  
  logSuspiciousActivity(details: any) {
    logger.error({
      event: 'SUSPICIOUS_ACTIVITY',
      ...details,
      timestamp: new Date().toISOString()
    }, 'Suspicious activity detected');
  }
  
  logAccessViolation(userId: string, resource: string) {
    logger.error({
      event: 'ACCESS_VIOLATION',
      userId,
      resource,
      timestamp: new Date().toISOString()
    }, 'Unauthorized access attempt');
  }
}
```

### Sensitive Data Handling
```typescript
// Never log sensitive data
logger.info({
  userId: user.id,
  email: maskEmail(user.email), // jo**@example.com
  // Never log: password, apiKey, token, ssn, etc.
}, 'User logged in');

// Mask sensitive data
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}
```

## Vulnerability Management

### Dependency Security
```bash
# Regular security audits
bun audit

# Update dependencies
bun update

# Check for known vulnerabilities
npx snyk test

# Monitor dependencies
npx depcheck
```

### Security Testing
```typescript
// Security test examples
describe('Security Tests', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE sessions; --";
    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${maliciousInput}`
    });
    expect(response.statusCode).toBe(400);
  });
  
  it('should prevent path traversal', async () => {
    const maliciousPath = '../../../etc/passwd';
    const response = await app.inject({
      method: 'GET',
      url: `/api/files/${maliciousPath}`
    });
    expect(response.statusCode).toBe(403);
  });
  
  it('should enforce rate limits', async () => {
    const requests = Array(15).fill(null).map(() =>
      app.inject({
        method: 'POST',
        url: '/api/messages'
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.statusCode === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Incident Response

### Security Incident Procedure
1. **Detect**: Monitor logs for suspicious activity
2. **Contain**: Isolate affected systems
3. **Investigate**: Analyze logs and identify root cause
4. **Remediate**: Fix vulnerability and patch systems
5. **Recover**: Restore normal operations
6. **Review**: Post-incident analysis and improvements

### Emergency Contacts
```typescript
// Security incident notification
async function notifySecurityTeam(incident: SecurityIncident) {
  await emailService.send({
    to: process.env.SECURITY_TEAM_EMAIL,
    subject: `[URGENT] Security Incident: ${incident.type}`,
    body: formatIncidentReport(incident)
  });
  
  // Also log to security monitoring system
  await securityMonitor.alert(incident);
}
```

## Compliance

### Data Privacy
- GDPR compliance for EU users
- Data minimization principles
- Right to erasure implementation
- Data portability support

### Security Standards
- OWASP Top 10 mitigation
- CWE/SANS Top 25 prevention
- Security headers implementation
- Regular security audits

## Security Checklist

### Development
- [ ] Input validation on all endpoints
- [ ] Output encoding for user data
- [ ] Parameterized database queries
- [ ] Secure session management
- [ ] Error messages don't leak information
- [ ] Logging doesn't include sensitive data

### Deployment
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Secrets stored securely
- [ ] Database access restricted

### Maintenance
- [ ] Regular dependency updates
- [ ] Security patches applied
- [ ] Logs monitored for anomalies
- [ ] Backups encrypted and tested
- [ ] Incident response plan updated
- [ ] Security training completed