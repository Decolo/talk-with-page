# Testing Setup Guide

## Overview

Vitest is configured across all packages in the monorepo with appropriate environments and settings for each package type.

## Running Tests

```bash
# Run all tests once
pnpm test

# Watch mode (re-run on file changes)
pnpm test:watch

# Interactive UI
pnpm test:ui

# Coverage report
pnpm test:coverage

# Run tests for specific package
pnpm --filter @claude-bridge/server test
pnpm --filter @claude-bridge/extension test
pnpm --filter @claude-bridge/shared test
```

## Package Configurations

### Server (`packages/server`)
- **Environment**: Node.js
- **Config**: `packages/server/vitest.config.ts`
- **Test files**: `src/**/*.{test,spec}.{js,ts}`
- **Use for**: WebSocket logic, Claude Agent integration, file system operations

### Extension (`packages/extension`)
- **Environment**: happy-dom (browser simulation)
- **Config**: `packages/extension/vitest.config.ts`
- **Setup file**: `src/test/setup.ts` (Chrome API mocks)
- **Test files**: `src/**/*.{test,spec}.{js,ts}`
- **Use for**: UI components, content scripts, Chrome API interactions

### Shared (`packages/shared`)
- **Environment**: Node.js
- **Config**: `packages/shared/vitest.config.ts`
- **Test files**: `src/**/*.{test,spec}.{js,ts}`
- **Use for**: Type validation, shared utilities

## TDD Workflow

1. **Write the test first** (Red phase)
   ```typescript
   // example.test.ts
   import { describe, it, expect } from 'vitest';
   import { myFunction } from './example.js';

   describe('myFunction', () => {
     it('should do something', () => {
       expect(myFunction('input')).toBe('expected output');
     });
   });
   ```

2. **Run tests** - they should fail
   ```bash
   pnpm test:watch
   ```

3. **Write minimal code** to make test pass (Green phase)
   ```typescript
   // example.ts
   export function myFunction(input: string): string {
     return 'expected output';
   }
   ```

4. **Refactor** while keeping tests green

## Chrome API Mocking

The extension package has Chrome API mocks in `packages/extension/src/test/setup.ts`:

```typescript
// Available mocked APIs:
chrome.runtime.sendMessage()
chrome.runtime.onMessage
chrome.storage.local
chrome.storage.sync
chrome.tabs.query()
chrome.tabs.sendMessage()
```

Extend the mock as needed for your tests.

## Example Test Patterns

### Testing async functions
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

### Mocking functions
```typescript
import { vi } from 'vitest';

const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');
mockFn.mockResolvedValue('async mocked value');
```

### Testing WebSocket messages
```typescript
it('should send correct message format', () => {
  const message: ClientMessage = {
    type: 'command',
    id: 'test-id',
    timestamp: Date.now(),
    payload: { instruction: 'test' },
  };

  expect(message.type).toBe('command');
});
```

## Coverage

Coverage reports are generated in `coverage/` directory for each package when running `pnpm test:coverage`.

## Tips

- Keep tests close to the code: `feature.ts` → `feature.test.ts`
- Use descriptive test names: `it('should validate email format')`
- Test behavior, not implementation
- Mock external dependencies (APIs, file system, etc.)
- Use `beforeEach` for test setup, `afterEach` for cleanup
- Run tests in watch mode during development

## Next Steps

1. Write tests before implementing features (TDD)
2. Aim for high coverage on critical paths
3. Consider adding E2E tests with Playwright later for full integration testing
