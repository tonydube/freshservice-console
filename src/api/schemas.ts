import { z } from 'zod';

/** Schemas are intentionally loose (looseObject): Freshservice adds fields over time. */

const id = z.number();
const nullableNum = z.number().nullable().optional();
const nullableStr = z.string().nullable().optional();

export const AgentSchema = z.looseObject({
  id,
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: nullableStr,
  active: z.boolean().optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const GroupSchema = z.looseObject({ id, name: z.string() });
export type Group = z.infer<typeof GroupSchema>;

export const DepartmentSchema = z.looseObject({ id, name: z.string() });
export type Department = z.infer<typeof DepartmentSchema>;

export const RequesterSchema = z.looseObject({
  id,
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  primary_email: nullableStr,
});
export type Requester = z.infer<typeof RequesterSchema>;

const ChoiceSchema = z.looseObject({ id: z.union([z.number(), z.string()]).optional(), value: z.union([z.string(), z.number()]) });

export const TicketFieldSchema = z.looseObject({
  id,
  name: z.string(),
  label: z.string().optional(),
  field_type: z.string().optional(),
  required_for_agents: z.boolean().optional(),
  default_field: z.boolean().optional(),
  choices: z.array(ChoiceSchema).nullable().optional(),
});
export type TicketField = z.infer<typeof TicketFieldSchema>;

export const TicketSchema = z.looseObject({
  id,
  subject: z.string().nullable(),
  description_text: nullableStr,
  type: nullableStr,
  status: z.number(),
  priority: z.number(),
  urgency: nullableNum,
  impact: nullableNum,
  source: nullableNum,
  requester_id: nullableNum,
  responder_id: nullableNum,
  group_id: nullableNum,
  department_id: nullableNum,
  category: nullableStr,
  due_by: nullableStr,
  fr_due_by: nullableStr,
  tags: z.array(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type Ticket = z.infer<typeof TicketSchema>;

const AttachmentSchema = z.looseObject({
  id: z.number().optional(),
  name: z.string(),
  content_type: nullableStr,
  size: nullableNum,
  attachment_url: nullableStr,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const TicketDetailSchema = TicketSchema.extend({
  description: nullableStr,
  attachments: z.array(AttachmentSchema).optional(),
  cc_emails: z.array(z.string()).nullable().optional(),
  requester: z.looseObject({ id: nullableNum, name: nullableStr, email: nullableStr, phone: nullableStr, mobile: nullableStr }).nullable().optional(),
  stats: z.looseObject({
    first_responded_at: nullableStr,
    resolved_at: nullableStr,
    closed_at: nullableStr,
  }).nullable().optional(),
});
export type TicketDetail = z.infer<typeof TicketDetailSchema>;

export const ConversationSchema = z.looseObject({
  id,
  user_id: nullableNum,
  from_email: nullableStr,
  to_emails: z.array(z.string()).nullable().optional(),
  cc_emails: z.array(z.string()).nullable().optional(),
  body: nullableStr,
  body_text: nullableStr,
  incoming: z.boolean().optional(),
  private: z.boolean().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  created_at: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ActivitySchema = z.looseObject({
  actor: z.looseObject({ id: nullableNum, name: nullableStr }).nullable().optional(),
  content: nullableStr,
  sub_contents: z.array(z.string()).nullable().optional(),
  created_at: z.string(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const TicketResponse = z.object({ ticket: TicketDetailSchema });
export const ConversationsResponse = z.object({ conversations: z.array(ConversationSchema) });
export const ActivitiesResponse = z.object({ activities: z.array(ActivitySchema) });
export const FilterResponse = z.object({ tickets: z.array(TicketSchema), total: z.number() });
export const RequesterResponse = z.object({ requester: RequesterSchema });

export const AgentsResponse = z.object({ agents: z.array(AgentSchema) });
export const GroupsResponse = z.object({ groups: z.array(GroupSchema) });
export const DepartmentsResponse = z.object({ departments: z.array(DepartmentSchema) });
export const TicketFieldsResponse = z.object({ ticket_fields: z.array(TicketFieldSchema) });
export const TicketsResponse = z.object({ tickets: z.array(TicketSchema) });

export const HealthSchema = z.object({
  configured: z.boolean(),
  domain: z.string(),
  webBase: z.string(),
  myAgentEmail: z.string().nullable(),
  problems: z.array(z.string()),
  replySignature: z.string().nullable(),
});
export type Health = z.infer<typeof HealthSchema>;
