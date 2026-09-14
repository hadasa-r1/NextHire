# Group C authentication adapter

`AuthProvider` accepts an optional `loadSession(signal)` function. Group C's integration must return either `null` for an unauthenticated user, or the `AuthSession` adapter shape from `permissions.ts`:

- `user._id`: the authenticated user's identifier.
- `user.name`: optional display name.
- `permissions`: entries containing `resource` and `actions`, as described in the lecturer's document.

This is an integration contract, not a new database entity. The loader must obtain the data from the agreed authenticated source; no endpoint or credentials transport is assumed here. Adapt Group C's response and validate it at that boundary. Forward `AbortSignal` to the request. Supply a stable loader function to avoid reloading on every render.

In `main.tsx`, pass that function as `loadSession` to the existing `AuthProvider`. It will handle pending, error, anonymous and authenticated states. Without a loader, status is `unavailable` and protected children are not mounted. Tests supply session fixtures only within the test environment; there are no production default permissions or browser-storage permission overrides.

Permissions are exact: Candidate READ allows list/detail, Candidate WRITE allows creation, and editing also needs READ to load the existing record. Application READ controls the submissions section independently. WRITE never implicitly grants READ. Session expiry or permission changes must also be propagated by the Group C integration; the provider exposes `reload` for refreshing the session.

Server-side authentication and authorization are still required on every corresponding API route. The existing backend has not been changed into an authentication server by this frontend work. Before enabling the integration for real users, Group C must provide API enforcement and the agreed credential/CSRF handling for its authentication mechanism.