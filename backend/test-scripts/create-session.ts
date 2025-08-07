#!/usr/bin/env bun

/**
 * Test script for create session endpoint
 * Usage: bun run test-scripts/create-session.ts
 */

import { testLogin } from './login';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface CreateSessionResponse {
  id: string;
  userId: string;
  title: string;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

async function createSession(accessToken?: string) {
  // If no token provided, login first
  if (!accessToken) {
    console.log('🔐 No access token provided, logging in first...');
    const loginData = await testLogin();
    accessToken = loginData.accessToken;
    console.log('');
  }

  const sessionData = {
    title: process.env.SESSION_TITLE || `Test Session ${new Date().toISOString()}`,
    projectPath: process.env.PROJECT_PATH || '/test/project',
  };

  console.log('📝 Testing create session endpoint...');
  console.log(`📍 URL: ${API_BASE_URL}/api/claude-code/sessions`);
  console.log('📋 Title:', sessionData.title);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/claude-code/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(sessionData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Session creation failed');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      process.exit(1);
    }

    const data = responseData as CreateSessionResponse;
    
    console.log('✅ Session created successfully!');
    console.log('');
    console.log('📊 Session Details:');
    console.log('  ID:', data.id);
    console.log('  User ID:', data.userId);
    console.log('  Title:', data.title);
    console.log('  Created:', new Date(data.createdAt).toLocaleString());
    console.log('  Last Activity:', new Date(data.lastActivity).toLocaleString());
    
    // Export session ID for use in other scripts
    if (process.env.EXPORT_SESSION) {
      console.log('');
      console.log('Export for other scripts:');
      console.log(`export SESSION_ID="${data.id}"`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error creating session:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  const accessToken = process.env.ACCESS_TOKEN;
  createSession(accessToken);
}

export { createSession };