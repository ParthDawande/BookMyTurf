import { useState, useEffect, useCallback } from 'react';
import {
  listPendingTurfs, approveTurf, rejectTurf,
  listPendingSubCourts, approveSubCourt, rejectSubCourt,
} from '../api/adminApi';
import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    APPROVED: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    PENDING:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    REJECTED: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  }[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {status}
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Confirm approve modal ─────────────────────────────────────────────────────

function ApproveModal({ name, onConfirm, onCancel, acting }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '420px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.6rem', color: '#166534', fontSize: '1rem' }}>Approve?</h3>
        <p style={{ color: '#374151', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Approve <strong>{name}</strong>? It will become visible to customers immediately.
        </p>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={onConfirm} disabled={acting} style={{
            flex: 1, padding: '0.6rem', background: acting ? '#86efac' : '#16a34a',
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}>{acting ? 'Approving…' : 'Approve'}</button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Reject modal with required reason ─────────────────────────────────────────

function RejectModal({ name, onConfirm, onCancel, acting }) {
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '460px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.6rem', color: '#b91c1c', fontSize: '1rem' }}>Reject?</h3>
        <p style={{ color: '#374151', fontSize: '0.88rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
          Rejecting <strong>{name}</strong>. The owner will see your reason.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection (required)…"
          rows={4}
          style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid #d1d5db',
            borderRadius: '5px', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box',
            marginBottom: '1rem' }}
        />
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim() || acting}
            style={{
              flex: 1, padding: '0.6rem',
              background: !reason.trim() || acting ? '#fca5a5' : '#dc2626',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: !reason.trim() || acting ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}>{acting ? 'Rejecting…' : 'Reject'}</button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Turf card ─────────────────────────────────────────────────────────────────

function TurfCard({ turf, onApprove, onReject }) {
  const cover = turf.photos?.[0];
  return (
    <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      padding: '1.25rem 1.4rem', display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
      {/* Cover photo */}
      <div style={{ width: '110px', height: '80px', borderRadius: '8px', flexShrink: 0,
        background: '#e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cover
          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }} />
          : <span style={{ color: '#9ca3af', fontSize: '1.8rem' }}>🏟️</span>}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.98rem' }}>{turf.name}</span>
          <StatusBadge status={turf.status} />
        </div>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.2rem' }}>
          {turf.city} · {turf.address}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.2rem' }}>
          <strong>Owner:</strong> {turf.owner?.name} ({turf.owner?.email})
        </div>
        {turf.description && (
          <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.2rem',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {turf.description}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          Sub-courts: {turf.sub_courts_summary?.total ?? 0} total
          ({turf.sub_courts_summary?.pending ?? 0} pending) · Submitted {fmtDate(turf.created_at)}
        </div>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center', flexShrink: 0 }}>
        <button onClick={() => onApprove(turf.turf_id, turf.name)} style={{
          padding: '0.45rem 1.1rem', background: '#16a34a', color: '#fff', border: 'none',
          borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        }}>Approve</button>
        <button onClick={() => onReject(turf.turf_id, turf.name)} style={{
          padding: '0.45rem 1.1rem', background: '#fee2e2', color: '#b91c1c',
          border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        }}>Reject</button>
      </div>
    </div>
  );
}

// ── Sub-court card ────────────────────────────────────────────────────────────

function SubCourtCard({ sc, onApprove, onReject }) {
  const label = `${sc.name} — ${sc.turf?.name}`;
  return (
    <div style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      padding: '1.1rem 1.4rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.95rem' }}>{sc.name}</span>
          <StatusBadge status={sc.status} />
        </div>
        <div style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.15rem' }}>
          <strong>Turf:</strong> {sc.turf?.name} ({sc.turf?.city}) · Turf status: <StatusBadge status={sc.turf?.status} />
        </div>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.15rem' }}>
          Sports: {sc.sports?.join(', ')} · ₹{sc.hourly_price}/hr · {sc.opening_hour}–{sc.closing_hour}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          Owner: {sc.owner?.name}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button onClick={() => onApprove(sc.sub_court_id, label)} style={{
          padding: '0.4rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none',
          borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
        }}>Approve</button>
        <button onClick={() => onReject(sc.sub_court_id, label)} style={{
          padding: '0.4rem 0.9rem', background: '#fee2e2', color: '#b91c1c',
          border: '1px solid #fca5a5', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
        }}>Reject</button>
      </div>
    </div>
  );
}

// ── AdminApprovals ────────────────────────────────────────────────────────────

export default function AdminApprovals() {
  const [turfs,     setTurfs]     = useState([]);
  const [subCourts, setSubCourts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Modal state: { type:'turf'|'sc', mode:'approve'|'reject', id, name }
  const [modal,  setModal]  = useState(null);
  const [acting, setActing] = useState(false);
  const [actErr, setActErr] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listPendingTurfs({ page_size: 50 }),
      listPendingSubCourts({ page_size: 50 }),
    ])
      .then(([tr, sr]) => {
        setTurfs(tr.data.turfs || []);
        setSubCourts(sr.data.sub_courts || []);
      })
      .catch(() => setError('Failed to load pending approvals.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openApprove(type, id, name) { setModal({ type, mode: 'approve', id, name }); setActErr(null); }
  function openReject (type, id, name) { setModal({ type, mode: 'reject',  id, name }); setActErr(null); }

  async function handleApprove() {
    if (!modal) return;
    setActing(true);
    setActErr(null);
    try {
      if (modal.type === 'turf') await approveTurf(modal.id);
      else                       await approveSubCourt(modal.id);
      setModal(null);
      load();
    } catch (err) {
      setActErr(err.response?.data?.error || 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  async function handleReject(reason) {
    if (!modal) return;
    setActing(true);
    setActErr(null);
    try {
      if (modal.type === 'turf') await rejectTurf(modal.id, { reason });
      else                       await rejectSubCourt(modal.id, { reason });
      setModal(null);
      load();
    } catch (err) {
      setActErr(err.response?.data?.error || 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  const isEmpty = !loading && turfs.length === 0 && subCourts.length === 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />

      {modal?.mode === 'approve' && (
        <ApproveModal
          name={modal.name}
          onConfirm={handleApprove}
          onCancel={() => { setModal(null); setActErr(null); }}
          acting={acting}
        />
      )}
      {modal?.mode === 'reject' && (
        <RejectModal
          name={modal.name}
          onConfirm={handleReject}
          onCancel={() => { setModal(null); setActErr(null); }}
          acting={acting}
        />
      )}

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Pending Approvals
        </h1>

        {actErr && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.88rem' }}>
            {actErr}
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '100px', borderRadius: '10px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {isEmpty && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '3rem',
            textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ color: '#6b7280', margin: 0 }}>No pending approvals.</p>
          </div>
        )}

        {!loading && turfs.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Turfs awaiting approval ({turfs.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {turfs.map(t => (
                <TurfCard key={t.turf_id} turf={t}
                  onApprove={(id, name) => openApprove('turf', id, name)}
                  onReject={(id, name)  => openReject('turf',  id, name)}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && subCourts.length > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Sub-courts awaiting approval ({subCourts.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {subCourts.map(sc => (
                <SubCourtCard key={sc.sub_court_id} sc={sc}
                  onApprove={(id, name) => openApprove('sc', id, name)}
                  onReject={(id, name)  => openReject('sc',  id, name)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
