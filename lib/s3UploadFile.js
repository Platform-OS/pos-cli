import fs from 'fs';
import mime from 'mime';
import logger from './logger.js';

const uploadFile = async (fileName, s3Url) => {
  const stats = fs.statSync(fileName);
  const fileBuffer = fs.readFileSync(fileName);
  const contentType = mime.getType(fileName);

  logger.Debug(`[s3UploadFile] Direct upload: ${fileName}, size: ${stats.size}, type: ${contentType}`);
  logger.Debug(`[s3UploadFile] Sending to: ${s3Url}`);

  const response = await fetch(s3Url, {
    method: 'PUT',
    headers: {
      'Content-Length': stats['size'].toString(),
      'Content-Type': contentType
    },
    body: fileBuffer
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return s3Url;
};

const uploadFileFormData = async (filePath, data) => {
  const formData = new FormData();

  Object.entries(data.fields).forEach(([k, v]) => {
    formData.append(k, v);
  });

  const fileBuffer = fs.readFileSync(filePath);
  const contentType = mime.getType(filePath);

  logger.Debug(`[s3UploadFile] File: ${filePath}`);
  logger.Debug(`[s3UploadFile] Content-Type from mime: ${contentType}`);
  logger.Debug(`[s3UploadFile] Presigned fields: ${JSON.stringify(data.fields)}`);
  logger.Debug(`[s3UploadFile] Content-Type in presigned fields: ${data.fields['Content-Type']}`);

  formData.append('Content-Type', contentType);

  const fileName = filePath.split('/').pop();
  formData.append('file', new File([fileBuffer], fileName, { type: contentType }));

  logger.Debug(`[s3UploadFile] Sending to presigned URL: ${data.url}`);
  const response = await fetch(data.url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return true;
};

export { uploadFile, uploadFileFormData };
