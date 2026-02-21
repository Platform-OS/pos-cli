import fs from 'fs';
import shell from 'shelljs';
import archiver from 'archiver';
import logger from './logger.js';
import { fillInTemplateValues } from './templates.js';

const prepareDestination = path => {
  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);
};

const prepareArchive = (outputPath, verbose = false) => {
  let numberOfFiles = 0;
  prepareDestination(outputPath);

  const output = fs.createWriteStream(outputPath);
  const zip = archiver('zip', { zlib: { level: 6 }, zip64: false });

  const done = new Promise((resolve, reject) => {
    output.on('close', () => {
      if (verbose) {
        const sizeInMB = zip.pointer() / 1024 / 1024;
        logger.Info(`Archive size: ${sizeInMB.toFixed(2)} MB at ${outputPath}`);
      }
      resolve(numberOfFiles);
    });
    output.on('error', reject);
    zip.on('error', reject);
  });

  zip.on('warning', err => {
    if (err.code === 'ENOENT') {
      logger.Debug(err);
      logger.Error('Archive creation failed.');
    } else {
      throw err;
    }
  });

  zip.pipe(output);

  const addFile = (realPath, nameInArchive) => {
    numberOfFiles++;
    zip.file(realPath, { name: nameInArchive });
  };

  const addBuffer = (buffer, nameInArchive) => {
    numberOfFiles++;
    zip.append(buffer, { name: nameInArchive });
  };

  const appendTemplated = (realPath, nameInArchive, templateData) => {
    const result = fillInTemplateValues(realPath, templateData);
    if (typeof result === 'string') {
      addBuffer(Buffer.from(result), nameInArchive);
    } else {
      result.destroy();
      addFile(realPath, nameInArchive);
    }
  };

  const finalize = () => {
    zip.finalize();
  };

  return { addFile, addBuffer, appendTemplated, finalize, done };
};

export default prepareArchive;
