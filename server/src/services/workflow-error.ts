class WorkflowError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "WorkflowError"; }
}
export = WorkflowError;
