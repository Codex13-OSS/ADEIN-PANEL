const fingerprint = (leads) => leads.map((lead) => [lead.id, lead.name, lead.status, lead.nextAction, lead.lastContact].join('|')).sort().join('||');

export async function waitForProspectRefresh({ previousLeads, listLeads, wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)), attempts = 20, intervalMs = 750, onProgress = () => {} }) {
  const previousFingerprint = fingerprint(previousLeads);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    onProgress(Math.round(8 + (attempt / Math.max(attempts - 1, 1)) * 84));
    const leads = await listLeads();
    if (fingerprint(leads) !== previousFingerprint) {
      onProgress(100);
      return leads;
    }
    if (attempt < attempts - 1) await wait(intervalMs);
  }
  return null;
}
