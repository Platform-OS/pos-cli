// platformos.uploads.push tool - upload property uploads ZIP to S3
import fs from 'fs';
import path from 'path';
import normalize from 'normalize-path';

import Gateway from '../../lib/proxy.js';
import { presignUrl } from '../../lib/presignUrl.js';
import { uploadFile } from '../../lib/s3UploadFile.js';
import { resolveAuth, runWithAuth } from '../auth.js';

const uploadsPushTool = {
  description: 'Upload a ZIP file containing property uploads to platformOS instance. The ZIP should contain files referenced by upload-type properties.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['env', 'filePath'],
    properties: {
      env: { type: 'string', description: 'Environment name' },
      filePath: { type: 'string', description: 'Path to ZIP file with uploads' }
    }
  },
  handler: async (params, ctx = {}) => {
    const startedAt = new Date().toISOString();

    try {
      const auth = await resolveAuth(params, ctx);

      // Resolve file path
      const filePath = path.resolve(params.filePath);

      if (!fs.existsSync(filePath)) {
        return {
          ok: false,
          error: { code: 'FILE_NOT_FOUND', message: `File not found: ${normalize(filePath)}` }
        };
      }

      // Get instance ID
      const GatewayCtor = ctx.Gateway || Gateway;
      const gateway = new GatewayCtor({ url: auth.url, token: auth.token, email: auth.email });
      const instance = await gateway.getInstance();
      const instanceId = instance.id;

      // Build S3 path for property uploads
      const s3Path = `instances/${instanceId}/property_uploads/data.public_property_upload_import.zip`;

      // Get presigned URL and upload (allow injection for testing)
      const presignUrlFn = ctx.presignUrl || presignUrl;
      const uploadFileFn = ctx.uploadFile || uploadFile;

      const { uploadUrl, accessUrl } = await runWithAuth(auth, () => presignUrlFn(s3Path, filePath));
      await uploadFileFn(filePath, uploadUrl);

      return {
        ok: true,
        data: {
          instanceId,
          filePath,
          accessUrl
        },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    } catch (e) {
      return {
        ok: false,
        error: { code: 'UPLOAD_FAILED', message: String(e.message || e) },
        meta: {
          startedAt,
          finishedAt: new Date().toISOString()
        }
      };
    }
  }
};

export default uploadsPushTool;
