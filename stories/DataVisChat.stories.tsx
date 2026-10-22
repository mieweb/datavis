import { useContext, useEffect, useMemo } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
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

// ── Threaded thread: `messageId` + `parentMessageId` turn the flat rows into a
//    collapsible reply tree. Siblings stay ordered by `sentAt`. ───────────────
const THREADED_COLUMNS: TableColumn[] = [
  { field: 'messageId', header: 'Msg ID', width: 80 },
  { field: 'parentMessageId', header: 'Parent', width: 80 },
  { field: 'sender', header: 'Sender', width: 150 },
  { field: 'kind', header: 'Kind', width: 90 },
  { field: 'role', header: 'Role', width: 110 },
  { field: 'sentAt', header: 'Sent', width: 160, typeInfo: { type: 'date' } },
  { field: 'message', header: 'Message', width: 360 },
];

const THREADED_ROWS: Record<string, unknown>[] = [
  {
    messageId: 'r1',
    parentMessageId: '',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-04T09:01:00',
    message:
      'Kicking off rounds for **bed 12**. Overnight labs and telemetry, please.',
  },
  {
    messageId: 'r2',
    parentMessageId: 'r1',
    sender: 'Triage Bot',
    kind: 'agent',
    role: 'Triage',
    sentAt: '2026-05-04T09:01:30',
    message: 'Labs: Potassium `5.6 mmol/L` (high), otherwise within range.',
  },
  {
    messageId: 'r3',
    parentMessageId: 'r2',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-04T09:02:10',
    message: 'Hold the ACE inhibitor and repeat a BMP.',
  },
  {
    messageId: 'r4',
    parentMessageId: 'r3',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    sentAt: '2026-05-04T09:03:00',
    message: 'BMP redrawn — results pending.',
  },
  {
    messageId: 'r5',
    parentMessageId: 'r1',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    sentAt: '2026-05-04T09:02:40',
    message: 'Telemetry stable overnight, no ectopy.',
  },
  {
    messageId: 'r6',
    parentMessageId: '',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-04T09:05:00',
    message: 'Separately — **bed 14** discharge paperwork status?',
  },
  {
    messageId: 'r7',
    parentMessageId: 'r6',
    sender: 'Helpdesk Assistant',
    kind: 'agent',
    role: 'Coordinator',
    sentAt: '2026-05-04T09:05:20',
    message: 'Discharge summary drafted; awaiting your sign-off.',
  },
];

// ── Rooms: a `room` column groups rows into one conversation per room/topic.
//    Each room lists in the conversation list; its messages may be threaded. ──
const ROOMS_COLUMNS: TableColumn[] = [
  { field: 'room', header: 'Room', width: 120 },
  ...THREADED_COLUMNS,
];

const ROOMS_ROWS: Record<string, unknown>[] = [
  ...THREADED_ROWS.slice(0, 5).map((row) => ({ room: 'Bed 12', ...row })),
  ...THREADED_ROWS.slice(5).map((row) => ({
    room: 'Bed 14 discharge',
    ...row,
  })),
  {
    room: 'Pharmacy',
    messageId: 'p1',
    parentMessageId: '',
    sender: 'PharmD Carla Ortiz',
    kind: 'human',
    role: 'Pharmacist',
    sentAt: '2026-05-04T08:40:00',
    message: 'Formulary swap approved: **amlodipine** for bed 9.',
  },
  {
    room: 'Pharmacy',
    messageId: 'p2',
    parentMessageId: 'p1',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-04T08:42:00',
    message: 'Thanks — updating the order now.',
  },
];

// ── Date buckets: messages spread over months, relative to a fixed "now"
//    (Thursday 7 May 2026, 15:00) so the buckets are stable in the story. ────
const BUCKETS_NOW = new Date(2026, 4, 7, 15, 0);

const BUCKET_COLUMNS: TableColumn[] = [
  { field: 'room', header: 'Room', width: 110 },
  ...THREADED_COLUMNS,
];

const BUCKET_ROWS: Record<string, unknown>[] = [
  {
    room: 'Bed 12',
    messageId: 'b1',
    parentMessageId: '',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2025-11-18T10:00:00',
    message: 'Admission note for **bed 12**: CKD stage 3, baseline K+ `4.8`.',
  },
  {
    room: 'Bed 12',
    messageId: 'b2',
    parentMessageId: 'b1',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    sentAt: '2026-03-02T09:30:00',
    message: 'Quarterly nephrology follow-up scheduled.',
  },
  {
    room: 'Bed 12',
    messageId: 'b3',
    parentMessageId: '',
    sender: 'Triage Bot',
    kind: 'agent',
    role: 'Triage',
    sentAt: '2026-05-01T14:00:00',
    message: 'Monthly labs: K+ `5.1 mmol/L` (borderline).',
  },
  {
    room: 'Bed 12',
    messageId: 'b4',
    parentMessageId: '',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-04T09:01:00',
    message: 'Kicking off rounds — overnight labs, please.',
  },
  {
    room: 'Bed 12',
    messageId: 'b5',
    parentMessageId: 'b4',
    sender: 'Triage Bot',
    kind: 'agent',
    role: 'Triage',
    sentAt: '2026-05-04T09:01:30',
    message: 'K+ `5.6 mmol/L` (high). Recommend a repeat BMP.',
  },
  {
    room: 'Bed 12',
    messageId: 'b6',
    parentMessageId: 'b5',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    sentAt: '2026-05-05T08:00:00',
    message: 'Repeat BMP drawn; holding the ACE inhibitor.',
  },
  {
    room: 'Bed 12',
    messageId: 'b7',
    parentMessageId: '',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-07T08:15:00',
    message: 'Repeat K+ `4.9` — resume the ACE inhibitor.',
  },
  {
    room: 'Bed 12',
    messageId: 'b8',
    parentMessageId: 'b7',
    sender: 'Nurse Bob Reyes',
    kind: 'human',
    role: 'Charge RN',
    sentAt: '2026-05-07T08:20:00',
    message: 'Resumed and documented.',
  },
  {
    room: 'Pharmacy',
    messageId: 'p1',
    parentMessageId: '',
    sender: 'PharmD Carla Ortiz',
    kind: 'human',
    role: 'Pharmacist',
    sentAt: '2026-02-10T13:00:00',
    message: 'Q1 formulary update is live.',
  },
  {
    room: 'Pharmacy',
    messageId: 'p2',
    parentMessageId: '',
    sender: 'PharmD Carla Ortiz',
    kind: 'human',
    role: 'Pharmacist',
    sentAt: '2026-05-06T11:00:00',
    message: 'Formulary swap approved: **amlodipine** for bed 9.',
  },
  {
    room: 'Pharmacy',
    messageId: 'p3',
    parentMessageId: 'p2',
    sender: 'Dr. Alice Nguyen',
    kind: 'human',
    role: 'Attending',
    sentAt: '2026-05-06T11:05:00',
    message: 'Thanks — updating the order now.',
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
- \`parentId\` → the replied-to message id; replies render as a collapsible reply tree
- \`room\` → the room/topic a message belongs to; rows group into one conversation per room, listed in a conversation list (SuperChatInbox) above each room's messages

With a \`time\` field, each room's messages are also sub-grouped by when they were sent — **Today / Earlier this week / Earlier this month / Earlier this year / Older** — nested under the room in the conversation list. The room is an accordion header that shows all of its messages; each bucket shows only that timeframe. With several rooms, **All conversations** heads the list and shows every message. Opening a bucket is a drill-down: \`onDrillDown\` receives the bucket's filter, resolved at that moment (e.g. *Earlier this week* on a Thursday is Monday 00:00 → Thursday 00:00), plus the room — apply it to a view if you want the grid filtered too. \`weekStartsOn\` sets the first day of the week (Monday by default).

### Use it when

- The rows *are* a conversation (care-team messages, a support thread, an audit log of who-said-what) and reading them as chat bubbles is clearer than a grid.

### Don't use it when

- The data is grouped or pivoted — chat mode only renders plain rows and shows a placeholder otherwise. Clear grouping/pivoting first, or use \`TableRenderer\`.
- Users need to compose, reply to, or edit messages — this adapter is **read-only** (it always renders SuperChat with \`readOnly\` and exposes no send/edit callbacks). Use [SuperChat](?path=/docs/superchat-superchat-panel--docs) directly with your own \`onMessageSent\` / \`onMessageEdited\` handlers.
- Users need to sort, filter, compare columns, or export the rows — keep the [DataVis NITRO grid](?path=/docs/grids-datavis-nitro--docs). Chat mode shows only the sender, message, and time; every other column is dropped from view.

### Related components

- [DataVis NITRO](?path=/docs/grids-datavis-nitro--docs) — the default grid over the same view. Offer both and let users toggle: the grid for analysis, chat mode for reading the thread in order.
- [SuperChat](?path=/docs/superchat-superchat-panel--docs) — the conversation surface this adapter renders into. Choose it when the host owns a live conversation model rather than a DataVis view.
- [SuperChat Inbox](?path=/docs/superchat-inbox--docs) — the conversation list + panel this adapter renders into when rows carry a \`room\` field. Choose it directly when the host owns live rooms and users must compose messages.

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
        {
          type: 'uses',
          target: 'superchat-inbox',
          why: 'Groups rows by a room/topic field into a readOnly SuperChatInbox conversation list; use SuperChatInbox directly for live, composable rooms.',
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

/**
 * With a `parentMessageId` field, replies nest under their parent as a
 * collapsible tree. Siblings stay ordered by `sentAt`; click a chevron to
 * collapse or expand a thread.
 */
export const ThreadedConversation: Story = {
  parameters: {
    exampleNote: {
      title: 'Threaded replies (messageId + parentMessageId)',
      body: 'When the data has messageId and parentMessageId, DataVisNitroChat sets each message’s parentId and SuperChat renders a native, indented, collapsible reply tree. Messages that share a parent stay ordered by sentAt, exactly as in the flat view. Click a chevron next to an author to collapse or expand that reply subtree — same native bubbles, avatars, and copy actions as the flat surface.',
    },
  },
  args: {
    viewData: plainView(THREADED_ROWS),
    columns: THREADED_COLUMNS,
    title: 'Care Team Thread (threaded)',
    currentSender: 'Dr. Alice Nguyen',
    className: 'h-[32rem]',
  },
};

/**
 * `defaultCollapsed` starts every thread with replies collapsed, showing just
 * the roots with a "N replies" pill to expand.
 */
export const ThreadedCollapsed: Story = {
  name: 'Threaded (collapsed by default)',
  parameters: {
    exampleNote: {
      title: 'Collapsed on load (defaultCollapsed)',
      body: 'Same threaded data, but defaultCollapsed tells SuperChat to collapse every thread with replies on first render — handy for long conversations. Each root shows a “N replies” pill; expand to drill in.',
    },
  },
  args: {
    viewData: plainView(THREADED_ROWS),
    columns: THREADED_COLUMNS,
    title: 'Care Team Thread (collapsed)',
    currentSender: 'Dr. Alice Nguyen',
    defaultCollapsed: true,
    className: 'h-[32rem]',
  },
};

/**
 * With a `room` column, rows group into one conversation per room/topic. The
 * conversation list shows each room (newest activity first); selecting one
 * shows its messages, threaded when they carry a `parentMessageId`.
 */
export const RoomsWithThreads: Story = {
  name: 'Rooms (conversation list + threads)',
  parameters: {
    exampleNote: {
      title: 'Rooms / topics above threaded conversations',
      body: 'A room column turns each distinct room value into an entry in the SuperChat conversation list. Selecting a room shows only its messages, and replies inside a room still nest as a collapsible tree. Senders keep the same accent color in every room. defaultActiveRoom="Bed 12" picks the initial room; otherwise the most recently active room opens.',
    },
  },
  args: {
    viewData: plainView(ROOMS_ROWS),
    columns: ROOMS_COLUMNS,
    currentSender: 'Dr. Alice Nguyen',
    defaultActiveRoom: 'Bed 12',
    className: 'h-[32rem]',
  },
};

/**
 * With a `time` field, each room's date buckets nest under it in the
 * conversation list. The room header shows all of its messages and toggles the
 * accordion; a bucket shows only that timeframe.
 */
export const DateBucketsInRoom: Story = {
  name: 'Rooms with date buckets',
  parameters: {
    exampleNote: {
      title: 'Date-range sub-grouping within a room',
      body: 'Each room in the conversation list is an accordion header: click it to see all of the room’s messages and reveal its date buckets — Today, Earlier this week, Earlier this month, Earlier this year, Older — relative to now (fixed here to Thursday 7 May 2026, 15:00 via the now prop). Click a bucket to see only that timeframe; the panel title shows the room and the bucket. All conversations, at the top, returns to every room’s messages (and has its own buckets). Buckets are disjoint, so their counts add up to the room total. Opening a bucket also calls onDrillDown with its runtime-resolved filter — see the Actions panel.',
    },
  },
  args: {
    viewData: plainView(BUCKET_ROWS),
    columns: BUCKET_COLUMNS,
    currentSender: 'Dr. Alice Nguyen',
    defaultActiveRoom: 'Bed 12',
    now: BUCKETS_NOW,
    onDrillDown: fn(),
    className: 'h-[32rem]',
  },
};
