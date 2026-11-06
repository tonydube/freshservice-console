import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import {
  agentName, useAgents, useConnectionCheck, useDepartments, useGroups, useHealth, useLabelMaps, useTicketFields,
} from '../../api/lookups';
import { Button, Card, Row, StatusDot } from '../../components/ui';
import { planFromTotal, useRateLimit } from '../../lib/rateLimit';
import { updateSettings, useSettings } from '../../lib/settings';
import { useMyAgent } from '../../api/tickets';
import { useState } from 'react';

const input = 'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900';

function Preferences({ envEmail }: { envEmail: string | null }) {
  const settings = useSettings();
  const me = useMyAgent();
  const [email, setEmail] = useState(settings.myAgentEmail);
  return (
    <Card title="Preferences">
      <dl>
        <Row label="My agent email">
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); updateSettings({ myAgentEmail: email.trim() }); }}>
            <input className={`${input} w-64`} type="email" value={email} placeholder={envEmail ?? 'you@company.com'}
              onChange={(e) => setEmail(e.target.value)} aria-label="My agent email" />
            <Button onClick={() => updateSettings({ myAgentEmail: email.trim() })}>Save</Button>
          </form>
          <p className="mt-1 text-xs text-zinc-500">
            {!me.email ? 'Not set. "My open" needs this.'
              : me.loading ? 'Looking up…'
              : me.agent ? `Matched agent: ${agentName(me.agent)} (#${me.agent.id})${!settings.myAgentEmail && envEmail ? ' · from MY_AGENT_EMAIL in .env' : ''}`
              : <span className="text-red-600">No agent found with {me.email}.</span>}
          </p>
        </Row>
        <Row label="Auto-refresh lists">
          <select className={input} value={settings.refreshSeconds} aria-label="Auto-refresh interval"
            onChange={(e) => updateSettings({ refreshSeconds: Number(e.target.value) })}>
            {[0, 30, 60, 120, 300].map((s) => <option key={s} value={s}>{s === 0 ? 'Off' : s < 60 ? `Every ${s} s` : `Every ${s / 60} min`}</option>)}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Each refresh costs one API call (plus requester lookups for new names).</p>
        </Row>
      </dl>
    </Card>
  );
}

function errorText(e: unknown) {
  if (e instanceof ApiError) return `${e.message} (HTTP ${e.status}, ${e.code})`;
  return e instanceof Error ? e.message : String(e);
}

export function SetupInstructions({ problems }: { problems: string[] }) {
  return (
    <Card title="Setup needed">
      <ul className="mb-3 list-disc space-y-1 pl-5 text-red-700 dark:text-red-400">
        {problems.map((p) => <li key={p}>{p}</li>)}
      </ul>
      <ol className="list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
        <li>Copy <code>.env.example</code> to <code>.env</code> in the project folder.</li>
        <li>Set <code>FRESHSERVICE_DOMAIN</code> (e.g. <code>acme</code> for acme.freshservice.com).</li>
        <li>Paste your key into <code>FRESHSERVICE_API_KEY</code> (Freshservice → Profile settings → Your API key).</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
    </Card>
  );
}

export function ConnectionPage() {
  const qc = useQueryClient();
  const health = useHealth();
  const configured = health.data?.configured === true;
  const conn = useConnectionCheck(configured);
  const connected = conn.isSuccess;
  const fields = useTicketFields(connected);
  const agents = useAgents(connected);
  const groups = useGroups(connected);
  const departments = useDepartments(connected);
  const labels = useLabelMaps();
  const rl = useRateLimit();

  if (health.isPending) return <p className="text-sm text-zinc-500">Checking server…</p>;
  if (health.isError) return <Card title="Server unreachable"><p>The local server isn't responding. Is <code>npm run dev</code> running?</p></Card>;
  if (!health.data.configured) return <SetupInstructions problems={health.data.problems} />;

  const lookups = [
    { name: 'Ticket fields', q: fields, count: fields.data?.length },
    { name: 'Agents', q: agents, count: agents.data?.length, extra: agents.data && `${agents.data.filter((a) => a.active !== false).length} active` },
    { name: 'Groups', q: groups, count: groups.data?.length },
    { name: 'Departments', q: departments, count: departments.data?.length },
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Freshservice connection"
        action={<Button onClick={() => qc.invalidateQueries()} disabled={conn.isFetching}>Re-check</Button>}
      >
        <dl>
          <Row label="Domain">{health.data.domain}</Row>
          <Row label="Status">
            <span className="flex items-center gap-2">
              <StatusDot tone={conn.isFetching ? 'idle' : conn.isError ? 'error' : 'ok'} />
              {conn.isFetching ? 'Checking…' : conn.isError ? errorText(conn.error) : `Connected (${conn.data?.latencyMs} ms)`}
            </span>
          </Row>
          <Row label="Rate limit">
            {rl.total == null ? 'unknown' : `${rl.remaining} of ${rl.total} requests left this minute`}
            {planFromTotal(rl.total) && <span className="text-zinc-500"> · looks like the {planFromTotal(rl.total)} plan</span>}
          </Row>
          <Row label="Reply signature">{health.data.replySignature ?? <span className="text-zinc-500">none</span>}</Row>
        </dl>
      </Card>

      <Card title="Reference data">
        <dl>
          {lookups.map(({ name, q, count, extra }) => (
            <Row key={name} label={name}>
              <span className="flex items-center gap-2">
                <StatusDot tone={!connected ? 'warn' : q.isPending ? 'idle' : q.isError ? 'error' : 'ok'} />
                {!connected ? 'waiting for connection' : q.isPending ? 'loading…' : q.isError ? errorText(q.error) : `${count} loaded${extra ? ` (${extra})` : ''}`}
              </span>
            </Row>
          ))}
        </dl>
      </Card>

      {connected && <Preferences envEmail={health.data.myAgentEmail} />}

      {connected && (
        <Card title="Ticket enums in use">
          <dl>
            {(['status', 'priority', 'urgency', 'impact'] as const).map((f) => (
              <Row key={f} label={f[0].toUpperCase() + f.slice(1)}>
                {Object.entries(labels[f]).map(([k, v]) => `${v} (${k})`).join(' · ')}
              </Row>
            ))}
            {agents.data && (
              <Row label="Agents">{agents.data.filter((a) => a.active !== false).map(agentName).join(', ')}</Row>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}

