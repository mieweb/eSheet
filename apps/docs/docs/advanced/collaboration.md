---
sidebar_position: 4
---

# Collaboration

The React Renderer can display host-supplied collaboration information next to
individual fields. This includes:

- colored presence indicators for people working on a field
- pending change proposals and their authors
- conflict warnings
- Accept, Accept anyway, and Reject actions

Collaboration decorations are optional. Existing forms behave normally when the
`collab` prop is not provided.

:::important[The host provides collaboration]

eSheet does not connect users, synchronize browsers, store proposals, or detect
conflicts. Your application must provide that behavior through a service such as
WebSockets, Yjs, or its own backend. The Renderer only displays the state it
receives and reports proposal actions back to the host.

:::

## When to use it

Collaboration decorations are useful when multiple people review or complete the
same form. They are not specific to healthcare or any particular schema format.
For example:

- a clinician reviewing a patient record
- HR reviewing an employee onboarding form
- an agent reviewing an insurance application
- a supervisor approving an inspection report
- an editor suggesting corrections to a questionnaire response

This is a **Renderer feature**. It is not a Builder feature, although a host can
use the same form definition in both products.

## Basic usage

Pass a `CollabDecorations` object to `EsheetRenderer`:

```tsx
import { EsheetRenderer } from '@esheet/renderer';
import type { CollabDecorations } from '@esheet/core';

const collab: CollabDecorations = {
  presenceByField: {
    patientName: [{ name: 'Alice', color: '#ef4444' }],
  },
  proposalsByField: {
    patientName: [
      {
        id: 'proposal-123',
        proposedValue: 'John Smith',
        actor: 'Bob',
        status: 'proposed',
      },
    ],
  },
  canResolve: currentUser.canApprove,
  onProposalAction: (fieldId, proposalId, action) => {
    void resolveProposal(fieldId, proposalId, action);
  },
  formatValue: (value) => String(value ?? ''),
};

export function SharedForm() {
  return <EsheetRenderer formDataInput={form} collab={collab} />;
}
```

The keys in `presenceByField` and `proposalsByField` must match field IDs in the
form definition. In this example, `patientName` is the field ID, not the question
text displayed to the user.

## API reference

### `CollabDecorations`

| Property           | Type                              | Description                                                          |
| ------------------ | --------------------------------- | -------------------------------------------------------------------- |
| `presenceByField`  | `Record<string, FieldPresence[]>` | Collaborators currently associated with each field ID                |
| `proposalsByField` | `Record<string, FieldProposal[]>` | Proposals to display beneath each field ID                           |
| `canResolve`       | `boolean`                         | Shows proposal action buttons when `true` and a callback is provided |
| `onProposalAction` | `function`                        | Called when the user accepts or rejects a proposal                   |
| `formatValue`      | `(value: unknown) => string`      | Converts proposed and conflict values into display text              |

Every property is optional.

### `FieldPresence`

```ts
interface FieldPresence {
  name: string;
  color: string;
}
```

`name` is used for the presence dot's accessible label and tooltip. `color` is
used as the dot's background color.

The host decides what “present” means. It could mean that a user is focused on
the input, viewing its section, or actively editing it.

### `FieldProposal`

```ts
interface FieldProposal {
  id: string;
  proposedValue: unknown;
  baseValue?: unknown;
  actor: string;
  status: string;
  conflict?: {
    currentValue: unknown;
  };
}
```

| Property        | Description                                                                           |
| --------------- | ------------------------------------------------------------------------------------- |
| `id`            | Host-defined identifier for the proposal                                              |
| `proposedValue` | New value suggested by the collaborator                                               |
| `baseValue`     | Optional value on which the proposal was based; retained for host use                 |
| `actor`         | Name displayed beside the proposed value                                              |
| `status`        | Host-defined status; the Renderer does not filter or interpret it                     |
| `conflict`      | When present, displays the supplied current value and changes Accept to Accept anyway |

Only pass proposals that should currently be visible. The Renderer does not hide
a proposal based on its `status` value.

## Handling proposal actions

`onProposalAction` tells the host that a reviewer selected one of the proposal
buttons. The person using the form does not enter IDs or call this function.
The Renderer obtains the IDs from the field and proposal data supplied by the
host, then invokes the callback automatically.

The complete callback type is:

```ts
onProposalAction?: (
  fieldId: string,
  proposalId: string,
  action: 'accept' | 'accept-anyway' | 'reject'
) => void;
```

The callback is used only when both `canResolve` is `true` and
`onProposalAction` is provided. Otherwise, the Renderer displays proposals
without action buttons.

### Callback arguments

| Argument     | Source                                | Meaning                                           |
| ------------ | ------------------------------------- | ------------------------------------------------- |
| `fieldId`    | The key in `proposalsByField`         | Identifies the form field containing the proposal |
| `proposalId` | The matching proposal's `id` property | Identifies which proposal the reviewer selected   |
| `action`     | The button selected by the reviewer   | Contains `accept`, `accept-anyway`, or `reject`   |

For this collaboration state:

```tsx
const collab = {
  proposalsByField: {
    patientName: [
      {
        id: 'proposal-123',
        proposedValue: 'John Smith',
        actor: 'Alice',
        status: 'proposed',
      },
    ],
  },
  // ...
};
```

clicking **Accept** causes the Renderer to call:

```ts
onProposalAction('patientName', 'proposal-123', 'accept');
```

Use stable field and proposal IDs. A proposal ID may be scoped to its field
because both IDs are supplied to the callback, although globally unique
proposal IDs are usually easier to manage in a backend.

### Action values

| Action          | Visible button | When it is emitted                           |
| --------------- | -------------- | -------------------------------------------- |
| `accept`        | Accept         | A normal proposal is accepted                |
| `accept-anyway` | Accept anyway  | A proposal containing `conflict` is accepted |
| `reject`        | Reject         | A normal or conflicting proposal is rejected |

The action strings are lowercase API values. Button labels shown to the user
are capitalized.

### There is no return result

The callback is a notification. The Renderer does not change the response,
remove the proposal, or save anything automatically. Its return type is `void`.
If the handler starts an asynchronous request, the Renderer does not wait for or
inspect its result.

For asynchronous processing, start the operation deliberately and handle errors
inside the host:

```tsx
import type { CollabDecorations } from '@esheet/core';

const handleProposalAction: NonNullable<
  CollabDecorations['onProposalAction']
> = (fieldId, proposalId, action) => {
  void resolveProposal(fieldId, proposalId, action).catch((error) => {
    showProposalError(error);
  });
};

<EsheetRenderer
  formDataInput={form}
  collab={{
    proposalsByField,
    canResolve: true,
    onProposalAction: handleProposalAction,
  }}
/>;
```

### Processing the decision in the host

A typical host handler performs four operations:

1. Find the proposal using `fieldId` and `proposalId`.
2. Send the decision to the backend or shared collaboration document.
3. Apply the backend's updated canonical response.
4. Remove the resolved proposal from `proposalsByField` and pass the new state
   to the Renderer.

```tsx
async function resolveProposal(
  fieldId: string,
  proposalId: string,
  action: 'accept' | 'accept-anyway' | 'reject'
) {
  const proposal = proposalsByField[fieldId]?.find(
    (item) => item.id === proposalId
  );

  if (!proposal) {
    throw new Error(`Unknown proposal: ${fieldId}/${proposalId}`);
  }

  const result = await collaborationApi.resolveProposal({
    fieldId,
    proposalId,
    action,
  });

  // Update host-owned state with the authoritative result. React then passes
  // the updated values and proposal map back to EsheetRenderer.
  setResponses(result.responses);
  setProposalsByField(result.proposalsByField);
}
```

Do not remove a proposal before the request succeeds unless the host implements
an intentional optimistic-update and rollback strategy. While a request is in
progress, the host can temporarily set `canResolve` to `false` to prevent
duplicate actions.

### Updating the Renderer locally

If the host wants an accepted proposal to update the local Renderer immediately,
it can update its response state or use the advanced form store API:

```tsx
import { useRef } from 'react';
import type { EsheetRendererHandle } from '@esheet/renderer';

const rendererRef = useRef<EsheetRendererHandle>(null);

rendererRef.current
  ?.getFormStore()
  .getState()
  .setResponse(fieldId, {
    answer: String(proposal.proposedValue),
  });
```

The response shape depends on the field type. The example above is appropriate
for text fields; selection, matrix, signature, and other fields use different
response properties. See [Collecting & Pre-filling Responses](../renderer/responses.md).

Updating the local form store does not persist or synchronize the change. A live
application should still send the decision to its collaboration service.

### Backend validation

Treat the callback arguments as untrusted client input. The backend should
verify that:

- the current user may resolve proposals
- the field and proposal exist and are related
- the proposal is still pending
- `accept-anyway` is allowed for the current conflict
- a repeated request cannot apply the same proposal twice

`canResolve` only controls the Renderer interface; it is not authorization.

## Conflicts

The Renderer does not compare proposal values with current responses. The host
must detect conflicts and provide them explicitly:

```tsx
{
  id: 'proposal-123',
  proposedValue: 'John Smith',
  baseValue: 'Jon Smith',
  actor: 'Bob',
  status: 'proposed',
  conflict: {
    currentValue: 'Jonathan Smith',
  },
}
```

When `conflict` is present, the Renderer:

- displays “Changed since proposed” with the formatted current value
- changes the Accept button to **Accept anyway**
- emits the `accept-anyway` action if that button is selected

The host remains responsible for deciding whether the proposal may be applied.

## Formatting values

The default formatter uses `String(value)`. Supply `formatValue` for arrays,
dates, objects, coded values, or other application-specific data:

```tsx
formatValue: (value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value ?? '');
};
```

## Permissions and security

`canResolve` controls whether the Renderer displays action buttons. It is not a
security boundary. A production backend must independently verify that the
current user is authorized to accept or reject a proposal.

Do not rely on hidden buttons to protect proposal actions.

## Accessibility

Presence dots expose collaborator names through an accessible label and tooltip.
Proposal decorations are linked to their corresponding input through
`aria-describedby`. Action buttons include field-specific accessible names such
as “Accept proposal for Patient name.”

## Making it live

A typical live integration follows this flow:

1. A collaboration service tracks connected users, focused fields, proposals,
   and canonical form values.
2. The host converts that state into `presenceByField` and
   `proposalsByField`.
3. The host passes the resulting `collab` object to `EsheetRenderer`.
4. A reviewer selects Accept, Accept anyway, or Reject.
5. `onProposalAction` sends the decision to the collaboration service.
6. The service updates its shared state and broadcasts it to connected clients.
7. React receives the new state and re-renders `EsheetRenderer`.

The eSheet demo includes a
[Collaboration Playground](https://esheet.os.mieweb.org/demo/collab) that
performs this flow with local React state. It demonstrates the integration API,
but it does not connect multiple browsers or users.

## Current limitations

- No WebSocket, Yjs, CRDT, or backend integration is included.
- Presence focus is supplied by the host rather than detected by the Renderer.
- Conflicts are supplied by the host rather than calculated by the Renderer.
- Proposal status is not interpreted or filtered.
- The API does not expose another collaborator's complete form or private draft.
- Accepting or rejecting a proposal does not mutate responses automatically.
