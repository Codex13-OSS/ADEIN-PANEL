export function getRuntimeConfig() {
  return (window as any).__ADEIN_RUNTIME_CONFIG__ || { LIA_URL: 'http://127.0.0.1:3002' };
}

export function getLiaUrl() {
  return getRuntimeConfig().LIA_URL || 'http://127.0.0.1:3002';
}

// Lead Agent is always same-origin behind the web server proxy
export const LEAD_AGENT_API = '/api/local/lead-agent';
