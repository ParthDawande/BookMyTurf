import { useState, useEffect, useCallback } from 'react';
import { listStaffComplaints, addComplaintNote, resolveComplaint, listStaffQueries } from '../api/staffApi';
import Header from '../components/Header';
import StaffNav from '../components/StaffNav';

const TEAL = '#0d9488';

const STATUS_CFG = {
  IN_PROGRESS: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  RESOLVED:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  OPEN:        { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
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

// ── Add note modal ────────────────────────────────────────────────────────────

function NoteModal({ complaintId, onDone, onCancel }) {
  const [note,   setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit() {
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addComplaintNote(complaintId, { note: note.trim() });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add note.');
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
        <h3 style={{ margin: '0 0 0.75rem', color: '#1e3a5f', fontSize: '1rem' }}>
          Add note — complaint #{complaintId}
        </h3>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.4rem 0.7rem',
            borderRadius: '5px', fontSize: '0.82rem', marginBottom: '0.75rem', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Internal note (visible to staff and admin only)…" rows={4}
          style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
            borderRadius: '5px', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box',
            marginBottom: '1rem' }} />
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={handleSubmit} disabled={!note.trim() || saving} style={{
            flex: 1, padding: '0.6rem',
            background: !note.trim() || saving ? '#d1d5db' : TEAL,
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: !note.trim() || saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? 'Adding…' : 'Add note'}
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

// ── StaffComplaints ───────────────────────────────────────────────────────────

export default function StaffComplaints() {
  const [complaints,  setComplaints]  = useState([]);
  const [mineQueries, setMineQueries] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [statusFilter, setStatusFilter] = useState('IN_PROGRESS');

  const [noteModal,    setNoteModal]    = useState(null); // complaintId
  const [resolveModal, setResolveModal] = useState(null); // complaintId

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listStaffComplaints(),
      listStaffQueries({ mine: true }),
    ])
      .then(([cr, qr]) => {
        setComplaints(cr.data.complaints || []);
        setMineQueries(qr.data.queries || []);
      })
      .catch(() => setError('Failed to load complaints.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignedCount = complaints.filter(c => c.status === 'IN_PROGRESS').length;
  const claimedCount  = mineQueries.filter(q => q.status === 'IN_PROGRESS').length;

  const filtered = statusFilter
    ? complaints.filter(c => c.status === statusFilter)
    : complaints;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <StaffNav />

      {noteModal !== null && (
        <NoteModal
          complaintId={noteModal}
          onDone={() => { setNoteModal(null); load(); }}
          onCancel={() => setNoteModal(null)}
        />
      )}
      {resolveModal !== null && (
        <ResolveModal
          complaintId={resolveModal}
          onDone={() => { setResolveModal(null); load(); }}
          onCancel={() => setResolveModal(null)}
        />
      )}

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Assigned to Me
        </h1>

        {/* Banner */}
        {!loading && (
          <div style={{ background: '#f0fdfa', border: `1px solid ${TEAL}33`,
            borderLeft: `4px solid ${TEAL}`, borderRadius: '8px',
            padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#0f766e' }}>
            You have <strong>{assignedCount}</strong> complaint{assignedCount !== 1 ? 's' : ''} assigned
            and <strong>{claimedCount}</strong> {claimedCount !== 1 ? 'queries' : 'query'} claimed.
          </div>
        )}

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Active', value: 'IN_PROGRESS' },
            { label: 'Resolved', value: 'RESOLVED' },
            { label: 'All', value: '' },
          ].map(({ label, value }) => {
            const active = statusFilter === value;
            return (
              <button key={label} onClick={() => setStatusFilter(value)} style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.83rem',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                background: active ? TEAL : '#fff',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? TEAL : '#d1d5db'}`,
              }}>{label}</button>
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
            {[1, 2].map(i => (
              <div key={i} style={{ height: '120px', borderRadius: '10px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '2.5rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ color: '#6b7280', margin: 0 }}>
              {statusFilter === 'IN_PROGRESS' ? 'No active complaints assigned to you.' : 'No complaints to show.'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.map(c => (
            <div key={c.complaint_id} style={{ background: '#fff', borderRadius: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '1.1rem 1.4rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.93rem' }}>
                    #{c.complaint_id} — {c.subject}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af', flexShrink: 0 }}>
                  {fmtDate(c.created_at)}
                </span>
              </div>

              {/* Customer + booking */}
              <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.25rem' }}>
                <strong>Customer:</strong> {c.customer_name}
                {c.booking_id && (
                  <span style={{ marginLeft: '0.75rem', color: '#6b7280' }}>
                    Re: Booking #{c.booking_id}
                  </span>
                )}
              </div>

              {/* Notes count */}
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.65rem' }}>
                {c.notes?.length > 0
                  ? `${c.notes.length} note${c.notes.length !== 1 ? 's' : ''}`
                  : 'No notes yet'}
              </div>

              {/* Inline notes */}
              {c.notes?.length > 0 && (
                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '0.6rem 0.8rem',
                  marginBottom: '0.65rem' }}>
                  {c.notes.map(n => (
                    <div key={n.note_id} style={{ fontSize: '0.82rem', color: '#374151',
                      borderBottom: '1px solid #f3f4f6', paddingBottom: '0.35rem', marginBottom: '0.35rem' }}>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginRight: '0.4rem' }}>
                        {fmtDate(n.created_at)}
                      </span>
                      {n.note_text}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {c.status === 'IN_PROGRESS' && (
                  <>
                    <button onClick={() => setNoteModal(c.complaint_id)} style={{
                      padding: '0.3rem 0.8rem', background: '#f0fdfa',
                      border: `1px solid ${TEAL}55`, color: TEAL,
                      borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                      Add note
                    </button>
                    <button onClick={() => setResolveModal(c.complaint_id)} style={{
                      padding: '0.3rem 0.8rem', background: '#dcfce7', border: '1px solid #86efac',
                      color: '#166534', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                      Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
