import 'dotenv/config';

export interface ServerConfig {
  /** e.g. https://acme.freshservice.com/api/v2 */
  apiBase: string;
  domainLabel: string;
  /** Agent-facing web URL, for "Open in Freshservice" links. */
  webBase: string;
  /** Optional default for the "My tickets" agent. */
  myAgentEmail: string;
  apiKey: string;
  port: number;
  replySignature: string;
  configured: boolean;
  problems: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const problems: string[] = [];
  const domain = (env.FRESHSERVICE_DOMAIN ?? '').trim();
  const override = (env.FRESHSERVICE_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const apiKey = (env.FRESHSERVICE_API_KEY ?? '').trim();

  let apiBase = '';
  let domainLabel = '';
  let webBase = '';
  if (override) {
    apiBase = `${override}/api/v2`;
    domainLabel = override;
    webBase = override;
  } else if (domain) {
    // Accept "acme", "acme.freshservice.com" or a full URL.
    const host = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const fullHost = host.includes('.') ? host : `${host}.freshservice.com`;
    if (!fullHost.endsWith('.freshservice.com')) {
      problems.push('FRESHSERVICE_DOMAIN must be a *.freshservice.com domain (custom CNAMEs are not supported by the API).');
    }
    apiBase = `https://${fullHost}/api/v2`;
    domainLabel = fullHost;
    webBase = `https://${fullHost}`;
  } else {
    problems.push('FRESHSERVICE_DOMAIN is not set.');
  }
  if (!apiKey) problems.push('FRESHSERVICE_API_KEY is not set.');

  return {
    apiBase,
    domainLabel,
    webBase,
    myAgentEmail: (env.MY_AGENT_EMAIL ?? '').trim(),
    apiKey,
    port: Number(env.SERVER_PORT ?? 8787),
    replySignature: (env.REPLY_SIGNATURE ?? '').trim(),
    configured: problems.length === 0,
    problems,
  };
}
