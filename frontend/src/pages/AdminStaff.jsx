import { useState, useEffect, useCallback } from 'react';
import { listStaff, createStaff, deactivateStaff, reactivateStaff } from '../api/adminApi';
import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

const STATUS_CFG = {
  ACTIVE:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  SUSPENDED: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inp = { padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '5px',
  fontSize: '0.9rem', boxSizing: 'border-box', width: '100%' };
const fld = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.9rem' };
const lbl = { fontSize: '0.85rem', fontWeight: 600, color: '#374151' };

// ── Create staff modal ────────────────────────────────────────────────────────

function CreateModal({ onCreated, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await createStaff(form);
      onCreated(res.data);
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details ? Object.values(details).join(' ') : (err.response?.data?.error || 'Failed to create staff.'));
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '480px', width: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.05rem' }}>Add new staff</h3>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.5rem 0.75rem', borderRadius: '5px', marginBottom: '0.85rem', fontSize: '0.83rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={fld}>
            <label style={lbl}>Full name <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.name} required minLength={2}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={fld}>
            <label style={lbl}>Email <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} type="email" value={form.email} required
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div style={fld}>
            <label style={lbl}>Phone <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} value={form.phone} required pattern="[0-9]{10}" placeholder="10 digits"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div style={fld}>
            <label style={lbl}>Password <span style={{ color: '#dc2626' }}>*</span></label>
            <input style={inp} type="password" value={form.password} required
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Min 8 characters · 1 uppercase · 1 number · 1 special character
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '0.6rem', background: saving ? '#93c5fd' : '#7c3aed',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {saving ? 'Creating…' : 'Create staff'}
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
              color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm deactivate/activate modal ─────────────────────────────────────────

function ConfirmModal({ mode, name, onConfirm, onCancel, acting }) {
  const isDeactivate = mode === 'deactivate';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '400px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.6rem', color: isDeactivate ? '#b91c1c' : '#166534', fontSize: '1rem' }}>
          {isDeactivate ? 'Deactivate staff?' : 'Activate staff?'}
        </h3>
        <p style={{ color: '#374151', fontSize: '0.88rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          {isDeactivate
            ? `${name} will no longer be able to log in.`
            : `${name} will regain platform access.`}
        </p>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={onConfirm} disabled={acting} style={{
            flex: 1, padding: '0.6rem',
            background: acting ? '#d1d5db' : (isDeactivate ? '#dc2626' : '#16a34a'),
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {acting ? 'Working…' : (isDeactivate ? 'Deactivate' : 'Activate')}
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

// ── AdminStaff ────────────────────────────────────────────────────────────────

export default function AdminStaff() {
  const [staff,       setStaff]      = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState(null);
  const [showCreate,  setShowCreate] = useState(false);
  const [confirm,     setConfirm]    = useState(null); // { mode:'deactivate'|'activate', userId, name }
  const [acting,      setActing]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listStaff({ page_size: 100 })
      .then(res => setStaff(res.data.staff || []))
      .catch(() => setError('Failed to load staff.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCreated(newStaff) {
    setShowCreate(false);
    load();
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActing(true);
    try {
      if (confirm.mode === 'deactivate') await deactivateStaff(confirm.userId);
      else                               await reactivateStaff(confirm.userId);
      setConfirm(null);
      load();
    } catch { /* ignore — reload handles it */ }
    finally { setActing(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />

      {showCreate && <CreateModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />}
      {confirm && (
        <ConfirmModal
          mode={confirm.mode} name={confirm.name}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          acting={acting}
        />
      )}

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Banner */}
        <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '8px',
          padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#92400e' }}>
          New staff should reset their password after first login. (Password reset flow is a v2 polish item.)
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>Staff Management</h1>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '0.5rem 1.1rem', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
          }}>+ Add new staff</button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: '52px', borderRadius: '8px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {!loading && staff.length === 0 && !error && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '2.5rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No staff accounts yet.</p>
          </div>
        )}

        {!loading && staff.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['Name','Email','Phone','Status','Joined','Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                      color: '#6b7280', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#1e3a5f' }}>{s.name}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.83rem' }}>{s.email}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#6b7280', fontSize: '0.82rem' }}>{s.phone}</td>
                    <td style={{ padding: '0.7rem 1rem' }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: '0.7rem 1rem', color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {fmtDate(s.created_at)}
                    </td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      {s.status === 'ACTIVE' && (
                        <button onClick={() => setConfirm({ mode: 'deactivate', userId: s.user_id, name: s.name })} style={{
                          padding: '0.25rem 0.65rem', background: '#fee2e2', border: '1px solid #fca5a5',
                          color: '#b91c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          Deactivate
                        </button>
                      )}
                      {s.status !== 'ACTIVE' && (
                        <button onClick={() => setConfirm({ mode: 'activate', userId: s.user_id, name: s.name })} style={{
                          padding: '0.25rem 0.65rem', background: '#dcfce7', border: '1px solid #86efac',
                          color: '#166534', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
