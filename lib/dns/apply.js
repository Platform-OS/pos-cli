import { DestructiveChangeError } from './portalClient.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// A provision has settled when the worker released the lock and left 'initializing'.
// 'ownership_verification_pending' / 'ssl_validation_pending' are settled-and-expected
// pre-cutover: the target waits for the customer's registrar/DNS changes.
const settled = (status) => status && status.locked === false && status.status !== 'initializing';

const pollUntilSettled = async (client, domainName, instanceUuid, { pollIntervalMs, timeoutMs, onProgress }) => {
  const startedAt = Date.now();
  let lastSeen = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastSeen = await client.getDomain(domainName, instanceUuid).catch(() => null);
    if (settled(lastSeen)) return { status: lastSeen, stillProcessing: false };
    onProgress(domainName, lastSeen);
    await sleep(pollIntervalMs);
  }
  return { status: lastSeen, stillProcessing: true };
};

// Applies transform plans against the target portal, sequentially — every accepted POST
// enqueues a DnsProvisionWorker on the portal, so a cohort must not stampede the queue.
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
    }

    results.push(result);
  }

  return { results };
};

export { applyPlans };
