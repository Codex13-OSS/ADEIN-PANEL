import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const header = await fs.readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
assert.match(header, /showLogout\?: boolean/);
assert.match(header, /showLogout && <button className="btn-outline" onClick=\{onLogout\}>Cerrar sesión<\/button>/);

const shell = await fs.readFile(new URL('../src/components/Shell.tsx', import.meta.url), 'utf8');
assert.match(shell, /showLogout=\{section !== 'documents'\}/);

const sidebar = await fs.readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(sidebar, /label: 'Campañas'|label: 'Vendedores'|label: 'Configuración'/);
assert.doesNotMatch(shell, /CampaignsPage|SellersPage|SettingsPage/);

const crm = await fs.readFile(new URL('../src/pages/CrmPage.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(crm, /Restablecer CRM|Ejecutar acción mock|Crear seguimiento|Copiar mensaje sugerido/);
assert.match(crm, /\{ key: 'prospectos', label: 'Prospectos' \}/);
assert.match(crm, /\{ key: 'whatsapp', label: 'Analizar WhatsApp' \}/);

console.log(JSON.stringify({ ok: true, checks: ['documents_hides_outer_logout'] }));
