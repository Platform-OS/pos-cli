import fs from 'fs';
import path from 'path';
import mime from 'mime';
import { apiRequest } from './apiRequest.js';

const uploadError = (status, reason) =>
  Object.assign(
    new Error(`Upload failed with status ${status}${reason ? `: ${reason}` : ''}`),
    { statusCode: status }
  );

// S3 puts the diagnosis in an XML body -- SignatureDoesNotMatch, RequestTimeTooSkewed,
// EntityTooLarge -- which the status alone hides and the raw fetch here used to discard.
// Read loosely on purpose: it is a courtesy, and a body that does not parse must not cost
// the status that did.
const s3Reason = (body) => {
  if (typeof body !== 'string') return null;

  const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
  const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];

  return [code, message].filter(Boolean).join(': ') || null;
};

/**
 * Object storage is not the platformOS API, and ServerError's messages are written about
 * the latter: a 403 from a presigned policy means the signature expired, not that the
 * operator's pos-cli token is wrong, and `pos-cli env refresh-token` would send them
 * after the wrong credential entirely. So an HTTP answer from S3 is re-thrown as an
 * upload error -- carrying the status watch.js already reads to re-sign and retry.
 *
 * A transport failure is a different thing: a refused connection or a name that does not
 * resolve is not S3 answering at all, and ServerError explains those correctly whatever
 * the host was. Those pass through untouched.
 */
const asUploadError = (error) =>
  error?.name === 'StatusCodeError'
    ? uploadError(error.statusCode, s3Reason(error.response?.body))
    : error;

// Opened, not read: a Blob streams from disk, which is what lets a slow upload outlive
// undici's request timeout. See buildFormData in lib/apiRequest.js.
const openFile = async (filePath) => ({
  blob: await fs.openAsBlob(filePath),
  contentType: mime.getType(filePath)
});

// `timeout` is opt-in: a deadline on a transfer is a bet on the operator's bandwidth, and one
// low enough to catch a dead socket would fail a slow upload that was working. A transfer that
// stalls is still ended by undici's own timeout.
const uploadFile = async (fileName, s3Url, { timeout } = {}) => {
  const { blob, contentType } = await openFile(fileName);

  try {
    await apiRequest({
      method: 'PUT',
      uri: s3Url,
      headers: {
        'Content-Length': blob.size.toString(),
        'Content-Type': contentType
      },
      body: blob,
      json: false,
      timeout
    });
  } catch (error) {
    throw asUploadError(error);
  }

  return s3Url;
};

const uploadFileFormData = async (filePath, data, { timeout } = {}) => {
  const { blob, contentType } = await openFile(filePath);
  const formData = new FormData();

  Object.entries(data.fields).forEach(([k, v]) => formData.append(k, v));
  if (!data.fields['Content-Type']) formData.append('Content-Type', contentType);

  // S3 expands this into the ${filename} placeholder in the presigned key, so it
  // must be the basename even when the caller passes an OS-native path.
  formData.append('file', new File([blob], path.basename(filePath), { type: contentType }));

  try {
    // The FormData goes through as built: its field order and the file's name are part of
    // what the policy signed.
    await apiRequest({ method: 'POST', uri: data.url, formData, json: false, timeout });
  } catch (error) {
    throw asUploadError(error);
  }

  return true;
};

export { uploadError, uploadFile, uploadFileFormData };
