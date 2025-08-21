# PokeCode CLI Migration Review & Action Plan

## 🎯 **Priority Recommendations**

### **Immediate Actions (Before Milestone 5)**

1. **Clean up database files** - Remove scattered database files and centralize to `~/.pokecode/data/`
2. **Fix backend imports** - Update all `@/` imports to proper package references
3. **Replace Node.js APIs with Bun APIs** - Especially in runtime detection and process management
4. **Remove development artifacts** - Clean up test files and debug code

### **Critical for Production (Milestones 5-7)**

1. **Implement dependency bundling** - Essential for global npm installation
2. **Complete configuration management** - Required for reliable CLI operation  
3. **Harden daemon mode** - Security and reliability for production use
4. **Add comprehensive testing** - Prevent regression and production issues

### **Architecture Improvements (Milestone 8+)**

1. **Centralize security utilities** - Consistent security across all packages
2. **Implement proper error handling** - User-friendly error messages and codes
3. **Optimize build system** - Consider monorepo build tools
4. **Add monitoring and health checks** - Production operational requirements

## ✅ **What's Working Well**

- **Modular architecture** is sound and well-separated
- **Build system** produces working bundles
- **CLI framework** is implemented and functional
- **Database migration** to core package is complete
- **TypeScript project references** are working correctly
- **Development workflow** is operational (`bun run dev` works)

## 🚨 **Critical Issues (Must Fix Before Milestone 5)**

### **Migration Cleanup Items**
1. **Database file consolidation** - Multiple database locations exist, need to centralize to `~/.pokecode/data/`
2. **Backend import cleanup** - Remove all `@/` path imports and replace with proper package references
3. **Development artifacts removal** - Clean up test files, debug code, and unused migration files
4. **Node.js API replacement** - Replace Node.js specific APIs with Bun equivalents in process management

### **Dependency Management Crisis**
1. **Workspace dependency bundling** - CLI package currently has `workspace:*` dependencies that will break global npm install
2. **Dependency resolution conflicts** - Multiple versions of same packages across workspace
3. **Bundle size optimization** - 3.9MB CLI bundle could be reduced

## ⚠️ **Architecture Gaps (Milestone 6-7)**

### **Configuration Management**
1. **Missing config validation** - No Zod schemas for configuration files
2. **Path sanitization incomplete** - Security vulnerability in user-provided paths
3. **Environment variable handling** - Inconsistent env var processing across packages

### **Security Hardening**
1. **File permission enforcement** - PID files not properly secured (should be 0o600)
2. **Process validation insufficient** - Weak PID ownership validation
3. **Input sanitization gaps** - CLI arguments not properly validated

### **Error Handling**
1. **Error codes not implemented** - No standardized error code system
2. **User-friendly error messages missing** - Technical errors shown to users
3. **Graceful failure handling incomplete** - App crashes instead of handling errors

## 🔧 **Implementation Gaps (Milestone 8+)**

### **CLI Command Completeness**
1. **Daemon mode partially implemented** - Process spawning works but lacks proper monitoring
2. **Logs command missing follow mode** - `-f` flag not implemented
3. **Config command incomplete** - No config file creation or validation

### **Testing Strategy**
1. **No integration tests** - Only unit tests exist
2. **Cross-platform testing missing** - Not tested on Windows/Linux
3. **Security testing absent** - No penetration testing or security validation

### **Production Readiness**
1. **Health check endpoints incomplete** - Missing database connectivity validation  
2. **Process cleanup insufficient** - Orphaned processes not properly handled
3. **Monitoring capabilities missing** - No operational visibility

## 🚨 **Biggest Risks**

1. **Global Installation Failure** - Workspace dependencies will break npm install
2. **Security Vulnerabilities** - Insufficient input validation and path sanitization
3. **Cross-Platform Issues** - Limited testing on different operating systems
4. **Data Loss** - Multiple database locations could cause confusion
5. **Production Readiness** - Missing testing and error handling

## 📋 **Recommended Action Plan**

### **Phase 1: Critical Fixes (This Week)**
1. **Fix workspace dependencies for global installation**
   - Create dependency bundling script
   - Replace `workspace:*` references with actual versions
   - Test global npm installation locally

2. **Clean up backend import paths**
   - Replace all `@/` imports with proper package references
   - Update TypeScript path mappings
   - Verify all imports resolve correctly

3. **Consolidate database file locations**
   - Remove scattered database files
   - Centralize to `~/.pokecode/data/`
   - Update all database path references

4. **Replace Node.js APIs with Bun equivalents**
   - Update process management to use Bun.spawn()
   - Replace fs operations with Bun.file()
   - Update runtime detection logic

### **Phase 2: Security & Config (Next Week)**  

1. **Implement proper configuration management with validation**
   - Create Zod schemas for all config files
   - Implement config precedence system
   - Add config validation and error reporting

2. **Add file permission security**
   - Set PID files to 0o600 permissions
   - Secure log files and config files
   - Implement proper directory creation

3. **Complete input sanitization**
   - Add path sanitization functions
   - Validate all CLI arguments
   - Prevent directory traversal attacks

4. **Add comprehensive error handling**
   - Implement standardized error codes
   - Create user-friendly error messages
   - Add graceful failure handling

### **Phase 3: Production Polish (Following Week)**

1. **Complete daemon mode implementation**
   - Add proper process monitoring
   - Implement automatic restart capabilities
   - Add process health validation

2. **Add comprehensive testing**
   - Create integration test suite
   - Add cross-platform testing
   - Implement security testing

3. **Implement monitoring and health checks**
   - Add database connectivity validation
   - Implement process monitoring endpoints
   - Add operational visibility features

4. **Cross-platform testing and validation**
   - Test on Windows, macOS, and Linux
   - Validate file path handling
   - Test daemon mode on all platforms

## 📊 **Detailed Issue Analysis**

### **Migration Cleanup Items**

#### 1. Database File Consolidation
**Current Issue**: Multiple database files scattered across workspace
```bash
# Found in multiple locations:
- backend/data/database.db
- packages/core/data/database.db  
- ~/.pokecode/database.db
```
**Required Action**: 
- Centralize to `~/.pokecode/data/database.db`
- Update all database connection strings
- Remove old database files
- Update documentation

#### 2. Backend Import Cleanup
**Current Issue**: Legacy `@/` path imports throughout codebase
```typescript
// Found patterns like:
import { something } from '@/services/session'
import { config } from '@/config'
```
**Required Action**:
- Replace with proper package imports: `@pokecode/core`
- Update TypeScript path mappings
- Remove legacy path configurations

#### 3. Development Artifacts
**Current Issue**: Test files and debug code in production bundles
```bash
# Found artifacts:
- *.test.ts files in dist/
- console.log statements
- Debug environment variables
```
**Required Action**:
- Clean up test files from production builds
- Remove debug console statements
- Clean environment variable handling

### **Dependency Management Crisis**

#### 1. Workspace Dependency Bundling
**Critical Issue**: CLI package uses `workspace:*` dependencies
```json
// packages/cli/package.json - BREAKS npm install -g
{
  "dependencies": {
    "@pokecode/api": "workspace:*",
    "@pokecode/core": "workspace:*", 
    "@pokecode/server": "workspace:*"
  }
}
```
**Required Solution**:
```bash
# Create bundling script
npm run prepare:publish  # Bundles all dependencies
# Generates package.json with real versions:
{
  "dependencies": {
    "fastify": "^4.27.0",
    "drizzle-orm": "^0.30.10",
    // ... all bundled dependencies
  }
}
```

#### 2. Bundle Size Optimization
**Current State**: 3.9MB CLI bundle
**Optimization Targets**:
- Remove unused dependencies
- Use dynamic imports where possible
- Optimize Fastify plugins
- Consider splitting CLI and server bundles

### **Security Hardening Requirements**

#### 1. File Permission Enforcement
**Current Issue**: Insecure file permissions
```typescript
// INSECURE - Current implementation
await Bun.write(pidFile, pid.toString());

// SECURE - Required implementation  
await Bun.write(pidFile, pid.toString(), { mode: 0o600 });
```

#### 2. Path Sanitization
**Security Vulnerability**: User paths not sanitized
```typescript
// VULNERABLE - Current implementation
const userPath = args.configDir;
const configFile = path.join(userPath, 'config.json');

// SECURE - Required implementation
const sanitizePath = (userPath: string) => {
  const resolved = path.resolve(userPath);
  if (!resolved.startsWith(process.env.HOME!)) {
    throw new Error('Path outside user directory not allowed');
  }
  return resolved;
};
```

### **Configuration Management Gaps**

#### 1. Missing Zod Validation
**Required Schema**:
```typescript
const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  host: z.string().ip().or(z.literal('0.0.0.0')),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']),
  dataDir: z.string().transform(sanitizePath),
  logFile: z.string().transform(sanitizePath)
});
```

#### 2. Config Precedence System
**Required Implementation**:
1. CLI arguments (highest priority)
2. Environment variables (POKECODE_*)
3. Local config file (./pokecode.config.json)
4. Global config file (~/.pokecode/config.json)  
5. Default values (lowest priority)

### **Error Handling Framework**

#### 1. Standardized Error Codes
**Required Implementation**:
```typescript
enum ErrorCodes {
  PORT_IN_USE = 'E001',
  INVALID_CONFIG = 'E002', 
  PERMISSION_DENIED = 'E003',
  PROCESS_NOT_FOUND = 'E004',
  DATABASE_ERROR = 'E005',
  NETWORK_ERROR = 'E006'
}
```

#### 2. User-Friendly Error Messages
**Current Issue**: Technical errors shown to users
```bash
# BAD - Current behavior
Error: EADDRINUSE: address already in use :::3001

# GOOD - Required behavior  
[E001] Port 3001 is already in use.
Try: pokecode serve --port 3002
Or stop the existing server: pokecode stop
```

### **Testing Strategy Requirements**

#### 1. Integration Test Suite
**Required Tests**:
- Full daemon lifecycle (start → status → stop)
- Multi-instance conflict resolution
- Configuration precedence validation
- Cross-platform file path handling

#### 2. Security Testing
**Required Validations**:
- Path traversal prevention
- PID spoofing protection  
- Configuration injection attempts
- File permission validation

#### 3. Cross-Platform Testing
**Required Platforms**:
- Windows 10/11
- macOS (Intel and ARM)
- Linux (Ubuntu, CentOS)

## 🔄 **Implementation Timeline**

### **Week 1: Critical Infrastructure**
- **Day 1-2**: Fix workspace dependencies and global installation
- **Day 3-4**: Clean up import paths and database consolidation  
- **Day 5**: Replace Node.js APIs with Bun equivalents

### **Week 2: Security & Configuration**
- **Day 1-2**: Implement configuration management with validation
- **Day 3-4**: Add security hardening (file permissions, path sanitization)
- **Day 5**: Implement comprehensive error handling

### **Week 3: Production Readiness**
- **Day 1-2**: Complete daemon mode implementation
- **Day 3-4**: Add comprehensive testing suite
- **Day 5**: Cross-platform testing and validation

## 🎯 **Success Criteria**

### **Phase 1 Complete When**:
- ✅ `npm install -g @justebecauselabs/pokecode` works
- ✅ All imports resolve without `@/` paths
- ✅ Single database location used consistently
- ✅ All Bun APIs used instead of Node.js APIs

### **Phase 2 Complete When**:
- ✅ Configuration validation works with Zod schemas
- ✅ All files have proper security permissions
- ✅ User-friendly error messages with error codes
- ✅ Path sanitization prevents security vulnerabilities

### **Phase 3 Complete When**:
- ✅ Daemon mode works reliably with monitoring
- ✅ Full test suite passes on all platforms
- ✅ Health checks validate all system components
- ✅ Production deployment ready

## 📝 **Notes**

This migration has successfully achieved the core modular architecture goals, but requires focused effort on production readiness, security hardening, and dependency management before it can be safely published and used globally.

The biggest risk is the workspace dependency issue which will cause global npm installation to fail completely. This must be addressed first before any other work can proceed.