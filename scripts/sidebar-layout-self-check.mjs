import assert from 'node:assert/strict';
import { getSidebarMode } from '../src/lib/sidebarLayout.mjs';

assert.equal(getSidebarMode(false), 'expanded');
assert.equal(getSidebarMode(true), 'collapsed');
console.log(JSON.stringify({ ok: true, checks: ['sidebar_modes'] }));
