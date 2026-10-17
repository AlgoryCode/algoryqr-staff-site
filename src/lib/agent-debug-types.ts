export type AgentDebugPayload = {
  hypothesisId?: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
};
