import { z } from 'zod';

// Canonical provider values used across the system
export const PROVIDER_VALUES = ['claude-code', 'codex-cli'] as const;
export type Provider = (typeof PROVIDER_VALUES)[number];
export const ProviderSchema = z.enum([...PROVIDER_VALUES]);

// Backward-compatible input values we accept from clients.
// Normalizes legacy aliases like "claude" and "codex" to canonical values.
export const PROVIDER_INPUT_VALUES = ['claude-code', 'codex-cli', 'claude', 'codex'] as const;
export type ProviderInput = (typeof PROVIDER_INPUT_VALUES)[number];

const PROVIDER_NORMALIZE: { readonly [K in ProviderInput]: Provider } = {
  'claude-code': 'claude-code',
  'codex-cli': 'codex-cli',
  claude: 'claude-code',
  codex: 'codex-cli',
} as const;

// Schema that accepts both canonical and alias values, output is canonical Provider
export const ProviderInputSchema = z
  .enum(PROVIDER_INPUT_VALUES)
  .transform((value) => PROVIDER_NORMALIZE[value]);

export * from './agent';
export * from './codex';
export * from './command';
export * from './directory';
export * from './message';
export * from './repository';
export * from './session';
export * from './sse';
