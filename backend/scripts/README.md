# E2E Test Script

## Overview
The E2E test script (`e2e-test.ts`) provides comprehensive end-to-end testing for all backend API endpoints.

## Prerequisites

1. **Backend Server Running**: The backend server must be running before executing tests
2. **Database Setup**: Ensure PostgreSQL and Redis are running
3. **Test User**: Create a test user in the database (or use the seed script)

## Installation

```bash
# Install dependencies
bun install
```

## Usage

### Run against local server (default port 3000)
```bash
bun test:e2e:local
```

### Run against custom server
```bash
API_URL=https://staging.example.com bun test:e2e
```

### With custom test credentials
```bash
TEST_EMAIL=test@example.com TEST_PASSWORD=password123 bun test:e2e:local
```

## Environment Variables

- `API_URL`: Backend API URL (default: `http://localhost:3000`)
- `TEST_EMAIL`: Test user email (default: `test@example.com`)
- `TEST_PASSWORD`: Test user password (default: `testpassword123`)

## Test Coverage

The E2E test covers:

### Health Checks
- Main health endpoint
- Liveness probe
- Readiness probe

### Authentication
- Login
- Token refresh
- Get current user
- Logout

### Session Management
- Create session
- List sessions
- Get session details
- Update session
- Delete session

### Prompts
- Create prompt
- Get prompt details
- Stream prompt events (SSE)
- Cancel prompt

### File Operations
- List files
- Create file
- Read file content
- Update file
- Delete file

### Additional Features
- Session history
- Session export (JSON/Markdown)

## Output

The script provides colored console output showing:
- Test progress in real-time
- Pass/fail status for each endpoint
- Error details for failed tests
- Summary statistics at the end

Example output:
```
🚀 Starting E2E Backend Tests

API URL: http://localhost:3000
Test Email: test@example.com

📋 Testing Health Endpoints
  ✓ GET /health/
  ✓ GET /health/live
  ✓ GET /health/ready

[... more tests ...]

📊 Test Results Summary

  Passed: 25/25

✅ All tests passed!
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure the backend server is running
2. **Authentication failed**: Check test user credentials exist in database
3. **404 errors**: Verify API routes are correctly registered
4. **Timeout errors**: Check Redis/PostgreSQL connections

### Creating Test User

If the test user doesn't exist, create one:

```sql
-- Connect to your database and run:
INSERT INTO users (email, password_hash, name) 
VALUES ('test@example.com', '$2b$10$...', 'Test User');
```

Or use the seed script if available:
```bash
bun seed
```

## Development

To modify or extend the tests:

1. Edit `scripts/e2e-test.ts`
2. Add new test methods following the pattern:
   ```typescript
   private async testNewEndpoint() {
     await this.runTest('METHOD /path', async () => {
       // Test implementation
     });
   }
   ```
3. Call the new test method in the `run()` method

## CI/CD Integration

For CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Start backend
  run: bun start &
  
- name: Wait for server
  run: sleep 5
  
- name: Run E2E tests
  run: bun test:e2e:local
```