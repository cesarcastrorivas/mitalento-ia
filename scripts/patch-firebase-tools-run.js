/**
 * Patch firebase-tools to fix Cloud Run 409 conflict during hosting finalization.
 *
 * Bug: firebase-tools sends a PUT to Cloud Run keeping spec.template.metadata.name
 * set to the current revision name. Cloud Run rejects this with 409 because that
 * revision already exists with different configuration (the new traffic tag).
 *
 * Fix: delete spec.template.metadata.name before the PUT so Cloud Run
 * auto-generates a new revision name.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'firebase-tools',
  'lib',
  'gcp',
  'run.js'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch-firebase-tools-run] firebase-tools not found, skipping.');
  process.exit(0);
}

const original = fs.readFileSync(filePath, 'utf8');

const needle = `async function updateService(name, service) {
    delete service.status;
    service = await exports.replaceService(name, service);`;

const replacement = `async function updateService(name, service) {
    delete service.status;
    // Patched: remove template name to avoid 409 conflict with existing revision
    if (service.spec?.template?.metadata?.name) {
        delete service.spec.template.metadata.name;
    }
    service = await exports.replaceService(name, service);`;

if (original.includes('delete service.spec.template.metadata.name')) {
  console.log('[patch-firebase-tools-run] Already patched.');
  process.exit(0);
}

if (!original.includes(needle)) {
  console.log('[patch-firebase-tools-run] Could not find target code. firebase-tools may have been updated — check if the bug is fixed upstream.');
  process.exit(0);
}

fs.writeFileSync(filePath, original.replace(needle, replacement), 'utf8');
console.log('[patch-firebase-tools-run] Patched successfully.');
