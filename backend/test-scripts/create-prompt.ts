#!/usr/bin/env bun

/**
 * Test script for create prompt endpoint
 * Usage: bun run test-scripts/create-prompt.ts
 */

import { testLogin } from './login';
import { createSession } from './create-session';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface CreatePromptResponse {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  isUser: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StreamResponse {
  id: string;
  content: string;
  isUser: boolean;
  sessionId: string;
}

async function createPrompt(accessToken?: string, sessionId?: string) {
  // If no token provided, login first
  if (!accessToken) {
    console.log('🔐 No access token provided, logging in first...');
    const loginData = await testLogin();
    accessToken = loginData.accessToken;
    console.log('');
  }

  // If no session ID provided, create a session first
  if (!sessionId) {
    console.log('📝 No session ID provided, creating session first...');
    const sessionData = await createSession(accessToken);
    sessionId = sessionData.id;
    console.log('');
  }

  const promptData = {
    prompt: process.env.PROMPT_CONTENT || 'Hello, can you help me write a simple TypeScript function?',
    stream: process.env.STREAM === 'true' || false,
  };

  console.log('💬 Testing create prompt endpoint...');
  console.log(`📍 URL: ${API_BASE_URL}/api/claude-code/sessions/${sessionId}/prompts`);
  console.log('📝 Prompt:', promptData.prompt);
  console.log('🔄 Stream mode:', promptData.stream);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/claude-code/sessions/${sessionId}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(promptData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Prompt creation failed');
      console.error('Status:', response.status);
      console.error('Response:', JSON.stringify(errorData, null, 2));
      process.exit(1);
    }

    if (promptData.stream) {
      // Handle streaming response
      console.log('🔄 Receiving streaming response...');
      console.log('');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      if (!reader) {
        throw new Error('No response body reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              console.log('\n✅ Stream completed!');
            } else {
              try {
                const data = JSON.parse(dataStr) as StreamResponse;
                if (!data.isUser) {
                  assistantResponse += data.content;
                  process.stdout.write(data.content);
                }
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        }
      }

      console.log('');
      console.log('📊 Summary:');
      console.log('  Total response length:', assistantResponse.length, 'characters');
      
    } else {
      // Handle regular JSON response
      const responseData = await response.json();
      const data = responseData as CreatePromptResponse;
      
      console.log('✅ Prompt created successfully!');
      console.log('');
      console.log('📊 Prompt Details:');
      console.log('  ID:', data.id);
      console.log('  Session ID:', data.sessionId);
      console.log('  User ID:', data.userId);
      console.log('  Is User:', data.isUser);
      console.log('  Created:', new Date(data.createdAt).toLocaleString());
      console.log('');
      console.log('💬 Content:');
      console.log(data.content);
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating prompt:', error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.main) {
  const accessToken = process.env.ACCESS_TOKEN;
  const sessionId = process.env.SESSION_ID;
  createPrompt(accessToken, sessionId);
}

export { createPrompt };