export function getRuntimeConfig() {
  return (window as any).__ADEIN_RUNTIME_CONFIG__ || { LIA_URL: '/lia' };
}

export function getLiaUrl() {
  return getRuntimeConfig().LIA_URL || '/lia';
}

// Lead Agent is always same-origin behind the web server proxy
export const LEAD_AGENT_API = '/api/local/lead-agent';

export const OWNER_AUTH_API = '/api/local/auth';
export const PROPERTIES_API = '/api/local/properties';
