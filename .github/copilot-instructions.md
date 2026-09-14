# Repository Guidance

## Project shape

- This is an npm workspace project with a `server/` backend and a `client/` frontend.
- The backend uses TypeScript, Express, Mongoose, CORS and dotenv. Its package is CommonJS with strict NodeNext TypeScript settings.
- Backend source belongs under `server/src/`, with tests under `server/tests/`.
- `server/src/config/database.ts` loads `server/.env`; `server/src/app.ts` assembles Express and `server/src/server.ts` starts it.
- The React/Vite frontend belongs under `client/src/`. Its design system is in `client/src/design-system/`, imported with `@ds/*`.
- Shared documentation stays in `docs/` and the root README. The lecturer's final PDF takes precedence over older planning documents.

## Commands from the repository root

- Install both workspaces with `npm ci` (or `npm install` when updating dependencies).
- Run the backend with `npm run dev:server`, or `npm start` without watch mode.
- Run the frontend in a second terminal with `npm run dev:client`.
- Run `npm run typecheck` for both workspaces, `npm run build` for the frontend, and `npm test` for backend tests.
- MongoDB must be available for integration tests; test data is stored in temporary databases.

## Editing conventions

- Keep changes focused and preserve the existing TypeScript configuration unless the task requires changing it.
- Backend folders under `server/src/` include `config/`, `models/`, `controllers/`, `repository/`, `middleware/`, `routes/` and `scripts/`.
- Keep CRUD shared in the generic repository, controller and route factory.
- Implement only Group B models; other groups' entities are references only.
- Use environment variables for connection strings and configuration; do not commit secrets.