import assert from 'node:assert/strict';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { createMariaDbLeadRepository, loadLocalDbEnv } from './lib/adein-lead-agent-store.mjs';

const env = loadLocalDbEnv(process.env.ADEIN_LOCAL_DB_ENV_FILE || `${process.env.HOME}/.agentes-si-data/adein/runtime/local-db.env`);
const connection = await mysql.createConnection(env);
const repository = createMariaDbLeadRepository(connection);
const phone = `55${String(Date.now()).slice(-8)}`;
const sourceRef = `self-check-${Date.now()}.txt`;

try {
  const created = await repository.saveIngestion({
    source: 'whatsapp_txt', sourceRef,
    lead: {
      name: 'Prospecto sintético', phoneOriginal: phone, phoneNormalized: phone, priority: 'Alta', status: 'Cita agendada',
      property: 'Terreno de prueba', budget: 'Por confirmar', summary: 'Prueba sintética.', nextAction: 'Confirmar cita.',
      suggestedFollowupAt: '2026-08-03', seller: 'Vendedor 1', reviewStatus: 'pending',
    },
    appointment: { date: '2026-08-04', time: '16:00', property: 'Terreno de prueba', status: 'Agendada' },
  });
  assert.equal(created.action, 'created');

  const updated = await repository.saveIngestion({
    source: 'whatsapp_txt', sourceRef: `${sourceRef}-update`,
    lead: { ...created.lead, name: 'Prospecto sintético actualizado', phoneOriginal: phone, phoneNormalized: phone, priority: 'Media', status: 'Contactado', property: 'Terreno de prueba', budget: 'Por confirmar', summary: 'Seguimiento sintético.', nextAction: 'Enviar información.', suggestedFollowupAt: '2026-08-04', seller: 'Vendedor 1', reviewStatus: 'pending' },
    appointment: null,
  });
  assert.equal(updated.action, 'updated');

  const leads = await repository.listLeads();
  assert.equal(leads.some((lead) => lead.phone === phone && lead.seller === 'Vendedor 1'), true);

  const [leadRows] = await connection.query('SELECT COUNT(*) AS count FROM adein_leads WHERE phone_normalized = ?', [phone]);
  assert.equal(Number(leadRows[0].count), 1);
} finally {
  await connection.query('DELETE FROM adein_lead_analysis_events WHERE source_ref LIKE ?', [`${sourceRef}%`]);
  await connection.query('DELETE FROM adein_lead_appointments WHERE source_ref = ?', [sourceRef]);
  await connection.query('DELETE FROM adein_processed_files WHERE source_ref LIKE ?', [`${sourceRef}%`]);
  await connection.query('DELETE FROM adein_leads WHERE phone_normalized = ?', [phone]);
  await connection.end();
}

console.log(JSON.stringify({ ok: true, checks: ['mariadb_create', 'mariadb_phone_upsert', 'synthetic_cleanup'] }));
