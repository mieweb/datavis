import { useContext, useEffect, useMemo } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  DataGrid,
  DataVisNitroContext,
  DataVisNitroSource,
  useView,
  type TableColumn,
  type ViewData,
  type ViewInstance,
} from '@mieweb/datavis';
import { DataVisNitroChat, type ChatFieldMap } from '@mieweb/datavis/chat';

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
        <section className="border-border bg-card rounded-lg border p-4">
          <h3 className="text-foreground text-sm font-semibold">
            {note.title}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">{note.body}</p>
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
  {
    msgId: 'm1',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    channel: 'portal',
    sentAt: '2026-05-04T09:01:00',
    message:
      'Morning team — reviewing **Mr. Patel’s** overnight labs now. Anything flagged?',
  },
  {
    msgId: 'm2',
    sender: 'Triage Bot',
    kind: 'agent',
    role: 'Triage',
    channel: 'auto',
    sentAt: '2026-05-04T09:01:20',
    message:
      'Overnight summary:\n\n- Potassium `5.6 mmol/L` (high)\n- BP trending down: 118/74 → 104/66\n\nRecommend a repeat BMP.',
  },
  {
    msgId: 'm3',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    channel: 'portal',
    sentAt: '2026-05-04T09:03:10',
    message:
      'Repeat BMP is already drawn, results pending. Patient is asymptomatic, resting comfortably.',
  },
  {
    msgId: 'm4',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    channel: 'portal',
    sentAt: '2026-05-04T09:05:42',
    message:
      'Good. Hold the morning ACE inhibitor until the repeat `K+` is back. Let’s recheck telemetry too.',
  },
  {
    msgId: 'm5',
    sender: 'Triage Bot',
    kind: 'agent',
    role: 'Triage',
    channel: 'auto',
    sentAt: '2026-05-04T09:06:05',
    message:
      'Order drafted: **Hold lisinopril ×1 dose**. Telemetry review scheduled for 09:30. Confirm to send.',
  },
  {
    msgId: 'm6',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    channel: 'sms',
    sentAt: '2026-05-04T09:07:31',
    message:
      'Confirmed and acknowledged. I’ll page you the moment the repeat panel resulting.',
  },
  {
    msgId: 'm7',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    channel: 'portal',
    sentAt: '2026-05-04T09:08:00',
    message: 'Thanks both. Great catch on the potassium trend. 👍',
  },
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
  {
    ticketId: 'T-9001',
    who: 'Jordan Blake',
    persona: 'human',
    via: 'portal',
    when: '2026-06-12T14:20:00',
    body: 'The export button on the ledger grid does nothing when I click it. Running the latest build.',
  },
  {
    ticketId: 'T-9002',
    who: 'Helpdesk Assistant',
    persona: 'agent',
    via: 'auto',
    when: '2026-06-12T14:20:30',
    body: 'Thanks Jordan. I see `export-utils` throwing on empty selections. Try selecting a row first — a fix is queued for the next release.',
  },
  {
    ticketId: 'T-9003',
    who: 'Jordan Blake',
    persona: 'human',
    via: 'portal',
    when: '2026-06-12T14:23:12',
    body: 'That workaround does it. Exporting works after I select at least one row. Thank you!',
  },
  {
    ticketId: 'T-9004',
    who: 'Helpdesk Assistant',
    persona: 'agent',
    via: 'auto',
    when: '2026-06-12T14:23:40',
    body: 'Glad it helped. I’ve linked this thread to issue **#520** so you’ll get an update when the empty-selection guard ships.',
  },
];

const meta: Meta<typeof DataVisNitroChat> = {
  id: 'grids-datavis-chat',
  title: 'Components/Grids/DataVis Chat',
  component: DataVisNitroChat,
  tags: ['autodocs', 'scope:general-purpose', 'maturity:experimental'],
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
- Users need to compose, reply to, or edit messages — this adapter is **read-only** (it always renders SuperChat with \`readOnly\` and exposes no send/edit callbacks). Use [SuperChat](?path=/docs/superchat-superchat-panel--docs) directly with your own \`onMessageSent\` / \`onMessageEdited\` handlers.
- Users need to sort, filter, compare columns, or export the rows — keep the [DataVis NITRO grid](?path=/docs/grids-datavis-nitro--docs). Chat mode shows only the sender, message, and time; every other column is dropped from view.

### Related components

- [DataVis NITRO](?path=/docs/grids-datavis-nitro--docs) — the default grid over the same view. Offer both and let users toggle: the grid for analysis, chat mode for reading the thread in order.
- [SuperChat](?path=/docs/superchat-superchat-panel--docs) — the conversation surface this adapter renders into. Choose it when the host owns a live conversation model rather than a DataVis view.

### Example

Chat mode is an opt-in entry, \`@mieweb/datavis/chat\`, so grid-only apps never load SuperChat. It renders Markdown through SuperChat's default renderer, so install the \`react-markdown\`, \`remark-gfm\` and \`rehype-sanitize\` peers alongside \`@mieweb/ui\`.

\`\`\`tsx
import { DataVisNitroChat } from '@mieweb/datavis/chat';

<DataVisNitroChat
  viewData={viewState.data}
  columns={columns}
  fieldMap={{ sender: 'who', message: 'body', time: 'when' }}
  currentSender="Dr. Alice Nguyen"
/>
\`\`\``,
      },
    },
    catalog: {
      entry: '@mieweb/datavis/chat',
      // SuperChat's default Markdown renderer; optional peers of @mieweb/ui.
      peers: ['react-markdown', 'remark-gfm', 'rehype-sanitize'],
      relationships: [
        {
          type: 'alternative to',
          target: 'grids-datavis-nitro',
          why: 'Same plain view, read as a time-ordered conversation instead of sortable, filterable rows; keep the grid for analysis and export.',
        },
        {
          type: 'uses',
          target: 'superchat-superchat-panel',
          why: 'Renders rows through SuperChat in readOnly mode; use SuperChat directly when users must compose or edit messages.',
        },
      ],
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

// ── Long thread: more rows than DataGrid's default 100-row batch. ───────────────
const LONG_THREAD_SENDERS = [
  'Dr. Alice Nguyen',
  'Nurse Bob Reyes',
  'Triage Bot',
];
const LONG_THREAD_ROWS: Record<string, unknown>[] = Array.from(
  { length: 150 },
  (_, index) => ({
    msgId: `long-${index + 1}`,
    sender: LONG_THREAD_SENDERS[index % LONG_THREAD_SENDERS.length],
    kind: index % LONG_THREAD_SENDERS.length === 2 ? 'agent' : 'human',
    sentAt: new Date(Date.UTC(2026, 4, 4, 9, 0) + index * 60_000).toISOString(),
    message: `Message **${index + 1}** of 150`,
  })
);
const LONG_THREAD_COLUMNS: TableColumn[] = [
  { field: 'msgId', header: 'Msg ID' },
  { field: 'sender', header: 'Sender' },
  { field: 'kind', header: 'Kind' },
  { field: 'sentAt', header: 'Sent', typeInfo: { type: 'date' } },
  { field: 'message', header: 'Message' },
];
const LONG_THREAD_TYPE_INFO = LONG_THREAD_COLUMNS.map(({ field }) => ({
  field,
  type: 'string',
}));

function ChatInDataGrid() {
  const view = useContext(DataVisNitroContext);
  return view ? <ChatInDataGridInner view={view} /> : null;
}

function ChatInDataGridInner({ view }: { view: ViewInstance }) {
  const viewState = useView(view, false);
  return (
    <DataGrid
      view={view}
      autoFetch={false}
      allColumns={LONG_THREAD_COLUMNS}
      title="Long Thread"
      showControls={false}
    >
      <DataVisNitroChat
        viewData={viewState.data}
        columns={LONG_THREAD_COLUMNS}
        currentSender="Dr. Alice Nguyen"
        className="h-[32rem]"
      />
    </DataGrid>
  );
}

function LongThreadDataset() {
  const varName = useMemo(() => {
    const name = `__datavis_chat_story_${Math.random().toString(36).slice(2)}`;
    (window as unknown as Record<string, unknown>)[name] = {
      typeInfo: LONG_THREAD_TYPE_INFO,
      data: LONG_THREAD_ROWS,
    };
    return name;
  }, []);
  useEffect(
    () => () => {
      delete (window as unknown as Record<string, unknown>)[varName];
    },
    [varName]
  );
  return (
    <DataVisNitroSource type="local" varName={varName}>
      <ChatInDataGrid />
    </DataVisNitroSource>
  );
}

/**
 * Inside `<DataGrid>`, chat mode bypasses the grid's 100-row batch so all 150
 * messages render, scrolling within the fixed-height panel.
 */
export const LongThreadInDataGrid: Story = {
  name: 'Long Thread in DataGrid',
  parameters: {
    exampleNote: {
      title: 'More than 100 messages inside DataGrid',
      body: 'DataGrid normally hands table children only the first 100 rows and a "show more" control. A transcript has no such control, so DataGrid passes DataVisNitroChat every row: all 150 messages render, scrolling inside the h-[32rem] panel. The newest message (150) sits at the bottom.',
    },
  },
  render: () => <LongThreadDataset />,
};
