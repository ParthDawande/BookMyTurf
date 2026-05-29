import client from './client';

// ── Complaints ────────────────────────────────────────────────────────────────
export const listStaffComplaints = ()           => client.get('/api/staff/complaints');
export const addComplaintNote    = (id, body)   => client.post(`/api/staff/complaints/${id}/notes`, body);
export const resolveComplaint    = (id, body)   => client.post(`/api/staff/complaints/${id}/resolve`, body);

// ── Queries ───────────────────────────────────────────────────────────────────
// Pool: no params (or ?mine=false). Mine: ?mine=true
export const listStaffQueries = (params)      => client.get('/api/staff/queries', { params });
export const claimQuery       = (id)          => client.post(`/api/staff/queries/${id}/claim`);
export const addQueryNote     = (id, body)    => client.post(`/api/staff/queries/${id}/notes`, body);
export const resolveQuery     = (id, body)    => client.post(`/api/staff/queries/${id}/resolve`, body);
