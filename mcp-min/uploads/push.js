// platformos.uploads.push tool - upload property uploads ZIP to S3
import fs from 'fs';
import path from 'path';
import normalize from 'normalize-path';

import Gateway from '../../lib/proxy.js';
import { presignUrl } from '../../lib/presignUrl.js';
import { uploadFile } from '../../lib/s3UploadFile.js';
import { resolveAuth, runWithAuth } from '../auth.js';
import { authProperties } from '../schemas/auth.js';
import { ToolError, classify } from '../tool-error.js';

const uploadsPushTool = {
  description: 'Upload a ZIP of the files that upload-type properties on an instance refer to.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['filePath'],
    properties: {
      ...authProperties,
      filePath: { type: 'string', description: 'ZIP holding the files.' }
    }
  },
  handler: async (params, ctx = {}) => {
    const auth = await resolveAuth(params, ctx);

    const filePath = path.resolve(params.filePath);
    if (!fs.existsSync(filePath)) {
      throw ToolError.not_found('FILE_NOT_FOUND', `File not found: ${normalize(filePath)}`, { filePath: normalize(filePath) });
    }

    const GatewayCtor = ctx.Gateway || Gateway;
    const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });
    const instance = await gateway.getInstance();
    const instanceId = instance.id;

    const s3Path = `instances/${instanceId}/property_uploads/data.public_property_upload_import.zip`;

    // Injectable for tests.
    const presignUrlFn = ctx.presignUrl || presignUrl;
    const uploadFileFn = ctx.uploadFile || uploadFile;

    // Which leg failed is something only this tool knows: the invoker sees one thrown error and
    // cannot tell a refused presign from a refused upload, so the code names the upload. The kind
    // is `classify`'s, not this tool's — it used to call anything without a status `unavailable`,
    // which told the caller a TypeError of ours was worth retrying.
    let uploadUrl, accessUrl;
    try {
      ({ uploadUrl, accessUrl } = await runWithAuth(auth, () => presignUrlFn(s3Path, filePath)));
      await uploadFileFn(filePath, uploadUrl);
    } catch (e) {
      if (e instanceof ToolError) throw e;
      throw new ToolError(classify(e).kind, 'UPLOAD_FAILED', String(e?.message || e), { filePath: normalize(filePath) });
    }

    return { instanceId, filePath, accessUrl };
  }
};

export default uploadsPushTool;
