import client from './client';

/**
 * The audit trail. Reads only — there is no create, update or delete here
 * because the API has none to offer: an entry is written by the request it
 * describes, and the database refuses any amendment to one.
 */

/**
 * @param {object} params  page, limit, search, from, to, sort, and
 *        `filter[action]` / `filter[module]` / `filter[actor_id]` for the
 *        dropdowns. `company_id` narrows a platform administrator to one
 *        company and is ignored for everybody else, who only ever see their own.
 */
export const listAuditLogs = (params) => client.get('/audit-logs', { params }).then((r) => r.data);

/** One entry in full, including the redacted detail of what was asked for. */
export const getAuditLog = (id) => client.get(`/audit-logs/${id}`).then((r) => r.data?.data);

/** The actions, modules and actors that actually occur within the caller's scope. */
export const getAuditFilters = (params) => client.get('/audit-logs/filters', { params }).then((r) => r.data?.data);
