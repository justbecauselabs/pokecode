#!/usr/bin/env bun

/**
 * Test script for login endpoint
 * Usage: bun run test-scripts/login.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
}

async function testLogin() {
  const loginData = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'testpassword123',
  };

  console.log('🔐 Testing login endpoint...');
  console.log(`📍 URL: ${API_BASE_URL}/api/auth/login`);
  console.log('📧 Email:', loginData.email);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Login failed');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      process.exit(1);
    }

    const data = responseData as LoginResponse;
    
    console.log('✅ Login successful!');
    console.log('');
    console.log('👤 User Info:');
    console.log('  ID:', data.user.id);
    console.log('  Email:', data.user.email);
    console.log('  Name:', data.user.name);
    console.log('');
    console.log('🔑 Tokens:');
    console.log('  Access Token:', data.accessToken.substring(0, 20) + '...');
    console.log('  Refresh Token:', data.refreshToken.substring(0, 20) + '...');
    
    // Export tokens for use in other scripts
    if (process.env.EXPORT_TOKENS) {
      console.log('');
      console.log('Export for other scripts:');
      console.log(`export ACCESS_TOKEN="${data.accessToken}"`);
      console.log(`export USER_ID="${data.user.id}"`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error during login:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  testLogin();
}

export { testLogin };