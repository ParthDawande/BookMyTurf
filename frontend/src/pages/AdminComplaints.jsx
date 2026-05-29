import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAdminComplaints, assignComplaint, resolveComplaint } from '../api/adminApi';
import { listStaff } from '../api/adminApi';
import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

const STATUS_CFG = {
  OPEN:        { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  IN_PROGRESS: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  RESOLVED:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Reassign modal ────────────────────────────────────────────────────────────

function ReassignModal({ complaintId, onDone, onCancel }) {
  const [staffList, setStaffList] = useState([]);
  const [staffId,   setStaffId]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    listStaff({ page_size: 100 })
      .then(res => setStaffList(res.data.staff || []))
      .catch(() => setError('Failed to load staff.'));
  }, []);

  async function handleSubmit() {
    if (!staffId) return;
    setSaving(true);
    setError(null);
    try {
      await assignComplaint(complaintId, { staff_id: Number(staffId) });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reassign.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '420px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1rem', color: '#1e3a5f', fontSize: '1rem' }}>
          Reassign complaint #{complaintId}
        </h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.4rem 0.7rem',
            borderRadius: '5px', fontSize: '0.82rem', marginBottom: '0.75rem', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
            Assign to staff <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select value={staffId} onChange={e => setStaffId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
              borderRadius: '5px', fontSize: '0.9rem', boxSizing: 'border-box' }}>
            <option value="">Select staff member…</option>
            {staffList.filter(s => s.status === 'ACTIVE').map(s => (
              <option key={s.user_id} value={s.user_id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={handleSubmit} disabled={!staffId || saving} style={{
            flex: 1, padding: '0.6rem',
            background: !staffId || saving ? '#d1d5db' : '#7c3aed',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: !staffId || saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? 'Assigning…' : 'Assign'}
          </button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resolve modal ─────────────────────────────────────────────────────────────

function ResolveModal({ complaintId, onDone, onCancel }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit() {
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await resolveComplaint(complaintId, { resolution_note: note.trim() });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '440px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.75rem', color: '#166534', fontSize: '1rem' }}>
          Resolve complaint #{complaintId}
        </h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.4rem 0.7rem',
            borderRadius: '5px', fontSize: '0.82rem', marginBottom: '0.75rem', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Resolution note (required)…" rows={4}
          style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
            borderRadius: '5px', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box',
            marginBottom: '1rem' }} />
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={handleSubmit} disabled={!note.trim() || saving} style={{
            flex: 1, padding: '0.6rem',
            background: !note.trim() || saving ? '#d1d5db' : '#16a34a',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: !note.trim() || saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? 'Resolving…' : 'Resolve'}
          </button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AdminComplaints ───────────────────────────────────────────────────────────

export default function AdminComplaints() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || '';
  const pageParam   = parseInt(searchParams.get('page') || '1', 10);

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [reassignId, setReassignId] = useState(null);
  const [resolveId,  setResolveId]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page: pageParam, page_size: 10 };
    if (statusParam) params.status = statusParam;
    listAdminComplaints(params)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load complaints.'))
      .finally(() => setLoading(false));
  }, [statusParam, pageParam]);

  useEffect(() => { load(); }, [load]);

  function setFilter(val) {
    const p = {};
    if (val) p.status = val;
    setSearchParams(p);
  }

  function setPage(n) {
    const p = Object.fromEntries(searchParams);
    p.page = String(n);
    setSearchParams(p);
  }

  const complaints = data?.complaints || [];
  const FILTERS = ['','OPEN','IN_PROGRESS','RESOLVED'];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />

      {reassignId !== null && (
        <ReassignModal complaintId={reassignId} onDone={() => { setReassignId(null); load(); }} onCancel={() => setReassignId(null)} />
      )}
      {resolveId !== null && (
        <ResolveModal complaintId={resolveId} onDone={() => { setResolveId(null); load(); }} onCancel={() => setResolveId(null)} />
      )}

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Complaints
          {data && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 400,
            color: '#6b7280' }}>({data.total_results} total)</span>}
        </h1>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const label = f || 'All';
            const active = statusParam === f;
            return (
              <button key={label} onClick={() => setFilter(f)} style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.83rem',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                background: active ? '#7c3aed' : '#fff',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#7c3aed' : '#d1d5db'}`,
              }}>{label.replace('_', ' ')}</button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: '110px', borderRadius: '10px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {!loading && complaints.length === 0 && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '2.5rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No complaints.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {complaints.map(c => {
            const canAct = c.status === 'OPEN' || c.status === 'IN_PROGRESS';
            return (
              <div key={c.complaint_id} style={{ background: '#fff', borderRadius: '10px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '1.1rem 1.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.93rem' }}>
                      #{c.complaint_id} — {c.subject}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af', flexShrink: 0 }}>{fmtDate(c.created_at)}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.3rem' }}>
                  <strong>Customer:</strong> {c.customer_name}
                  {c.booking_id && <span style={{ marginLeft: '0.75rem', color: '#6b7280' }}>Booking #{c.booking_id}</span>}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  <strong>Assigned to:</strong> {c.assigned_staff_name || <em>Unassigned</em>}
                  {c.resolved_at && <span style={{ marginLeft: '0.75rem' }}>Resolved {fmtDate(c.resolved_at)}</span>}
                </div>
                {canAct && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setReassignId(c.complaint_id)} style={{
                      padding: '0.3rem 0.8rem', background: '#eff6ff', border: '1px solid #bfdbfe',
                      color: '#1d4ed8', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                      Reassign
                    </button>
                    <button onClick={() => setResolveId(c.complaint_id)} style={{
                      padding: '0.3rem 0.8rem', background: '#dcfce7', border: '1px solid #86efac',
                      color: '#166534', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data && data.total_pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button disabled={pageParam <= 1} onClick={() => setPage(pageParam - 1)}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                background: pageParam <= 1 ? '#f9fafb' : '#fff',
                cursor: pageParam <= 1 ? 'not-allowed' : 'pointer',
                color: pageParam <= 1 ? '#9ca3af' : '#374151', fontSize: '0.88rem' }}>← Prev</button>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Page {data.page} of {data.total_pages}
            </span>
            <button disabled={pageParam >= data.total_pages} onClick={() => setPage(pageParam + 1)}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                background: pageParam >= data.total_pages ? '#f9fafb' : '#fff',
                cursor: pageParam >= data.total_pages ? 'not-allowed' : 'pointer',
                color: pageParam >= data.total_pages ? '#9ca3af' : '#374151', fontSize: '0.88rem' }}>Next →</button>
          </div>
        )}
      </main>
    </div>
  );
}
