/**
 * Catalogue index: collects every feature catalogue into one list.
 *
 * The order of the modules here defines the order of the folders in the Postman
 * collection and the order of the feature sheets in the Integration Test report.
 */
const modules = [
  require('./01-authentication'),
  require('./02-onboarding-survey'),
  require('./03-dashboard-routine'),
  require('./04-tracking-progress'),
  require('./05-pose-ai-support'),
  require('./06-library'),
  require('./07-admin'),
  require('./08-content-management'),
];

const all = modules.flat();

const seen = new Set();
for (const e of all) {
  if (seen.has(e.id)) throw new Error(`Duplicate catalogue id: ${e.id}`);
  seen.add(e.id);
}

module.exports = { modules, all };
