import fs from 'fs';
import path from 'path';
import mime from 'mime';

const uploadFile = async (fileName, s3Url) => {
  const stats = fs.statSync(fileName);
  const fileBuffer = fs.readFileSync(fileName);

  const response = await fetch(s3Url, {
    method: 'PUT',
    headers: {
      'Content-Length': stats['size'].toString()
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

  formData.append('Content-Type', mime.getType(filePath));

  const fileBuffer = fs.readFileSync(filePath);
  formData.append('file', new Blob([fileBuffer]), path.basename(filePath));

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
