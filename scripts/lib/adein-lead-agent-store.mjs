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
        phoneNormalized: row.phone_normalized,
        property: row.property_interest,
        status: row.status,
        seller: row.seller_name,
        lastContact: new Date(row.updated_at).toISOString(),
        nextAction: row.next_action,
        intentionLevel: row.priority,
        commercialStage: row.commercial_stage || row.status,
        contactState: row.contact_state || 'Activo',
        budget: row.budget_text,
        summary: row.summary,
        stageReason: row.stage_reason,
        detectedSignals: row.detected_signals,
        missingInformation: row.missing_information,
        suggestedMessage: row.suggested_message,
        paymentPreference: row.payment_preference,
      }));
    },
    async listAppointments() {
      const [rows] = await connection.query(
        `SELECT a.id, a.lead_id, l.name, a.appointment_date, a.appointment_time, a.property_interest, a.status
         FROM adein_lead_appointments a JOIN adein_leads l ON l.id = a.lead_id
         ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id ASC`,
      );
      return rows.map((row) => ({ id: String(row.id), leadId: String(row.lead_id), buyerName: row.name, date: String(row.appointment_date).slice(0, 10), time: row.appointment_time ? String(row.appointment_time).slice(0, 5) : '', property: row.property_interest, status: row.status }));
    },
    async getLeadByPhone(phoneNormalized) {
      const [rows] = await connection.query(
        'SELECT * FROM adein_leads WHERE phone_normalized = ?',
        [phoneNormalized]
      );
      return rows.length > 0 ? rows[0] : null;
    },
    async getAnalysisHistory(leadId) {
      const [rows] = await connection.query(
        `SELECT id, source_ref, conducted_at, before_snapshot, after_snapshot, changed_fields
         FROM adein_commercial_analysis_history
         WHERE lead_id = ?
         ORDER BY conducted_at DESC
         LIMIT 20`,
        [leadId]
      );
      return rows.map(r => ({
        id: String(r.id),
        sourceRef: r.source_ref,
        conductedAt: r.conducted_at,
        before: r.before_snapshot,
        after: r.after_snapshot,
        changedFields: r.changed_fields,
      }));
    },
    async saveIngestion(record) {
      const { lead, appointment, sourceRef, meta } = record;
      await connection.beginTransaction();
      try {
        // Fetch existing lead for before snapshot
        const [priorRows] = await connection.query(
          'SELECT * FROM adein_leads WHERE phone_normalized = ?',
          [lead.phoneNormalized]
        );
        const priorLead = priorRows.length > 0 ? priorRows[0] : null;

        const commercialStage = meta?.commercialStage || lead.status || 'Nuevo';
        const contactState = meta?.contactState || 'Activo';
        const stageReason = meta?.stageReason || '';
        const detectedSignals = meta?.detectedSignals ? JSON.stringify(meta.detectedSignals) : null;
        const missingInformation = meta?.missingInformation ? JSON.stringify(meta.missingInformation) : null;
        const paymentPreference = meta?.paymentPreference || 'Por confirmar';
        const suggestedMessage = meta?.suggestedMessage || null;
        const nextActionType = meta?.nextActionType || 'SEGUIMIENTO';

        const [leadResult] = await connection.query(
          `INSERT INTO adein_leads (
            phone_normalized, phone_original, name, seller_name, property_interest, budget_text,
            payment_preference, priority, status, commercial_stage, contact_state, summary,
            stage_reason, detected_signals, missing_information,
            next_action, suggested_message, suggested_followup_at, review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            phone_original = VALUES(phone_original),
            name = VALUES(name),
            seller_name = VALUES(seller_name),
            property_interest = VALUES(property_interest),
            budget_text = VALUES(budget_text),
            payment_preference = VALUES(payment_preference),
            priority = VALUES(priority),
            status = VALUES(status),
            commercial_stage = VALUES(commercial_stage),
            contact_state = VALUES(contact_state),
            summary = VALUES(summary),
            stage_reason = VALUES(stage_reason),
            detected_signals = VALUES(detected_signals),
            missing_information = VALUES(missing_information),
            next_action = VALUES(next_action),
            suggested_message = VALUES(suggested_message),
            suggested_followup_at = VALUES(suggested_followup_at),
            review_status = VALUES(review_status),
            updated_at = CURRENT_TIMESTAMP`,
          [
            lead.phoneNormalized, lead.phoneOriginal, lead.name, lead.seller, lead.property, lead.budget,
            paymentPreference, lead.priority, lead.status, commercialStage, contactState, lead.summary,
            stageReason, detectedSignals, missingInformation,
            lead.nextAction, suggestedMessage, lead.suggestedFollowupAt, lead.reviewStatus,
          ],
        );
        const leadId = Number(leadResult.insertId);
        const action = priorLead ? 'updated' : 'created';

        // Save analysis event
        await connection.query(
          `INSERT INTO adein_lead_analysis_events (
            lead_id, source_ref, priority, status, commercial_stage, contact_state,
            summary, stage_reason, detected_signals, missing_information,
            next_action, suggested_message, suggested_followup_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [leadId, sourceRef, lead.priority, lead.status, commercialStage, contactState,
           lead.summary, stageReason, detectedSignals, missingInformation,
           lead.nextAction, suggestedMessage, lead.suggestedFollowupAt],
        );

        // Save commercial analysis history (before/after snapshots)
        const beforeSnapshot = priorLead ? {
          name: priorLead.name,
          priority: priorLead.priority,
          status: priorLead.status,
          commercialStage: priorLead.commercial_stage || priorLead.status,
          contactState: priorLead.contact_state || 'Activo',
          property: priorLead.property_interest,
          budget: priorLead.budget_text,
          nextAction: priorLead.next_action,
        } : null;

        const afterSnapshot = {
          name: lead.name,
          priority: lead.priority,
          status: lead.status,
          commercialStage,
          contactState,
          property: lead.property,
          budget: lead.budget,
          nextAction: lead.nextAction,
        };

        const changedFields = priorLead
          ? Object.keys(afterSnapshot).filter(k => {
              const b = beforeSnapshot?.[k];
              const a = afterSnapshot[k];
              return JSON.stringify(b) !== JSON.stringify(a);
            })
          : [];

        await connection.query(
          `INSERT INTO adein_commercial_analysis_history (
            lead_id, source_ref, before_snapshot, after_snapshot, changed_fields
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            leadId, sourceRef,
            beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
            JSON.stringify(afterSnapshot),
            changedFields.length > 0 ? JSON.stringify(changedFields) : null,
          ],
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
        return {
          leadId, action, lead,
          before: beforeSnapshot,
          after: afterSnapshot,
          changedFields,
          meta: record.meta || null,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
    async saveAppointment({ leadId, buyerName, date, time }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Fecha de cita inválida');
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
      );
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      if (date < today) throw new Error('No se pueden agendar citas en el pasado');
      if (time && !/^\d{2}:\d{2}$/.test(String(time))) throw new Error('Hora de cita inválida');
      const name = String(buyerName ?? '').trim();
      if (!name) throw new Error('Nombre del comprador requerido');
      await connection.beginTransaction();
      try {
        const [updated] = await connection.query(
          `UPDATE adein_leads SET name = ?, status = 'Cita agendada', next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [name, `Confirmar cita el ${date}${time ? ` a las ${time}` : ''}.`, leadId],
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
    async completeAppointment({ appointmentId }) {
      await connection.beginTransaction();
      try {
        const [rows] = await connection.query('SELECT lead_id FROM adein_lead_appointments WHERE id = ?', [appointmentId]);
        if (rows.length !== 1) throw new Error('Cita no encontrada');
        await connection.query("UPDATE adein_lead_appointments SET status = 'Realizada' WHERE id = ?", [appointmentId]);
        await connection.query("UPDATE adein_leads SET next_action = 'Registrar resultado de la cita.', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rows[0].lead_id]);
        await connection.commit();
        return { ok: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
  };
}
