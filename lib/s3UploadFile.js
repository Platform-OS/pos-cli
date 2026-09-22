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

/**
 * `timeout` is opt-in and off by default, unlike the JSON calls around it. A deadline on a
 * transfer is a bet on the operator's bandwidth: the same 50MB archive is twenty seconds
 * on an office line and twenty minutes on hotel wifi, and a ceiling low enough to catch a
 * dead socket would fail the slow upload that was working. Callers who know their payload
 * is small can set one.
 */
const uploadFile = async (fileName, s3Url, { timeout } = {}) => {
  const stats = fs.statSync(fileName);
  const fileBuffer = fs.readFileSync(fileName);
  const contentType = mime.getType(fileName);

  try {
    await apiRequest({
      method: 'PUT',
      uri: s3Url,
      headers: {
        'Content-Length': stats['size'].toString(),
        'Content-Type': contentType
      },
      body: fileBuffer,
      json: false,
      timeout
    });
  } catch (error) {
    throw asUploadError(error);
  }

  return s3Url;
};

const uploadFileFormData = async (filePath, data, { timeout } = {}) => {
  const formData = new FormData();

  Object.entries(data.fields).forEach(([k, v]) => {
    formData.append(k, v);
  });

  const fileBuffer = fs.readFileSync(filePath);
  const contentType = mime.getType(filePath);

  if (!data.fields['Content-Type']) {
    formData.append('Content-Type', contentType);
  }

  // S3 expands this into the ${filename} placeholder in the presigned key, so it
  // must be the basename even when the caller passes an OS-native path.
  const fileName = path.basename(filePath);
  formData.append('file', new File([fileBuffer], fileName, { type: contentType }));

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
