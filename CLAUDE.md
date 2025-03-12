# Assistive-LLM Project Guidelines

## Build & Test Commands
- Build: `npm run build` (TypeScript compilation)
- Start: `npm run start` (run compiled JS)
- Dev mode: `npm run dev` (ts-node-dev with auto-reload)
- Run all tests: `npm test`
- Run single test: `npm test -- -t "test name pattern"`
- Debug: `NODE_ENV=development npm run dev`

## Code Style Guidelines
- **TypeScript**: Strict mode enabled, target ES2020
- **Imports**: Group by external packages first, then internal modules
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Error Handling**: Use try/catch with appropriate logging via Winston logger
- **Documentation**: JSDoc comments for public methods and interfaces
- **Architecture**: Follow service/controller pattern with dependency injection
- **File Organization**: One class per file, interface definitions in separate files
- **Formatting**: 2-space indentation, single quotes, semicolons required
- **Async**: Use async/await patterns (not raw Promises) with proper error handling
- **Types**: Always define explicit return types and parameter types

Assistive-LLM provides an interface for LLM streaming using T.140 protocol for assistive devices.