/**
 * Query string for the audit log route. The backend reads `type` as a list
 * and wants one `type=` key per value; the generated API client joins an
 * array into a single "A,B,C" value that matches nothing, so the request is
 * built here.
 */
export function auditQueryString(params: {
  limit: number;
  before?: string;
  user?: string;
  type?: string[];
}) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  if (params.before) query.set("before", params.before);
  if (params.user) query.set("user", params.user);
  for (const type of params.type ?? []) query.append("type", type);
  return query.toString();
}
