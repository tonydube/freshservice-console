/** Deterministic fake Freshservice data, shaped like real API v2 responses. */

export const agents = [
  { id: 1001, first_name: 'Tony', last_name: 'Dube', email: 'tony@example.com', active: true, job_title: 'IT Lead' },
  { id: 1002, first_name: 'Priya', last_name: 'Shah', email: 'priya@example.com', active: true, job_title: 'Service Desk' },
  { id: 1003, first_name: 'Marco', last_name: 'Rossi', email: 'marco@example.com', active: true, job_title: 'Network Eng' },
  { id: 1004, first_name: 'Old', last_name: 'Account', email: 'old@example.com', active: false, job_title: null },
];

export const groups = [
  { id: 2001, name: 'Service Desk', description: 'First line' },
  { id: 2002, name: 'Network', description: 'Networking & VPN' },
  { id: 2003, name: 'Hardware', description: 'Laptops, printers' },
];

export const departments = [
  { id: 3001, name: 'Finance' },
  { id: 3002, name: 'Engineering' },
  { id: 3003, name: 'Sales' },
];

export const requesters = [
  { id: 4001, first_name: 'Ana', last_name: 'Lopez', primary_email: 'ana@example.com', department_ids: [3001] },
  { id: 4002, first_name: 'Ben', last_name: 'Okafor', primary_email: 'ben@example.com', department_ids: [3002] },
  { id: 4003, first_name: 'Chen', last_name: 'Wei', primary_email: 'chen@example.com', department_ids: [3003] },
];

const choice = (pairs: Array<[number, string]>) => pairs.map(([id, value]) => ({ id, value }));

export const ticketFields = [
  { id: 1, name: 'requester', label: 'Requester', field_type: 'default_requester', required_for_agents: true, default_field: true, choices: [] },
  { id: 2, name: 'subject', label: 'Subject', field_type: 'default_subject', required_for_agents: true, default_field: true, choices: [] },
  { id: 3, name: 'ticket_type', label: 'Type', field_type: 'default_ticket_type', required_for_agents: true, default_field: true, choices: choice([[1, 'Incident'], [2, 'Service Request']]) },
  { id: 4, name: 'status', label: 'Status', field_type: 'default_status', required_for_agents: true, default_field: true, choices: choice([[2, 'Open'], [3, 'Pending'], [4, 'Resolved'], [5, 'Closed'], [6, 'Waiting on Vendor']]) },
  { id: 5, name: 'priority', label: 'Priority', field_type: 'default_priority', required_for_agents: true, default_field: true, choices: choice([[1, 'Low'], [2, 'Medium'], [3, 'High'], [4, 'Urgent']]) },
  { id: 6, name: 'urgency', label: 'Urgency', field_type: 'default_urgency', required_for_agents: false, default_field: true, choices: choice([[1, 'Low'], [2, 'Medium'], [3, 'High']]) },
  { id: 7, name: 'impact', label: 'Impact', field_type: 'default_impact', required_for_agents: false, default_field: true, choices: choice([[1, 'Low'], [2, 'Medium'], [3, 'High']]) },
  { id: 8, name: 'source', label: 'Source', field_type: 'default_source', required_for_agents: false, default_field: true, choices: choice([[1, 'Email'], [2, 'Portal'], [3, 'Phone'], [4, 'Chat']]) },
  { id: 9, name: 'group', label: 'Group', field_type: 'default_group', required_for_agents: false, default_field: true, choices: [] },
  { id: 10, name: 'agent', label: 'Agent', field_type: 'default_agent', required_for_agents: false, default_field: true, choices: [] },
  { id: 11, name: 'category', label: 'Category', field_type: 'default_category', required_for_agents: false, default_field: true, choices: choice([[1, 'Hardware'], [2, 'Software'], [3, 'Network']]) },
  { id: 12, name: 'cf_location', label: 'Office location', field_type: 'custom_dropdown', required_for_agents: false, default_field: false, choices: choice([[1, 'HQ'], [2, 'Remote'], [3, 'Branch']]) },
];

const subjects = [
  'VPN disconnects every 10 minutes', 'New laptop for onboarding', 'Printer on 3rd floor jammed',
  'Cannot access shared drive', 'Outlook keeps asking for password', 'Request Adobe Acrobat license',
  'Wi-Fi slow in conference room B', 'Monitor flickering', 'Reset MFA device', 'Teams calls dropping',
];

const hour = 3600_000;
// Anchor data to "now" so views like Overdue / Recently updated always have content.
const today = new Date();
const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 22 * 24 * hour;

export const tickets = Array.from({ length: 75 }, (_, i) => {
  const n = i + 1;
  const created = base + n * 7 * hour;
  const status = [2, 2, 3, 4, 5, 2, 6][n % 7];
  const agent = n % 5 === 0 ? null : agents[n % 3].id;
  return {
    id: n,
    subject: subjects[n % subjects.length],
    description: `<div>Ticket ${n}: ${subjects[n % subjects.length]}.</div>`,
    description_text: `Ticket ${n}: ${subjects[n % subjects.length]}.`,
    type: n % 4 === 0 ? 'Service Request' : 'Incident',
    status,
    priority: (n % 4) + 1,
    urgency: (n % 3) + 1,
    impact: ((n + 1) % 3) + 1,
    source: (n % 4) + 1,
    requester_id: requesters[n % 3].id,
    responder_id: agent,
    group_id: groups[n % 3].id,
    department_id: departments[n % 3].id,
    category: ['Hardware', 'Software', 'Network'][n % 3],
    sub_category: null,
    item_category: null,
    due_by: new Date(created + (24 + (n % 10) * 24) * hour).toISOString(),
    fr_due_by: new Date(created + 4 * hour).toISOString(),
    is_escalated: false,
    fr_escalated: false,
    spam: n % 37 === 0,
    deleted: false,
    tags: n % 6 === 0 ? ['vip'] : [],
    cc_emails: [],
    fwd_emails: [],
    reply_cc_emails: [],
    to_emails: null,
    workspace_id: 2,
    created_at: new Date(created).toISOString(),
    updated_at: new Date(created + (3 + (n % 4) * 20) * hour).toISOString(),
    attachments: n % 9 === 0 ? [{ id: 9000 + n, name: 'screenshot.png', content_type: 'image/png', size: 48213, attachment_url: 'https://example.com/screenshot.png', created_at: new Date(created).toISOString() }] : [],
    custom_fields: { cf_location: ['HQ', 'Remote', 'Branch'][n % 3] },
  };
});

export const conversationsFor = (ticketId: number) => {
  const t = tickets.find((x) => x.id === ticketId);
  if (!t) return [];
  const req = requesters.find((r) => r.id === t.requester_id)!;
  const start = Date.parse(t.created_at);
  const count = ticketId % 4; // 0..3 conversations
  return Array.from({ length: count }, (_, i) => {
    const isNote = i === 1;
    const incoming = i === 2;
    return {
      id: ticketId * 100 + i,
      ticket_id: ticketId,
      user_id: incoming ? req.id : agents[ticketId % 3].id,
      from_email: incoming ? req.primary_email : null,
      to_emails: incoming ? [] : [req.primary_email],
      cc_emails: [],
      bcc_emails: [],
      body: isNote
        ? '<div>Internal: checked logs, looks like a <b>driver</b> issue.</div>'
        : incoming
          ? '<div>Thanks, still happening this morning.<br><img src=x onerror="alert(1)"></div>'
          : '<div>Hi, could you try restarting and let us know?</div>',
      body_text: isNote ? 'Internal: checked logs, looks like a driver issue.' : incoming ? 'Thanks, still happening this morning.' : 'Hi, could you try restarting and let us know?',
      incoming,
      private: isNote,
      source: isNote ? 2 : 0,
      attachments: [],
      created_at: new Date(start + (i + 1) * 2 * hour).toISOString(),
      updated_at: new Date(start + (i + 1) * 2 * hour).toISOString(),
    };
  });
};

export const activitiesFor = (ticketId: number) => {
  const t = tickets.find((x) => x.id === ticketId);
  if (!t) return [];
  return [
    { actor: { id: t.requester_id, name: 'Requester' }, content: 'raised the ticket', sub_contents: [], created_at: t.created_at },
    { actor: { id: 0, name: 'Workflow Automator' }, content: 'executed Assign by category', sub_contents: [`Set Group as ${groups[ticketId % 3].name}`], created_at: t.created_at },
  ];
};
