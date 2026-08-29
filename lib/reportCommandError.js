import logger from './logger.js';
import ServerError from './ServerError.js';

/**
 * The one way a command reports a failure it cannot handle.
 *
 * A TwoFactorError already carries a multi-line, actionable message, and it must not be
 * passed to logger.Error as an object: the formatter JSON-encodes an Error's message,
 * turning the line breaks into escaped \n. Network and HTTP failures keep going to
 * ServerError, which knows how to explain a 502 or a refused connection.
 *
 * @param {Error} error
 * @param {{ prefix?: string, exit?: boolean }} options `prefix` names the operation that
 *   failed; `exit` is passed through to logger.Error for callers that keep running.
 */
const reportCommandError = async (error, { prefix, exit = true } = {}) => {
  if (error?.name === 'TwoFactorError') {
    return logger.Error(error.message, { hideTimestamp: true, exit });
  }

  if (ServerError.isNetworkError(error)) return ServerError.handler(error);

  const message = prefix ? `${prefix}: ${error?.message || error}` : error;
  return logger.Error(message, { exit });
};

export { reportCommandError };
