import client from './client';

// ── Approvals ─────────────────────────────────────────────────────────────────
export const listPendingTurfs     = (params)       => client.get('/api/admin/turfs/pending', { params });
export const approveTurf          = (id)           => client.put(`/api/admin/turfs/${id}/approve`);
export const rejectTurf           = (id, body)     => client.put(`/api/admin/turfs/${id}/reject`, body);
export const listPendingSubCourts = (params)       => client.get('/api/admin/sub-courts/pending', { params });
export const approveSubCourt      = (id)           => client.put(`/api/admin/sub-courts/${id}/approve`);
export const rejectSubCourt       = (id, body)     => client.put(`/api/admin/sub-courts/${id}/reject`, body);

// ── User management ───────────────────────────────────────────────────────────
export const listUsers    = (params)   => client.get('/api/admin/users', { params });
export const suspendUser  = (id)       => client.put(`/api/admin/users/${id}/suspend`);
export const banUser      = (id)       => client.put(`/api/admin/users/${id}/ban`);
export const activateUser = (id)       => client.put(`/api/admin/users/${id}/activate`);

// ── Staff management ──────────────────────────────────────────────────────────
export const listStaff   = (params)   => client.get('/api/admin/staff', { params });
export const createStaff = (body)     => client.post('/api/admin/staff', body);
// Deactivate/activate staff reuse the user suspend/activate endpoints
export const deactivateStaff = (id)  => client.put(`/api/admin/users/${id}/suspend`);
export const reactivateStaff = (id)  => client.put(`/api/admin/users/${id}/activate`);

// ── Complaints ────────────────────────────────────────────────────────────────
export const listAdminComplaints = (params)      => client.get('/api/admin/complaints', { params });
export const assignComplaint     = (id, body)    => client.post(`/api/admin/complaints/${id}/assign`, body);
export const resolveComplaint    = (id, body)    => client.post(`/api/admin/complaints/${id}/resolve`, body);

// ── Queries ───────────────────────────────────────────────────────────────────
export const listAdminQueries = (params)      => client.get('/api/admin/queries', { params });
export const resolveQuery     = (id, body)    => client.post(`/api/admin/queries/${id}/resolve`, body);
