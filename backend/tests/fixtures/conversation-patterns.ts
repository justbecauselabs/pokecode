/**
 * Realistic conversation patterns for testing complete workflows
 * These represent common development tasks and interactions
 */

import type { SDKMessage } from '../../src/types/claude-code-sdk-message-types';
import { assistantMessages, resultMessages, systemMessages, userMessages } from './sdk-messages';

/**
 * Simple question and answer conversation
 */
export const simpleQA = (
  question: string,
  answer: string,
  sessionId = 'test-session-1',
): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.simple(question, sessionId),
  assistantMessages.textResponse(answer, sessionId),
  resultMessages.success(sessionId),
];

/**
 * File reading and analysis workflow
 */
export const fileAnalysisFlow = (fileName: string, sessionId = 'test-session-1'): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.fileAnalysis(fileName, sessionId),
  assistantMessages.fileRead(fileName, sessionId),
  assistantMessages.textResponse(
    `I've analyzed ${fileName}. This file appears to contain code that follows standard patterns. The analysis shows the structure and functionality are well-organized.`,
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Code generation workflow
 */
export const codeGenerationFlow = (
  task: string,
  fileName: string,
  sessionId = 'test-session-1',
): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.simple(task, sessionId),
  assistantMessages.withThinking(
    "I'll create a solution for this task.",
    `Let me think about how to approach ${task}. I'll create a new file with the implementation.`,
    sessionId,
  ),
  assistantMessages.fileWrite(
    fileName,
    `// Generated code for: ${task}\nexport function solution() {\n  // Implementation here\n  return true;\n}`,
    sessionId,
  ),
  assistantMessages.textResponse(
    `I've created ${fileName} with the solution for your task. The implementation includes the basic structure and can be extended as needed.`,
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Bug fixing workflow with file modification
 */
export const bugFixFlow = (
  bugDescription: string,
  fileName: string,
  sessionId = 'test-session-1',
): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.bugFix(bugDescription, sessionId),
  assistantMessages.fileRead(fileName, sessionId),
  assistantMessages.withThinking(
    "I found the issue! I'll fix the problem.",
    'Looking at this code, I can identify the issue and will fix it properly.',
    sessionId,
  ),
  assistantMessages.textResponse(
    `Fixed the bug in ${fileName}! The issue has been resolved by correcting the problematic code.`,
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Testing workflow - run tests and fix failures
 */
export const testingFlow = (sessionId = 'test-session-1'): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.simple('Run the tests and fix any failures', sessionId),
  assistantMessages.bashCommand(
    'bun test',
    "I'll run the test suite to see if there are any failures.",
    sessionId,
  ),
  assistantMessages.textResponse(
    'Tests completed successfully. All tests are now passing.',
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Multi-file refactoring workflow
 */
export const refactoringFlow = (sessionId = 'test-session-1'): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.simple(
    'Refactor the old API function names to use the new naming convention',
    sessionId,
  ),
  assistantMessages.textResponse(
    "I'll search for old API function patterns and update them to the new convention.",
    sessionId,
  ),
  assistantMessages.textResponse(
    'Successfully refactored the API function names. Updated functions to follow the new naming convention.',
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Error handling and recovery workflow
 */
export const errorRecoveryFlow = (sessionId = 'test-session-1'): SDKMessage[] => [
  systemMessages.init(sessionId),
  userMessages.simple('Read the configuration file and check if the service is running', sessionId),
  assistantMessages.fileRead('config/app.json', sessionId),
  assistantMessages.textResponse(
    'I found several configuration-related files. It looks like this project uses environment variables instead of a JSON config file. You may need to copy `.env.example` to `.env` and configure your settings there.',
    sessionId,
  ),
  resultMessages.success(sessionId),
];

/**
 * Export all conversation patterns
 */
export const conversationPatterns = {
  simpleQA,
  fileAnalysisFlow,
  codeGenerationFlow,
  bugFixFlow,
  testingFlow,
  refactoringFlow,
  errorRecoveryFlow,
};

/**
 * Conversation pattern matching helpers
 */
export const conversationMatchers = {
  // Pattern matching for different types of requests
  isFileAnalysis: (prompt: string): boolean =>
    /analyze|examine|review|check.*file|what.*does.*do/i.test(prompt),

  isCodeGeneration: (prompt: string): boolean =>
    /create|generate|write|build.*function|class|component/i.test(prompt),

  isBugFix: (prompt: string): boolean => /fix|debug|solve|error|bug|issue|problem/i.test(prompt),

  isTesting: (prompt: string): boolean => /test|spec|jest|vitest|coverage/i.test(prompt),

  isRefactoring: (prompt: string): boolean =>
    /refactor|rename|reorganize|restructure|clean.*up/i.test(prompt),
};

/**
 * Get appropriate conversation pattern for a prompt
 */
export function getConversationPattern(prompt: string, sessionId = 'test-session-1'): SDKMessage[] {
  if (conversationMatchers.isFileAnalysis(prompt)) {
    return fileAnalysisFlow('example.ts', sessionId);
  }

  if (conversationMatchers.isCodeGeneration(prompt)) {
    return codeGenerationFlow(prompt, 'generated.ts', sessionId);
  }

  if (conversationMatchers.isBugFix(prompt)) {
    return bugFixFlow(prompt, 'buggy-file.ts', sessionId);
  }

  if (conversationMatchers.isTesting(prompt)) {
    return testingFlow(sessionId);
  }

  if (conversationMatchers.isRefactoring(prompt)) {
    return refactoringFlow(sessionId);
  }

  // Default to simple Q&A
  return simpleQA(prompt, `I'll help you with: ${prompt}`, sessionId);
}
