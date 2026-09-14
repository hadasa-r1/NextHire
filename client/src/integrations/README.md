# Group A reference-data adapter

The application screens consume `ReferenceDataProvider` from `ReferenceDataProvider.tsx`. Pass its `loadOptions` prop in `src/main.tsx` after the API contract with Group A is agreed.

The loader receives `(resource, signal)`, where resource is `Position` or `Company`, and returns a list of `{ id, label }` view options. These options are client display data, not new database entities. Adapt the actual `_id` and approved title/name from Group A's authenticated API, and propagate AbortSignal to the request. IDs must be MongoDB ObjectIds. The integration owns response validation and credential transport.

The loader is called only with the corresponding READ permission from Group C. Candidate choices use the existing `/api/candidates` endpoint with Candidate READ. To edit an Application, both Application READ and WRITE are needed; creation requires WRITE. No new permissions or models are granted or implemented here.

No API URL is guessed. Without a loader, the screens show that reference data is unavailable. Errors can be retried. A new authenticated session clears cached reference options; data from a previous session is not reused.

Creation and editing share the same form. Optional references remain optional as in the approved schema. A preselected candidate or position from a URL must exist among the available options before a new reference can be saved. Existing references absent from the latest options can be preserved, but are explicitly shown as identifiers, not invented names.

The Application backend remains the generic CRUD API. No process-decision, evaluation-calculation, or tender-ranking rules have been added during this phase.