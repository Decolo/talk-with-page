import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';
import type { CLIOptions } from './cli.js';

export interface ServerConfig {
  port: number;
  host: string;
  anthropicAuthToken: string;
  anthropicBaseUrl?: string;
  apiTimeoutMs?: number;
  disableNonessentialTraffic?: boolean;
}

interface ClaudeSettings {
  env?: {
    ANTHROPIC_AUTH_TOKEN?: string;
    ANTHROPIC_BASE_URL?: string;
    API_TIMEOUT_MS?: string;
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: string;
  };
}

interface ConfigSource {
  port?: number;
  token?: string;
  baseUrl?: string;
  apiTimeoutMs?: string;
  disableNonessentialTraffic?: string;
}

/**
 * Load configuration from Claude Code settings file
 */
function loadClaudeSettings(): ConfigSource | null {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');

    if (!existsSync(settingsPath)) {
      return null;
    }

    const content = readFileSync(settingsPath, 'utf-8');
    const settings: ClaudeSettings = JSON.parse(content);

    if (!settings.env) {
      return null;
    }

    return {
      token: settings.env.ANTHROPIC_AUTH_TOKEN,
      baseUrl: settings.env.ANTHROPIC_BASE_URL,
      apiTimeoutMs: settings.env.API_TIMEOUT_MS,
      disableNonessentialTraffic: settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC,
    };
  } catch (error) {
    console.warn('[Config] Failed to load Claude settings:', (error as Error).message);
    return null;
  }
}

/**
 * Load configuration from .env file
 */
function loadEnvFile(): ConfigSource {
  loadDotenv();

  return {
    port: process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : undefined,
    token: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    apiTimeoutMs: process.env.API_TIMEOUT_MS,
    disableNonessentialTraffic: process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC,
  };
}

/**
 * Merge configuration sources with priority: CLI > settings.json > .env > defaults
 */
function mergeConfigs(
  cliOptions: CLIOptions,
  claudeSettings: ConfigSource | null,
  envConfig: ConfigSource
): ServerConfig {
  const sources: string[] = [];

  // Priority 1: CLI arguments
  const port = cliOptions.port ?? claudeSettings?.port ?? envConfig.port ?? 9999;
  const token = cliOptions.token ?? claudeSettings?.token ?? envConfig.token;
  const baseUrl = cliOptions.baseUrl ?? claudeSettings?.baseUrl ?? envConfig.baseUrl;
  const apiTimeoutMs = claudeSettings?.apiTimeoutMs ?? envConfig.apiTimeoutMs;
  const disableNonessentialTraffic = claudeSettings?.disableNonessentialTraffic ?? envConfig.disableNonessentialTraffic;

  // Track which sources were used
  if (cliOptions.port || cliOptions.token || cliOptions.baseUrl) {
    sources.push('CLI arguments');
  }
  if (claudeSettings && (claudeSettings.token || claudeSettings.baseUrl)) {
    sources.push('~/.claude/settings.json');
  }
  if (envConfig.token || envConfig.baseUrl) {
    sources.push('.env file');
  }

  // Log config sources
  if (sources.length > 0) {
    console.log(`[Config] Using configuration from: ${sources.join(', ')}`);
  }

  if (!token) {
    throw new Error(
      'ANTHROPIC_AUTH_TOKEN is required. Please provide it via:\n' +
      '  1. CLI argument: --token sk-ant-xxx\n' +
      '  2. Claude settings: ~/.claude/settings.json (env.ANTHROPIC_AUTH_TOKEN)\n' +
      '  3. Environment file: packages/server/.env (ANTHROPIC_AUTH_TOKEN)'
    );
  }

  return {
    port,
    host: '127.0.0.1',
    anthropicAuthToken: token,
    anthropicBaseUrl: baseUrl,
    apiTimeoutMs: apiTimeoutMs ? parseInt(apiTimeoutMs, 10) : undefined,
    disableNonessentialTraffic: disableNonessentialTraffic === '1',
  };
}

/**
 * Load and validate server configuration
 * Priority: CLI args > settings.json > .env > defaults
 */
export function loadConfig(cliOptions: CLIOptions): ServerConfig {
  console.log('[Config] Loading configuration...');

  // Load from all sources
  const claudeSettings = loadClaudeSettings();
  const envConfig = loadEnvFile();

  // Merge with priority
  const config = mergeConfigs(cliOptions, claudeSettings, envConfig);

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port number: ${config.port}. Must be between 1 and 65535.`);
  }

  console.log(`[Config] Server will listen on ${config.host}:${config.port}`);
  if (config.anthropicBaseUrl) {
    console.log(`[Config] Using custom API endpoint: ${config.anthropicBaseUrl}`);
  }

  return config;
}
