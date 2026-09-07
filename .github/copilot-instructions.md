# Repository Guidance

## Project shape

- This is a TypeScript Node.js service using Express, Mongoose, CORS, and dotenv.
- The package uses CommonJS (`"type": "commonjs"`), while TypeScript is configured with `module: "nodenext"` and strict checking.
- Source code belongs under `src/`.
- Current folders include `config/`, `controllers/`, `repository/`, `middleware/`, `models/`, `routes/`, and `scripts/`.
- `src/config/database.ts` connects to MongoDB; `src/app.ts` assembles Express and `src/server.ts` starts the server.

## Commands

- Install dependencies with `npm install`.
- Run a type check with `npx tsc --noEmit`.
- Run the development server with `npm run dev`, or start it once with `npm start`.
- Run checks with `npm run typecheck` and `npm test`. MongoDB must be available for integration tests; test data is stored in temporary databases.

## Editing conventions

- Keep changes focused and preserve the existing TypeScript configuration unless the task requires changing it.
- Put database connection setup in `src/config/database.ts`, data models in `src/models/`, request middleware in `src/middleware/`, the generic repository in `src/repository/`, generic controllers in `src/controllers/`, and HTTP route wiring in `src/routes/`.
- Use environment variables for connection strings and other runtime configuration; do not commit secrets.
