import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  DataVisNitroChat,
  type ChatFieldMap,
  type TableColumn,
  type ViewData,
} from '@mieweb/datavis';

// A plain (ungrouped, unpivoted) DataVis view: the chat display mode turns each
// row into a message instead of a table row. Building the ViewData literal by
// hand keeps the story a pure consumer of the public API — no engine wiring.
function plainView(rows: Record<string, unknown>[]): ViewData {
  return {
    isPlain: true,
    isGroup: false,
    isPivot: false,
    data: rows.map((row, index) => ({ _rowId: String(index), ...row })),
  };
}

// Renders a short "what this example shows" note above each story, read from the
// story's `exampleNote` parameter. Decorators are excluded from the Code tab, so
// this documentation never leaks into the generated <DataVisNitroChat /> source.
const withExampleNote: Decorator = (Story, context) => {
  const note = context.parameters.exampleNote as
    | { title: string; body: string }
    | undefined;
  return (
    <div className="space-y-3">
      {note && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{note.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{note.body}</p>
        </section>
      )}
      <Story />
    </div>
  );
};

// ── Care-team thread: columns named `sender` / `message` / `sentAt` / `kind`
//    are auto-detected, so no explicit fieldMap is needed. ────────────────────
const CARE_TEAM_COLUMNS: TableColumn[] = [
  { field: 'msgId', header: 'ID', width: 70 },
  { field: 'sender', header: 'Sender', width: 160 },
  { field: 'kind', header: 'Kind', width: 90 },
  { field: 'role', header: 'Role', width: 110 },
  { field: 'channel', header: 'Channel', width: 100 },
  { field: 'sentAt', header: 'Sent', width: 160, typeInfo: { type: 'date' } },
  { field: 'message', header: 'Message', width: 360 },
];

const CARE_TEAM_ROWS: Record<string, unknown>[] = [
  { msgId: 'm1', sender: 'Dr. Alice Nguyen', kind: 'human', role: 'Attending', channel: 'portal', sentAt: '2026-05-04T09:01:00', message: 'Morning team — reviewing **Mr. Patel’s** overnight labs now. Anything flagged?' },
  { msgId: 'm2', sender: 'Triage Bot', kind: 'agent', role: 'Triage', channel: 'auto', sentAt: '2026-05-04T09:01:20', message: 'Overnight summary:\n\n- Potassium `5.6 mmol/L` (high)\n- BP trending down: 118/74 → 104/66\n\nRecommend a repeat BMP.' },
  { msgId: 'm3', sender: 'Nurse Bob Reyes', kind: 'human', role: 'Charge RN', channel: 'portal', sentAt: '2026-05-04T09:03:10', message: 'Repeat BMP is already drawn, results pending. Patient is asymptomatic, resting comfortably.' },
  { msgId: 'm4', sender: 'Dr. Alice Nguyen', kind: 'human', role: 'Attending', channel: 'portal', sentAt: '2026-05-04T09:05:42', message: 'Good. Hold the morning ACE inhibitor until the repeat `K+` is back. Let’s recheck telemetry too.' },
  { msgId: 'm5', sender: 'Triage Bot', kind: 'agent', role: 'Triage', channel: 'auto', sentAt: '2026-05-04T09:06:05', message: 'Order drafted: **Hold lisinopril ×1 dose**. Telemetry review scheduled for 09:30. Confirm to send.' },
  { msgId: 'm6', sender: 'Nurse Bob Reyes', kind: 'human', role: 'Charge RN', channel: 'sms', sentAt: '2026-05-04T09:07:31', message: 'Confirmed and acknowledged. I’ll page you the moment the repeat panel resulting.' },
  { msgId: 'm7', sender: 'Dr. Alice Nguyen', kind: 'human', role: 'Attending', channel: 'portal', sentAt: '2026-05-04T09:08:00', message: 'Thanks both. Great catch on the potassium trend. 👍' },
];

// ── Support log: fields have non-standard names, so the roles are wired up
//    explicitly through `fieldMap`. ───────────────────────────────────────────
const SUPPORT_COLUMNS: TableColumn[] = [
  { field: 'ticketId', header: 'Ticket', width: 80 },
  { field: 'who', header: 'Who', width: 150 },
  { field: 'persona', header: 'Persona', width: 100 },
  { field: 'via', header: 'Via', width: 90 },
  { field: 'when', header: 'When', width: 160, typeInfo: { type: 'date' } },
  { field: 'body', header: 'Body', width: 360 },
];

const SUPPORT_FIELD_MAP: ChatFieldMap = {
  sender: 'who',
  message: 'body',
  time: 'when',
  kind: 'persona',
  channel: 'via',
  id: 'ticketId',
};

const SUPPORT_ROWS: Record<string, unknown>[] = [
  { ticketId: 'T-9001', who: 'Jordan Blake', persona: 'human', via: 'portal', when: '2026-06-12T14:20:00', body: 'The export button on the ledger grid does nothing when I click it. Running the latest build.' },
  { ticketId: 'T-9002', who: 'Helpdesk Assistant', persona: 'agent', via: 'auto', when: '2026-06-12T14:20:30', body: 'Thanks Jordan. I see `export-utils` throwing on empty selections. Try selecting a row first — a fix is queued for the next release.' },
  { ticketId: 'T-9003', who: 'Jordan Blake', persona: 'human', via: 'portal', when: '2026-06-12T14:23:12', body: 'That workaround does it. Exporting works after I select at least one row. Thank you!' },
  { ticketId: 'T-9004', who: 'Helpdesk Assistant', persona: 'agent', via: 'auto', when: '2026-06-12T14:23:40', body: 'Glad it helped. I’ve linked this thread to issue **#520** so you’ll get an update when the empty-selection guard ships.' },
];

const meta: Meta<typeof DataVisNitroChat> = {
  id: 'grids-datavis-chat',
  title: 'Components/Grids/DataVis Chat',
  component: DataVisNitroChat,
  decorators: [withExampleNote],
  parameters: {
    layout: 'padded',
    // Uses the SuperChat surface, whose internal DOM shares the same a11y
    // caveats as the other DataVis stories; disable automated checks here.
    a11y: { disable: true },
    docs: {
      description: {
        component: `### What it's for

A **display mode** for DataVis that renders *plain* (ungrouped, unpivoted) view rows as messages in the \`@mieweb/ui\` SuperChat surface instead of as rows in a table. Drop \`<DataVisNitroChat>\` into a \`<DataGrid>\` in place of \`<TableRenderer>\`, or use it standalone with any plain \`ViewData\`.

Special field meanings are resolved from the column names or overridden with \`fieldMap\`:

- \`sender\` → the bubble author's display name (one participant per distinct sender)
- \`message\` → the message body, rendered as **Markdown**
- \`time\` → the timestamp used to order the thread
- \`kind\` → classifies the speaker as \`human\`, \`agent\`, or \`system\`
- \`role\` / \`avatar\` / \`channel\` / \`id\` → participant sub-label, avatar, delivery channel, and message id

### Use it when

- The rows *are* a conversation (care-team messages, a support thread, an audit log of who-said-what) and reading them as chat bubbles is clearer than a grid.

### Don't use it when

- The data is grouped or pivoted — chat mode only renders plain rows and shows a placeholder otherwise. Clear grouping/pivoting first, or use \`TableRenderer\`.

### Example

\`\`\`tsx
import { DataVisNitroChat } from '@mieweb/datavis';

<DataVisNitroChat
  viewData={viewState.data}
  columns={columns}
  fieldMap={{ sender: 'who', message: 'body', time: 'when' }}
  currentSender="Dr. Alice Nguyen"
/>
\`\`\``,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof DataVisNitroChat>;

/**
 * Columns named `sender` / `message` / `sentAt` / `kind` are auto-detected, so
 * the conversation renders with no explicit `fieldMap`. `currentSender` aligns
 * the attending physician's bubbles to the right.
 */
export const CareTeamThread: Story = {
  parameters: {
    exampleNote: {
      title: 'Auto-detected fields',
      body: 'The source columns are named sender, message, sentAt, kind, role, and channel, so DataVisNitroChat maps them to chat roles automatically — no fieldMap needed. Each row becomes a message, Markdown is rendered in the bubble, and currentSender="Dr. Alice Nguyen" right-aligns the attending physician.',
    },
  },
  args: {
    viewData: plainView(CARE_TEAM_ROWS),
    columns: CARE_TEAM_COLUMNS,
    title: 'Care Team Thread',
    currentSender: 'Dr. Alice Nguyen',
    className: 'h-[32rem]',
  },
};

/**
 * The same display mode over data whose fields are named `who` / `body` /
 * `when` / `persona`. Because those names aren't auto-detected, each chat role
 * is wired up explicitly through `fieldMap`.
 */
export const CustomFieldMapping: Story = {
  parameters: {
    exampleNote: {
      title: 'Explicit fieldMap',
      body: 'Here the columns are named who, body, when, persona, via, and ticketId — none of which are auto-detected. The fieldMap prop wires each one to its chat role (who→sender, body→message, when→time, persona→kind, via→channel, ticketId→id), proving the same data can drive the chat view under any schema.',
    },
  },
  args: {
    viewData: plainView(SUPPORT_ROWS),
    columns: SUPPORT_COLUMNS,
    fieldMap: SUPPORT_FIELD_MAP,
    title: 'Support Thread',
    currentSender: 'Jordan Blake',
    className: 'h-[28rem]',
  },
};

/**
 * `order="desc"` renders newest-first, feed-style, anchored to the top.
 */
export const FeedOrder: Story = {
  parameters: {
    exampleNote: {
      title: 'Feed ordering (order="desc")',
      body: 'Same conversation as the first example, but order="desc" renders it newest-first and anchored to the top, like a social feed instead of a bottom-anchored messenger thread.',
    },
  },
  args: {
    viewData: plainView(CARE_TEAM_ROWS),
    columns: CARE_TEAM_COLUMNS,
    title: 'Care Team Thread (newest first)',
    currentSender: 'Dr. Alice Nguyen',
    order: 'desc',
    className: 'h-[32rem]',
  },
};

/**
 * Grouped or pivoted data isn't a conversation; chat mode renders an
 * explanatory placeholder instead of messages.
 */
export const NonPlaceholderData: Story = {
  name: 'Grouped Data (placeholder)',
  parameters: {
    exampleNote: {
      title: 'Non-plain data falls back to a placeholder',
      body: 'Chat mode only renders plain rows. When the view is grouped or pivoted (isGroup/isPivot), DataVisNitroChat shows this explanatory placeholder instead of trying to render a conversation.',
    },
  },
  args: {
    viewData: {
      isPlain: false,
      isGroup: true,
      isPivot: false,
      data: [],
    },
    columns: CARE_TEAM_COLUMNS,
  },
};
