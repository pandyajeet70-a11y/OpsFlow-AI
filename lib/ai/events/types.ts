export interface WorkflowEventPayloads {
  "customer.handoff.created": {
    handoffId: string;
    organizationId?: string;
  };
}

export type WorkflowEventName = keyof WorkflowEventPayloads;

export interface WorkflowEvent<Name extends WorkflowEventName = WorkflowEventName> {
  eventId: string;
  name: Name;
  payload: WorkflowEventPayloads[Name];
  createdAt: string;
}

export type WorkflowEventHandler<Name extends WorkflowEventName> = (
  event: WorkflowEvent<Name>
) => Promise<void>;
