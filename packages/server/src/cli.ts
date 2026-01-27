import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CLIOptions {
  port?: number;
  token?: string;
  baseUrl?: string;
}

export function parseCliArgs(): CLIOptions {
  // Read version from package.json
  const packageJsonPath = join(__dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const program = new Command();

  program
    .name('talk-with-page')
    .description('WebSocket server that connects Chrome extensions to Claude AI with file system access')
    .version(packageJson.version)
    .option('-p, --port <number>', 'WebSocket port', (value) => parseInt(value, 10))
    .option('-t, --token <string>', 'Anthropic API token')
    .option('-b, --base-url <string>', 'Anthropic API base URL')
    .parse(process.argv);

  const options = program.opts();

  return {
    port: options.port,
    token: options.token,
    baseUrl: options.baseUrl,
  };
}
