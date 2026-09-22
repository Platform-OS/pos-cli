/**
 * Retry-After, read from wherever the caller keeps its headers — a request-promise error,
 * a fetch Response — since the header itself is the same thing in both.
 *
 * Only the delay-seconds form is read. The HTTP-date form comes back as null, which leaves
 * the caller on its own schedule rather than on a misparsed one.
 */
const parseRetryAfter = (value) => {
  const seconds = Number.parseInt(value, 10);

  return Number.isFinite(seconds) ? seconds : null;
};

/**
 * Retry-After is a hint from a service that is, by hypothesis, not behaving, so callers
 * clamp it rather than obey it: an absurd value must not park a deploy for an hour, and a
 * zero must not turn a retry into a hot loop. The bounds belong to the caller — what is
 * patient for a Partner Portal call is not what is patient for a one-second CDN poll.
 */
const clampRetrySeconds = (seconds, { min, max }) => Math.min(Math.max(seconds, min), max);

export { parseRetryAfter, clampRetrySeconds };
