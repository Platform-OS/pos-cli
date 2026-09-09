import { apiRequest } from './apiRequest.js';
import logger from './logger.js';
import Portal from './portal.js';
import { isSessionLive, portalUrlFor, readSession, sessionInterruptedMessage, startSession } from './twoFactorSession.js';
import { isTwoFactorRequired, TwoFactorError } from './utils/twoFactor.js';
import pkg from '../package.json' with { type: 'json' };
const version = pkg.version;

class Gateway {
  constructor({ url, token, email, partner_portal_url, restartCommand }, client) {
    this.url = url;
    this.api_url = `${url}/api/app_builder`;
    this.private_api_url = `${url}/api/private`;
    this.client = client;
    this.token = token;
    // Kept for the two-factor prompt, which names the account a code is being asked for:
    // this is the same address that goes out as `From:` below.
    this.email = email;
    // Which portal to step up against. An operator's explicit override comes first, then
    // the environment .pos registered this URL under — which is how a private-stack
    // instance finds its own portal even when the caller rebuilt these settings from
    // MARKETPLACE_* variables along the way (sync, push and the GUI server do).
    this.partnerPortalUrl = partner_portal_url || process.env.PARTNER_PORTAL_HOST || portalUrlFor(url) || Portal.url();

    // No Authorization here: the credential is resolved per request by request(), which is
    // the only place that knows whether a two-factor session is standing in for the token.
    this.defaultHeaders = {
      InstanceDomain: url,
      'User-Agent': `pos-cli/${version}`,
      From: email
    };

    // Set only by a caller that must not be prompted where it stands — watch mode, whose
    // queue is mid-flight and whose operator may not be at the keyboard. When it is set, an
    // instance asking for a session ends the run with a message naming this command to run
    // again, instead of stepping up mid-queue. Left unset everywhere else, so every short
    // command keeps stepping up in place and retrying the request that was refused.
    this.restartCommand = restartCommand;

    // Resolved once, not per request: readSession re-reads and re-parses .pos on every
    // call, and a deploy polls its status hundreds of times. Nothing is missed by not
    // re-reading — a step-up below assigns this.session, and one that ages out is handled
    // by authorizationHeader falling back to the token.
    this.session = readSession(url, this.partnerPortalUrl);

    logger.Debug(`Request headers: ${JSON.stringify(this.defaultHeaders, null, 2)}`);
  }

  // The credential to present: a two-factor session when one is in force for this
  // instance, otherwise the long-lived token from .pos. A session that ages out during a
  // long run falls back to the token, which is what makes the instance answer
  // two_factor_required and so drives the step-up below.
  authorizationHeader() {
    const credential = isSessionLive(this.session) ? this.session.token : this.token;
    return { Authorization: `Token ${credential}` };
  }

  // Every Gateway request goes through here so there is exactly one place that knows how
  // to answer an Instance asking for a second factor: step up with the Portal, then retry
  // the request that was refused. Only the two_factor_required body triggers it, so an
  // expired or revoked token still fails as the authentication error it is.
  //
  // It is also where the shared headers are applied, so no caller has to pass them.
  async request(options) {
    const withAuth = () => ({
      ...options,
      headers: { ...this.defaultHeaders, ...options.headers, ...this.authorizationHeader() }
    });

    try {
      return await apiRequest(withAuth());
    } catch (error) {
      if (!isTwoFactorRequired(error)) throw error;

      // this.session is set only if this run ever held one, which is what tells "it aged
      // out under us" apart from "this instance wanted one and we never had it" — the two
      // need different first sentences, and only this side knows which happened.
      if (this.restartCommand) {
        throw new TwoFactorError(
          sessionInterruptedMessage({ command: this.restartCommand, expired: !!this.session })
        );
      }

      this.session = await startSession({
        portalUrl: this.partnerPortalUrl,
        instanceUrl: this.url,
        token: this.token,
        email: this.email
      });

      return apiRequest(withAuth());
    }
  }

  cloneInstanceStatus(id) {
    return this.request({ method: 'GET', uri: `${this.api_url}/instance_clone_imports/${id}` });
  }

  cloneInstanceInit(formData = {}) {
    return this.request({ method: 'POST', uri: `${this.api_url}/instance_clone_imports`, json: formData });
  }

  cloneInstanceExport(formData = {}) {
    return this.request({ method: 'POST', uri: `${this.api_url}/instance_clone_exports`, json: formData });
  }

  appExportStart(formData = {}) {
    return this.request({ method: 'POST', uri: `${this.api_url}/marketplace_releases/backup`, formData });
  }

  appExportStatus(id) {
    return this.request({ uri: `${this.api_url}/marketplace_releases/${id}` });
  }

  dataExportStart(export_internal, csv_import = false) {
    const formData = { export_internal: String(export_internal) };
    let uri = `${this.api_url}/exports`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.request({ method: 'POST', uri, formData });
  }

  dataExportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/exports/${id}`;
    if (csv_import) {
      uri += '?csv_export=true';
    }
    return this.request({ uri });
  }

  dataImportStart(formData) {
    return this.request({ method: 'POST', uri: `${this.api_url}/imports`, json: formData });
  }

  dataImportStatus(id, csv_import = false) {
    let uri = `${this.api_url}/imports/${id}`;
    if (csv_import) {
      uri += '?csv_import=true';
    }
    return this.request({ uri });
  }

  dataUpdate(formData) {
    return this.request({ method: 'POST', uri: `${this.api_url}/data_updates`, formData });
  }

  dataClean(confirmation, include_schema) {
    const uri = `${this.api_url}/data_clean`;
    return this.request({
      method: 'POST',
      uri,
      json: { confirmation, include_schema }
    });
  }

  dataCleanStatus(id) {
    return this.request({ method: 'GET', uri: `${this.api_url}/data_clean/${id}` });
  }

  ping() {
    return this.request({ uri: `${this.api_url}/logs` });
  }

  logs(json, { signal } = {}) {
    // Encoded rather than interpolated raw: the cursor reaches this method from a GUI
    // query string as well as from internal pollers, and an unencoded value could append
    // its own parameters to the request.
    const lastId = encodeURIComponent(json.lastId);
    return this.request({
      uri: `${this.api_url}/logs?last_id=${lastId}`,
      json: true,
      forever: true,
      signal
    });
  }

  logsv2(params) {
    if(params.query) {
      return this.client.searchSQLByQuery(params);
    } else if(params.key) {
      return this.client.searchAround(params);
    } else {
      return this.client.searchSQL(params);
    }
  }

  getInstance() {
    return this.request({ uri: `${this.api_url}/instance` });
  }

  getStatus(id) {
    return this.request({ uri: `${this.api_url}/marketplace_releases/${id}`, forever: true });
  }

  graph(json) {
    return this.request({ method: 'POST', uri: `${this.url}/api/graph`, json, forever: true });
  }

  liquid(json) {
    return this.request({ method: 'POST', uri: `${this.api_url}/liquid_exec`, json, forever: true });
  }

  test(name) {
    return this.request({ uri: `${this.url}/_tests/run.js?name=${name}` });
  }

  testRunAsync() {
    return this.request({ uri: `${this.url}/_tests/run_async` });
  }

  listModules() {
    return this.request({ uri: `${this.api_url}/installed_modules` });
  }

  removeModule(formData) {
    return this.request({ method: 'DELETE', uri: `${this.api_url}/installed_modules`, formData });
  }

  listMigrations() {
    return this.request({ uri: `${this.api_url}/migrations` });
  }

  generateMigration(formData) {
    return this.request({ method: 'POST', uri: `${this.api_url}/migrations`, formData });
  }

  runMigration(formData) {
    return this.request({ method: 'POST', uri: `${this.api_url}/migrations/run`, formData });
  }

  sendManifest(manifest, releaseId) {
    const json = { manifest };
    if (releaseId) json.marketplace_release_id = releaseId;
    return this.request({ method: 'POST', uri: `${this.api_url}/assets_manifest`, json });
  }

  sync(formData) {
    return this.request({
      method: 'PUT',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true
    });
  }

  delete(formData) {
    return this.request({
      method: 'DELETE',
      uri: `${this.api_url}/marketplace_releases/sync`,
      formData,
      forever: true
    });
  }

  push(formData) {
    return this.request({ method: 'POST', uri: `${this.api_url}/marketplace_releases`, formData });
  }
}

export default Gateway;
