const LIA_HANDOFF_ENDPOINT = 'http://127.0.0.1:3192/api/local/lia/handoff';

export async function requestLiaLaunch({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(LIA_HANDOFF_ENDPOINT);
  const body = await response.json();
  if (!response.ok || !body.ok || typeof body.launchUrl !== 'string') {
    throw new Error(body.error || 'No fue posible abrir el generador documental local.');
  }
  return body.launchUrl;
}

export async function navigateToLiaLaunch({ requestLaunch = requestLiaLaunch, navigate = (url) => window.location.assign(url) } = {}) {
  navigate(await requestLaunch());
}
