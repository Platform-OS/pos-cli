import fs from 'fs';
import path from 'path';
import mime from 'mime';

const uploadError = status =>
  Object.assign(new Error(`Upload failed with status ${status}`), { statusCode: status });

const uploadFile = async (fileName, s3Url) => {
  const stats = fs.statSync(fileName);
  const fileBuffer = fs.readFileSync(fileName);
  const contentType = mime.getType(fileName);

  const response = await fetch(s3Url, {
    method: 'PUT',
    headers: {
      'Content-Length': stats['size'].toString(),
      'Content-Type': contentType
    },
    body: fileBuffer
  });

  if (!response.ok) {
    throw uploadError(response.status);
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

  if (!data.fields['Content-Type']) {
    formData.append('Content-Type', contentType);
  }

  // S3 expands this into the ${filename} placeholder in the presigned key, so it
  // must be the basename even when the caller passes an OS-native path.
  const fileName = path.basename(filePath);
  formData.append('file', new File([fileBuffer], fileName, { type: contentType }));

  const response = await fetch(data.url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw uploadError(response.status);
  }

  return true;
};

export { uploadError, uploadFile, uploadFileFormData };
