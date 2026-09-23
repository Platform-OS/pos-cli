/**
 * Statuses that settle nothing: the server, or a proxy in front of it, is there but is
 * asking to be asked again. 408 Request Timeout, 425 Too Early, 429 Too Many Requests,
 * and every 5xx.
 *
 * One list, because every client path has to read it the same way. The Partner Portal
 * client (lib/utils/partnerPortal.js) and the CDN poll that waits for an uploaded assets
 * archive to be unpacked (lib/assets.js) both decide "ask again" against it, and a status
 * treated as transient by one and final by the other is a deploy that fails in a way
 * nobody can reproduce.
 *
 * 401/403/404 are deliberately not here: those are the server deciding, which is an answer.
 */
const TRANSIENT_STATUSES = [408, 425, 429];

const isTransientStatus = (status) => status >= 500 || TRANSIENT_STATUSES.includes(status);

export { TRANSIENT_STATUSES, isTransientStatus };
