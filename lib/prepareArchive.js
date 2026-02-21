import fs from 'fs';
import shell from 'shelljs';
import { ZipFile } from 'yazl';
import logger from './logger.js';
import { fillInTemplateValues } from './templates.js';

const prepareDestination = path => {
  shell.mkdir('-p', 'tmp');
  shell.rm('-rf', path);
};

const prepareArchive = (outputPath, verbose = false) => {
  let numberOfFiles = 0;
  prepareDestination(outputPath);

  const zipFile = new ZipFile();
  const output = fs.createWriteStream(outputPath);

  const done = new Promise((resolve, reject) => {
    output.on('close', () => {
      if (verbose) {
        const sizeInMB = output.bytesWritten / 1024 / 1024;
        logger.Info(`Archive size: ${sizeInMB.toFixed(2)} MB at ${outputPath}`);
      }
      resolve(numberOfFiles);
    });
    output.on('error', reject);
    zipFile.outputStream.on('error', reject);
  });

  zipFile.outputStream.pipe(output);

  const addFile = (realPath, nameInArchive) => {
    numberOfFiles++;
    zipFile.addFile(realPath, nameInArchive, { compress: true });
  };

  const addBuffer = (buffer, nameInArchive) => {
    numberOfFiles++;
    zipFile.addBuffer(buffer, nameInArchive, { compress: true });
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
    zipFile.end();
  };

  return { addFile, addBuffer, appendTemplated, finalize, done };
};

export default prepareArchive;
