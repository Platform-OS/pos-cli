import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Download URLs are frequently presigned S3 links whose query string carries the
 * signature. Strip it before putting a URL in an error message.
 */
const safeUrl = (url) => {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return url;
  }
};

/**
 * Downloads `url` to `fileName`.
 *
 * Rejects on any non-2xx response instead of writing the error body to disk: an
 * expired presigned URL answers 403 with an XML body, and silently saving that as
 * a .zip turned an auth failure into a corrupt-archive error further down.
 *
 * Rejections carry `statusCode` so callers can distinguish 404 from other failures.
 *
 * `signal` is optional and unset for every module download, which keeps those on fetch's own
 * 300 s cap as before. A caller that would rather fail early than wait that long — an
 * interactive wizard, say — passes `AbortSignal.timeout(ms)`; the abort reaches the body
 * stream too, so a connection that dies mid-transfer rejects rather than hanging.
 */
const downloadFile = async (url, fileName, { signal } = {}) => {
  let response;

  try {
    response = await fetch(url, { signal }); // follows redirects, and caps the chain itself
  } catch (error) {
    // Wrapped rather than rethrown: fetch's own message can echo the whole signed URL,
    // and `cause` keeps the network error code reachable (see ServerError).
    throw new Error(`Download failed for ${safeUrl(url)}: ${error.cause?.message ?? error.message}`, {
      cause: error
    });
  }

  if (!response.ok) {
    const error = new Error(`Download failed with HTTP ${response.status}: ${safeUrl(url)}`);
    error.statusCode = response.status;
    throw error;
  }

  // pipeline (unlike pipe) forwards source errors, so a connection dropped mid-download
  // rejects instead of leaving this promise pending forever.
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(fileName));
};

export default downloadFile;
