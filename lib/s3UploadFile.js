const fs = require('fs'),
  axios = require('axios'),
  FormData = require('form-data'),
  mime = require('mime');

const uploadFile = async (fileName, s3Url) => {
  const stats = fs.statSync(fileName);
  const fileStream = fs.createReadStream(fileName);

  try {
    await axios.put(s3Url, fileStream, {
      headers: {
        'Content-Length': stats['size']
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    return s3Url;
  } catch (error) {
    if (error.response) {
      throw error.response.status;
    }
    throw error;
  }
};

const uploadFileFormData = async (filePath, data) => {
  const formData = new FormData();

  // Add all form fields
  Object.entries(data.fields).forEach(([k, v]) => {
    formData.append(k, v);
  });

  // Add file with content type
  formData.append('file', fs.createReadStream(filePath), {
    contentType: mime.getType(filePath)
  });

  try {
    await axios.post(data.url, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    return true;
  } catch (error) {
    if (error.response) {
      throw error.response.status;
    }
    throw error;
  }
};

module.exports = {
  uploadFile: uploadFile,
  uploadFileFormData: uploadFileFormData
};
