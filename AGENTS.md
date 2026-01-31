# AGENTS.md - DBC Insight

This is a VS Code extension for DBC (CAN Database) file language support, forked from the original DBC Language Syntax extension. It provides syntax highlighting, error diagnostics, an interactive preview panel with bit matrix visualization for DBC files.

**Repository:** https://github.com/n0rbury/DBC-Insight  
**Publisher:** n0rbury  
**Current Version:** 3.0.0

## Architecture

This is a monorepo with three main components:
- **dbcLib/** (`/dbcLib`): Core TypeScript library with DBC data models (Database, Message, Signal, etc.). Shared by client and server.
- **server/** (`/server`): Language server using LSP for parsing and diagnostics. Uses `jison` for parsing.
- **client/** (`/client`): VS Code extension client. Includes a React-based preview panel built with `react-scripts`.

## Build Commands

The project uses `make` as the primary build tool.

### Full Build
```bash
# Build everything (syntaxes, dbcLib, client, server)
make

# Clean build artifacts
make clean

# Package as VSIX for distribution
make package
```

### Component Builds
If you need to build individual components manually (e.g., for debugging):

```bash
# Generate syntax files (TextMate grammar & snippets)
make syntaxes

# Build dbcLib (Core Library)
# Note: No npm script for build; uses tsc + webpack directly
cd dbcLib && tsc && webpack --mode production

# Build Server (Language Server)
cd server && npm run build

# Build Client (Extension + React Panel)
# Uses a custom script to disable code splitting for the VS Code webview
cd client && npm run build
```

## Testing & Linting

- **Testing**: There is currently **no test framework** configured.
  - *Future Work*: Add `jest` to `package.json` scripts.
- **Linting**:
  - **Client**: ESLint is run automatically by `react-scripts` during the build process.
  - **Server/dbcLib**: TypeScript compiler (`tsc`) checks for type errors during build.
  - *Note*: Ensure `tsc` passes without errors before committing.

## Code Style Guidelines

### License Headers
**REQUIRED**: Every source file must include the GPL v2 license header at the top:
```typescript
/**
 * Copyright (C) [YEAR] Landon Harris
 * This program is free software; you can redistribute it and/or 
 * modify it under the terms of the GNU General Public License as 
 * published by the Free Software Foundation; version 2.
 * ...
 */
```

### TypeScript Conventions

**Imports**:
- Use **single quotes** for module paths.
- Group imports: 
  1. External libraries (e.g., `vscode-languageserver`)
  2. Internal modules (e.g., `../dbc/Database`)
- Import specific types/classes rather than entire modules (e.g., `import { Message } from ...`).

```typescript
import { Parser } from 'jison';
import { Connection, Diagnostic } from 'vscode-languageserver/node';
import { Database } from 'dbclib';
```

**Naming**:
- **Classes/Interfaces/Types**: `PascalCase` (e.g., `Database`, `Signal`, `BitTiming`).
- **Variables/Functions**: `camelCase` (e.g., `parseResult`, `sendDiagnostics`).
- **Private Properties**: `camelCase` (no underscore prefix).
- **Static Readonly**: `UPPER_SNAKE_CASE` (e.g., `static readonly MAX_SIGNALS = 100`).

**Types**:
- **Explicitly declare types** for public properties and method returns.
- Use `interface` for data structures (e.g., `interface Options { ... }`).
- Use `Map<string, T>` for dictionary-like collections instead of objects.
- Enable `strict` mode in `tsconfig.json`.

**Formatting**:
- **Indentation**: 4 spaces.
- **Semicolons**: Required.
- **Braces**: K&R style (opening brace on the same line).
- **Line Length**: Soft limit around 100 characters.

**Classes**:
- Declare `public` fields at the top.
- Initialize complex structures (like `Map`) in the constructor.
- Add a `clsType` string property for runtime type checking/discrimination.
- Explicitly add access modifiers (`public`, `private`, `protected`).

```typescript
export class Message {
    public id: number;
    public name: string;
    public signals: Map<string, Signal>;
    public clsType: string;
    
    public constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.signals = new Map();
        this.clsType = "message";
    }
}
```

### Error Handling
- Use `try-catch` blocks around parser operations or file I/O.
- Log errors using `console.error()` (or LSP connection console for server).
- Fail gracefully: provide fallback behavior or clear error messages to the user.

### Comments
- Use `//` for inline comments to explain *why* (not *what*).
- Use JSDoc (`/** ... */`) for public API methods and complex classes.
- Documentation for grammar rules in `.jison` files is encouraged.

## Development Workflow

1.  **Install**: `npm install` (Root script runs postinstall for all sub-packages).
2.  **Edit**: Modify TS files in `client/`, `server/`, or `dbcLib/`.
3.  **Build**: Run `make` in the root.
4.  **Debug**: Open the project in VS Code and press **F5** (Launch Extension).

## Key Files & Locations

- **Grammar**:
  - `server/dbc.jison`: Parser grammar.
  - `server/dbc.lex`: Lexer rules.
  - `syntaxSrc/dbcLang.yml`: TextMate grammar source (compiles to JSON).
- **Core Logic**:
  - `dbcLib/src/dbc/`: Data models (Message.ts, Signal.ts, etc.).
- **Client UI**:
  - `client/src/`: React source for the webview panel.
  - `client/ext-src/`: Extension host process code.
