import { DestructiveChangeError, PortalAuthError } from './portalClient.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// A provision has settled when the worker released the lock and left 'initializing'.
// 'ownership_verification_pending' / 'ssl_validation_pending' are settled-and-expected
// pre-cutover: the target waits for the customer's registrar/DNS changes.
// `!status.locked` (not `=== false`): tolerate a portal that omits the field rather
// than polling every apply to the full timeout (TASK-1.15).
const settled = (status) => !!status && !status.locked && status.status !== 'initializing';

// Poll-failure tolerance: a single 5xx blip mid-provision must not fail the domain,
// but a portal that keeps erroring has to surface instead of silently spinning to the
// timeout and reporting a provisioning status that was never actually observed.
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

const pollUntilSettled = async (client, domainName, instanceUuid, { pollIntervalMs, timeoutMs, onProgress }) => {
  const startedAt = Date.now();
  let lastSeen = null;
  let consecutiveErrors = 0;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastSeen = await client.getDomain(domainName, instanceUuid);
      consecutiveErrors = 0;
    } catch (error) {
      // Lost auth affects every remaining poll and domain — abort the whole apply.
      if (error instanceof PortalAuthError) throw error;
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        return { status: lastSeen, stillProcessing: true, pollError: error.message };
      }
    }
    if (settled(lastSeen)) return { status: lastSeen, stillProcessing: false };
    onProgress(domainName, lastSeen);
    await sleep(pollIntervalMs);
  }
  return { status: lastSeen, stillProcessing: true };
};

// Applies transform plans against the target portal, sequentially — every accepted POST
// enqueues a provision worker on the portal, so multiple domains must not stampede the queue.
// confirm_destructive is only ever sent when the operator explicitly passed the flag.
const applyPlans = async ({
  client,
  plans,
  confirmDestructive = false,
  wait = true,
  pollIntervalMs = 5000,
  timeoutMs = 120000,
  interPostDelayMs = 500,
  onProgress = () => {}
}) => {
  const results = [];
  let firstPost = true;

  for (const plan of plans) {
    if (plan.skipped) {
      results.push({ domainName: plan.domainName, status: 'skipped', serverMessage: plan.skipReason });
      continue;
    }
    if (plan.errors.length || !plan.payload) {
      results.push({ domainName: plan.domainName, status: 'invalid', serverMessage: plan.errors.join('; ') });
      continue;
    }

    if (!firstPost && interPostDelayMs) await sleep(interPostDelayMs);
    firstPost = false;

    const payload = confirmDestructive ? { ...plan.payload, confirm_destructive: true } : plan.payload;

    let response;
    try {
      response = await client.upsertDomain(payload);
    } catch (error) {
      if (error instanceof DestructiveChangeError) {
        results.push({ domainName: plan.domainName, status: 'blocked-destructive', serverMessage: error.message });
      } else {
        results.push({ domainName: plan.domainName, status: 'error', serverMessage: error.message });
      }
      continue;
    }

    const result = {
      domainName: plan.domainName,
      status: 'applied',
      serverMessage: response && response.message,
      requestedStatus: response?.data?.status
    };

    if (wait) {
      const polled = await pollUntilSettled(client, plan.domainName, plan.payload.instance_uuid, {
        pollIntervalMs,
        timeoutMs,
        onProgress
      });
      result.finalStatus = polled.status?.status;
      result.finalSubstatus = polled.status?.substatus;
      result.stillProcessing = polled.stillProcessing;
      result.domainStatus = polled.status;

      // The POST is accepted immediately; the actual provisioning runs in a worker.
      // Its outcome lands in last_operation_status — surface failures instead of
      // letting an accepted-but-failed apply masquerade as success.
      const lastOperation = polled.status?.last_operation_status;
      if (lastOperation?.operation === 'apply' && ['failed', 'blocked'].includes(lastOperation.status)) {
        result.status = lastOperation.status === 'blocked' ? 'blocked-destructive' : 'apply-failed';
        result.serverMessage = [].concat(lastOperation.message || []).join(' ');
      }

      // Polling that kept failing means the provisioning outcome was never observed —
      // report an error instead of an 'applied' success the exit code would then hide.
      if (polled.pollError) {
        result.status = 'error';
        result.serverMessage = `apply was accepted, but polling the provisioning status failed: ${polled.pollError} — check \`pos-cli dns status\``;
      }
    }

    results.push(result);
  }

  return { results };
};

// Fresh target statuses drive the cutover instructions (NS to set at the registrar /
// verification records to create). applyPlans already captured them while polling;
// a domain applied with --no-wait needs a fresh fetch instead — independent reads,
// so they run concurrently (unlike the deliberately sequential POSTs above). Shared by
// dns migrate and dns import so both compute cutover instructions the same way (TASK-1.23).
const collectAppliedTargetStatuses = (client, targetUuid, results) =>
  Promise.all(
    results
      .filter(result => result.status === 'applied')
      .map(result => result.domainStatus || client.getDomain(result.domainName, targetUuid).catch(() => null))
  );

export { applyPlans, collectAppliedTargetStatuses };
