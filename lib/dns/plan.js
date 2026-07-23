import chalk from 'chalk';
import table from 'text-table';

const recordRow = (marker, record, note = '') => [
  `  ${marker}`,
  record.name || '@',
  record.type,
  String(record.ttl),
  record.records.join(' | ') + (record.proxied ? ' (proxied)' : ''),
  note
];

// Human-readable dry-run plan for one transformed domain.
const renderPlan = (plan) => {
  const lines = [];
  const header = chalk.bold(plan.domainName || '(unknown domain)');

  if (plan.skipped) {
    lines.push(`${header}  ${chalk.gray(`SKIP — ${plan.skipReason}`)}`);
    return lines.join('\n');
  }

  const meta = plan.payload
    ? ` (${plan.payload.setup_type}, default: ${plan.payload.use_as_default ? 'yes' : 'no'}, www-redirect: ${plan.payload.enable_www_redirect ? 'on' : 'off'})`
    : '';
  lines.push(`${header}${chalk.gray(meta)}`);

  const rows = [
    ...plan.kept.map(record => recordRow(chalk.green('KEEP'), record)),
    ...plan.dropped.map(({ record, reason }) => recordRow(chalk.yellow('DROP'), record, chalk.gray(`[${reason}]`)))
  ];
  if (rows.length) lines.push(table(rows));

  for (const warning of plan.warnings) lines.push(chalk.yellow(`  WARN  ${warning}`));
  for (const error of plan.errors) lines.push(chalk.red(`  ERROR ${error}`));

  return lines.join('\n');
};

const renderPlans = (plans) => plans.map(renderPlan).join('\n\n');

const planSummary = (plans) => {
  const active = plans.filter(plan => !plan.skipped);
  return {
    toApply: active.filter(plan => plan.payload).length,
    skipped: plans.length - active.length,
    withErrors: active.filter(plan => plan.errors.length).length,
    records: active.reduce((sum, plan) => sum + plan.kept.length, 0)
  };
};

const renderSummary = (plans) => {
  const summary = planSummary(plans);
  const parts = [
    `${summary.toApply} domain(s) to apply (${summary.records} records)`,
    summary.skipped ? chalk.gray(`${summary.skipped} skipped`) : null,
    summary.withErrors ? chalk.red(`${summary.withErrors} with errors`) : null
  ].filter(Boolean);
  return parts.join(', ');
};

const STATUS_COLORS = {
  applied: chalk.green,
  'apply-failed': chalk.red,
  'blocked-destructive': chalk.yellow,
  skipped: chalk.gray,
  invalid: chalk.red,
  error: chalk.red
};

const renderResults = (results) => {
  const rows = results.map(result => {
    const paint = STATUS_COLORS[result.status] || chalk.white;
    const statusInfo = [
      result.finalStatus,
      result.finalSubstatus,
      result.stillProcessing ? 'still processing…' : null
    ].filter(Boolean).join(' / ');
    const detail = result.status === 'applied' ? (statusInfo || result.serverMessage || '') : (result.serverMessage || statusInfo);
    return [`  ${paint(result.status.toUpperCase())}`, result.domainName, detail || ''];
  });
  return table(rows);
};

export { renderPlan, renderPlans, renderSummary, renderResults, planSummary };
