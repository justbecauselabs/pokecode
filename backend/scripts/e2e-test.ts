#!/usr/bin/env tsx

/**
 * End-to-End Test Script for Claude Code Mobile Backend
 * 
 * This script tests all API endpoints in sequence:
 * 1. Health checks
 * 2. Authentication (login, refresh, me, logout)
 * 3. Session management (CRUD operations)
 * 4. Prompts (create, get, stream, cancel)
 * 5. File operations (list, read, create, update, delete)
 * 6. History and export
 */

import EventSource from 'eventsource';
import chalk from 'chalk';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

interface TestContext {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  sessionId?: string;
  promptId?: string;
  testFilePath?: string;
}

class E2ETestRunner {
  private context: TestContext = {};
  private testResults: { name: string; status: 'pass' | 'fail'; error?: string }[] = [];

  async run() {
    console.log(chalk.blue.bold('\n🚀 Starting E2E Backend Tests\n'));
    console.log(chalk.gray(`API URL: ${BASE_URL}`));
    console.log(chalk.gray(`Test Email: ${TEST_EMAIL}\n`));

    try {
      // Health checks
      await this.testHealthEndpoints();

      // Authentication flow
      await this.testLogin();
      await this.testGetCurrentUser();
      await this.testRefreshToken();

      // Session management
      await this.testCreateSession();
      await this.testListSessions();
      await this.testGetSession();
      await this.testUpdateSession();

      // Prompt operations
      await this.testCreatePrompt();
      await this.testGetPrompt();
      await this.testStreamPrompt();
      await this.testCancelPrompt();

      // File operations
      await this.testListFiles();
      await this.testCreateFile();
      await this.testReadFile();
      await this.testUpdateFile();
      await this.testDeleteFile();

      // History and export
      await this.testGetHistory();
      await this.testExportSession();

      // Cleanup
      await this.testDeleteSession();
      await this.testLogout();

      // Print results
      this.printResults();
    } catch (error) {
      console.error(chalk.red('\n❌ Test suite failed:'), error);
      process.exit(1);
    }
  }

  private async testHealthEndpoints() {
    console.log(chalk.yellow('\n📋 Testing Health Endpoints'));

    // Test main health endpoint
    await this.runTest('GET /health/', async () => {
      const response = await fetch(`${BASE_URL}/health/`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.status || !data.services) throw new Error('Invalid health response');
    });

    // Test liveness probe
    await this.runTest('GET /health/live', async () => {
      const response = await fetch(`${BASE_URL}/health/live`);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (data.status !== 'ok') throw new Error('Liveness check failed');
    });

    // Test readiness probe
    await this.runTest('GET /health/ready', async () => {
      const response = await fetch(`${BASE_URL}/health/ready`);
      if (!response.ok && response.status !== 503) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!['ready', 'not_ready'].includes(data.status)) throw new Error('Invalid ready status');
    });
  }

  private async testLogin() {
    await this.runTest('POST /api/auth/login', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Login failed: ${error.error}`);
      }

      const data = await response.json();
      if (!data.accessToken || !data.refreshToken || !data.user) {
        throw new Error('Invalid login response');
      }

      this.context.accessToken = data.accessToken;
      this.context.refreshToken = data.refreshToken;
      this.context.userId = data.user.id;
    });
  }

  private async testGetCurrentUser() {
    await this.runTest('GET /api/auth/me', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${this.context.accessToken}` },
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.id || !data.email) throw new Error('Invalid user response');
    });
  }

  private async testRefreshToken() {
    await this.runTest('POST /api/auth/refresh', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.context.refreshToken }),
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.accessToken || !data.refreshToken) throw new Error('Invalid refresh response');
      
      this.context.accessToken = data.accessToken;
      this.context.refreshToken = data.refreshToken;
    });
  }

  private async testCreateSession() {
    await this.runTest('POST /api/claude-code/sessions/', async () => {
      const response = await fetch(`${BASE_URL}/api/claude-code/sessions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.context.accessToken}`,
        },
        body: JSON.stringify({
          name: 'E2E Test Session',
          projectPath: '/tmp/e2e-test',
          platform: 'test',
          settings: {
            model: 'claude-3-opus',
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.id || !data.name) throw new Error('Invalid session response');
      
      this.context.sessionId = data.id;
    });
  }

  private async testListSessions() {
    await this.runTest('GET /api/claude-code/sessions/', async () => {
      const response = await fetch(`${BASE_URL}/api/claude-code/sessions/?limit=10`, {
        headers: { Authorization: `Bearer ${this.context.accessToken}` },
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.sessions || !Array.isArray(data.sessions)) throw new Error('Invalid sessions list');
      if (data.sessions.length === 0) throw new Error('No sessions found');
    });
  }

  private async testGetSession() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId', async () => {
      const response = await fetch(`${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}`, {
        headers: { Authorization: `Bearer ${this.context.accessToken}` },
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (data.id !== this.context.sessionId) throw new Error('Session ID mismatch');
    });
  }

  private async testUpdateSession() {
    await this.runTest('PATCH /api/claude-code/sessions/:sessionId', async () => {
      const response = await fetch(`${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.context.accessToken}`,
        },
        body: JSON.stringify({
          name: 'E2E Test Session - Updated',
          settings: {
            model: 'claude-3-sonnet',
            temperature: 0.5,
          },
        }),
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (data.name !== 'E2E Test Session - Updated') throw new Error('Session not updated');
    });
  }

  private async testCreatePrompt() {
    await this.runTest('POST /api/claude-code/sessions/:sessionId/prompts/', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/prompts/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.context.accessToken}`,
          },
          body: JSON.stringify({
            content: 'Test prompt for E2E testing',
            type: 'user',
            metadata: {
              test: true,
            },
          }),
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.id || data.content !== 'Test prompt for E2E testing') {
        throw new Error('Invalid prompt response');
      }
      
      this.context.promptId = data.id;
    });
  }

  private async testGetPrompt() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/prompts/:promptId', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/prompts/${this.context.promptId}`,
        {
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (data.id !== this.context.promptId) throw new Error('Prompt ID mismatch');
    });
  }

  private async testStreamPrompt() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/prompts/:promptId/stream', async () => {
      return new Promise((resolve, reject) => {
        const eventSource = new EventSource(
          `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/prompts/${this.context.promptId}/stream`,
          {
            headers: { Authorization: `Bearer ${this.context.accessToken}` },
          },
        );

        let connected = false;
        const timeout = setTimeout(() => {
          eventSource.close();
          if (!connected) reject(new Error('Stream connection timeout'));
          else resolve(undefined);
        }, 5000);

        eventSource.addEventListener('connected', () => {
          connected = true;
          clearTimeout(timeout);
          eventSource.close();
          resolve(undefined);
        });

        eventSource.addEventListener('error', (error: any) => {
          clearTimeout(timeout);
          eventSource.close();
          reject(new Error(`Stream error: ${error}`));
        });
      });
    });
  }

  private async testCancelPrompt() {
    // Create a new prompt to cancel
    const response = await fetch(
      `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/prompts/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.context.accessToken}`,
        },
        body: JSON.stringify({
          content: 'Prompt to be cancelled',
          type: 'user',
        }),
      },
    );
    const prompt = await response.json();

    await this.runTest('DELETE /api/claude-code/sessions/:sessionId/prompts/:promptId', async () => {
      const deleteResponse = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/prompts/${prompt.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!deleteResponse.ok) throw new Error(`Status: ${deleteResponse.status}`);
      const data = await deleteResponse.json();
      if (!data.success) throw new Error('Prompt cancellation failed');
    });
  }

  private async testListFiles() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/files/', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/files/?path=/`,
        {
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.files || !Array.isArray(data.files)) throw new Error('Invalid files response');
    });
  }

  private async testCreateFile() {
    this.context.testFilePath = 'test-file.txt';
    
    await this.runTest('POST /api/claude-code/sessions/:sessionId/files/*', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/files/${this.context.testFilePath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.context.accessToken}`,
          },
          body: JSON.stringify({
            content: 'This is a test file for E2E testing',
            encoding: 'utf8',
          }),
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('File creation failed');
    });
  }

  private async testReadFile() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/files/*', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/files/${this.context.testFilePath}`,
        {
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (data.content !== 'This is a test file for E2E testing') {
        throw new Error('File content mismatch');
      }
    });
  }

  private async testUpdateFile() {
    await this.runTest('PUT /api/claude-code/sessions/:sessionId/files/*', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/files/${this.context.testFilePath}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.context.accessToken}`,
          },
          body: JSON.stringify({
            content: 'Updated content for E2E testing',
            encoding: 'utf8',
          }),
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('File update failed');
    });
  }

  private async testDeleteFile() {
    await this.runTest('DELETE /api/claude-code/sessions/:sessionId/files/*', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/files/${this.context.testFilePath}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('File deletion failed');
    });
  }

  private async testGetHistory() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/history', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/history?limit=10`,
        {
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.prompts || !Array.isArray(data.prompts)) throw new Error('Invalid history response');
    });
  }

  private async testExportSession() {
    await this.runTest('GET /api/claude-code/sessions/:sessionId/export', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}/export?format=json`,
        {
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.session || !data.prompts) throw new Error('Invalid export response');
    });
  }

  private async testDeleteSession() {
    await this.runTest('DELETE /api/claude-code/sessions/:sessionId', async () => {
      const response = await fetch(
        `${BASE_URL}/api/claude-code/sessions/${this.context.sessionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.context.accessToken}` },
        },
      );

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('Session deletion failed');
    });
  }

  private async testLogout() {
    await this.runTest('POST /api/auth/logout', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.context.accessToken}` },
      });

      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error('Logout failed');
    });
  }

  private async runTest(name: string, testFn: () => Promise<void>) {
    try {
      await testFn();
      this.testResults.push({ name, status: 'pass' });
      console.log(chalk.green(`  ✓ ${name}`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name, status: 'fail', error: errorMessage });
      console.log(chalk.red(`  ✗ ${name}`));
      console.log(chalk.gray(`    ${errorMessage}`));
    }
  }

  private printResults() {
    const passed = this.testResults.filter((r) => r.status === 'pass').length;
    const failed = this.testResults.filter((r) => r.status === 'fail').length;
    const total = this.testResults.length;

    console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));
    console.log(chalk.green(`  Passed: ${passed}/${total}`));
    if (failed > 0) {
      console.log(chalk.red(`  Failed: ${failed}/${total}`));
      console.log(chalk.red('\n  Failed Tests:'));
      this.testResults
        .filter((r) => r.status === 'fail')
        .forEach((r) => {
          console.log(chalk.red(`    • ${r.name}`));
          if (r.error) console.log(chalk.gray(`      ${r.error}`));
        });
    }

    if (failed === 0) {
      console.log(chalk.green.bold('\n✅ All tests passed!'));
    } else {
      console.log(chalk.red.bold(`\n❌ ${failed} test(s) failed`));
      process.exit(1);
    }
  }
}

// Run the tests
const runner = new E2ETestRunner();
runner.run().catch((error) => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});