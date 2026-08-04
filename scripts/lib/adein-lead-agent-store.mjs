import fs from 'node:fs';
import { validateLocalAdeinDbConfig } from './adein-local-db-config.mjs';

export function loadLocalDbEnv(filePath) {
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    env[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return validateLocalAdeinDbConfig(env);
}

export function createMariaDbLeadRepository(connection) {
  return {
    async listLeads() {
      const [rows] = await connection.query(
        `SELECT id, name, phone_original, property_interest, status, seller_name,
                updated_at, next_action, priority
         FROM adein_leads
         ORDER BY updated_at DESC, id DESC`,
      );
      return rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        phone: row.phone_original,
        property: row.property_interest,
        status: row.status,
        seller: row.seller_name,
        lastContact: new Date(row.updated_at).toISOString(),
        nextAction: row.next_action,
        intentionLevel: row.priority,
      }));
    },
    async saveIngestion(record) {
      const { lead, appointment, sourceRef } = record;
      await connection.beginTransaction();
      try {
        const [leadResult] = await connection.query(
          `INSERT INTO adein_leads (
            phone_normalized, phone_original, name, seller_name, property_interest, budget_text,
            priority, status, summary, next_action, suggested_followup_at, review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            phone_original = VALUES(phone_original),
            name = VALUES(name),
            seller_name = VALUES(seller_name),
            property_interest = VALUES(property_interest),
            budget_text = VALUES(budget_text),
            priority = VALUES(priority),
            status = VALUES(status),
            summary = VALUES(summary),
            next_action = VALUES(next_action),
            suggested_followup_at = VALUES(suggested_followup_at),
            review_status = VALUES(review_status),
            updated_at = CURRENT_TIMESTAMP`,
          [
            lead.phoneNormalized, lead.phoneOriginal, lead.name, lead.seller, lead.property, lead.budget,
            lead.priority, lead.status, lead.summary, lead.nextAction, lead.suggestedFollowupAt, lead.reviewStatus,
          ],
        );
        const leadId = Number(leadResult.insertId);
        const action = leadResult.affectedRows === 1 ? 'created' : 'updated';

        await connection.query(
          `INSERT INTO adein_lead_analysis_events (
            lead_id, source_ref, priority, status, summary, next_action, suggested_followup_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            lead_id = VALUES(lead_id), priority = VALUES(priority), status = VALUES(status),
            summary = VALUES(summary), next_action = VALUES(next_action), suggested_followup_at = VALUES(suggested_followup_at)`,
          [leadId, sourceRef, lead.priority, lead.status, lead.summary, lead.nextAction, lead.suggestedFollowupAt],
        );

        if (appointment) {
          await connection.query(
            `INSERT INTO adein_lead_appointments (
              lead_id, appointment_date, appointment_time, property_interest, status, source_ref
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [leadId, appointment.date, appointment.time || null, appointment.property, appointment.status, sourceRef],
          );
        }

        await connection.query(
          `INSERT INTO adein_processed_files (source_ref, content_hash) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash)`,
          [sourceRef, `source-ref:${sourceRef}`],
        );

        await connection.commit();
        return { leadId, action, lead };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
    async saveAppointment({ leadId, date, time }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Fecha de cita inválida');
      if (time && !/^\d{2}:\d{2}$/.test(String(time))) throw new Error('Hora de cita inválida');
      await connection.beginTransaction();
      try {
        const [updated] = await connection.query(
          `UPDATE adein_leads SET status = 'Cita agendada', next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [`Confirmar cita el ${date}${time ? ` a las ${time}` : ''}.`, leadId],
        );
        if (updated.affectedRows !== 1) throw new Error('Prospecto no encontrado');
        await connection.query(
          `INSERT INTO adein_lead_appointments (lead_id, appointment_date, appointment_time, property_interest, status, source_ref)
           SELECT id, ?, ?, property_interest, 'Agendada', 'crm_manual' FROM adein_leads WHERE id = ?`,
          [date, time || null, leadId],
        );
        await connection.commit();
        return { ok: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
    async saveReminder({ leadId, days }) {
      const validDays = new Set([1, 3, 7]);
      if (!validDays.has(Number(days))) throw new Error('Recordatorio no permitido');
      const followupAt = new Date();
      followupAt.setDate(followupAt.getDate() + Number(days));
      const date = followupAt.toISOString().slice(0, 10);
      const [updated] = await connection.query(
        `UPDATE adein_leads SET suggested_followup_at = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [date, `Enviar mensaje de seguimiento el ${date}.`, leadId],
      );
      if (updated.affectedRows !== 1) throw new Error('Prospecto no encontrado');
      return { ok: true, followupAt: date };
    },
  };
}
