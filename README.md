# Sandbox Workspace

This folder is a `pnpm` monorepo used for sandboxed artifacts and supporting packages. It provides a full-stack Lightning 402 payment demo environment.

## Prerequisites

- Node.js 24.x
- pnpm 10+
- A bash-like shell on Windows (Git Bash/WSL) is recommended

**Notes:**
- The workspace enforces `pnpm` via a preinstall check.
- Some scripts (for example the API server `dev` script) use shell syntax that works best in bash.
- This project was originally developed in Replit but can run entirely locally.

## Setup

From this folder:

```bash
cd sandbox
pnpm install
```

## Build Process

Run from `sandbox/`:

```bash
pnpm run typecheck
pnpm run build
```

- `typecheck`: validates shared libs and selected workspace packages.
- `build`: runs `typecheck` first, then runs package `build` scripts recursively.

## Architecture

The sandbox provides a full-stack dev environment for mpp-theater, a Lightning 402 payment demo:

- **API server** (`@workspace/api-server`): Express + Drizzle backend serving `/api/theater/*` endpoints for the demo content.
- **mpp-theater** (`@workspace/mpp-theater`): React/Vite UI that fetches from the API and integrates Lightning payment flows.
- **mockup-sandbox** (`@workspace/mockup-sandbox`): Standalone UI component showcase (no backend dependency).
- **Shared libs**: `@workspace/api-spec` (OpenAPI contract), `@workspace/api-zod` (validation schemas), `@workspace/db` (database schema).

Project-level standardized commands:

- API server (`@workspace/api-server`): `dev`, `typecheck`, `build`, `preview`.
- Mockup sandbox (`@workspace/mockup-sandbox`): `dev`, `typecheck`, `build`, `preview`.
- MPP theater (`@workspace/mpp-theater`): `dev`, `typecheck`, `build`, `preview`.
- Shared libs (`@workspace/api-zod`, `@workspace/db`): `typecheck`, `build`.

## Running the Applications Locally

### Start the API server first (proxies to upstream Replit deployment)

```bash
pnpm --filter @workspace/api-server run dev
```

The API server will run on `http://localhost:5000`.

### Mockup sandbox (standalone UI, no backend needed)

In a new terminal:

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

Vite will print the local URL (typically `http://localhost:5173`).

### MPP Theater (full payment demo, requires API server)

In a new terminal (after API server is running):

```bash
pnpm --filter @workspace/mpp-theater run dev
```

Vite will print the local URL. The app includes two experiments:

- `/vod` (Video On-Demand) - Requires the API server running
- `/sdk-demo` (SDK Payment Playground)

## Helpful package-level commands

```bash
pnpm --filter @workspace/api-spec run codegen
```

- `codegen`: regenerate API hooks and schemas from OpenAPI

## Troubleshooting

- If install fails with "Use pnpm instead", run with `pnpm` only (not npm/yarn).
- If API `dev` fails in PowerShell/CMD, run it in Git Bash/WSL or run `build` then `start` separately:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```
