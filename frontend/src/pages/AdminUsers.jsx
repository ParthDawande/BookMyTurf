import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listUsers, suspendUser, banUser, activateUser } from '../api/adminApi';
import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ACTIVE:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  SUSPENDED: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  BANNED:    { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
};

const ROLE_CFG = {
  CUSTOMER: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  OWNER:    { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  STAFF:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  ADMIN:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

function Badge({ text, cfg }) {
  const c = cfg || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {text}
    </span>
  );
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inp = { padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.88rem' };

// ── Confirmation modal ────────────────────────────────────────────────────────

const ACTION_CFG = {
  suspend: {
    title: 'Suspend user?',
    color: '#92400e',
    msg: name => `Suspend ${name}? They won't be able to log in until reactivated.`,
    btnLabel: 'Suspend',
    btnBg: '#d97706',
  },
  ban: {
    title: 'Ban user?',
    color: '#b91c1c',
    msg: name => `Ban ${name}? This is a strong action — they won't be able to access the platform. You can activate them later if needed.`,
    btnLabel: 'Ban',
    btnBg: '#dc2626',
  },
  activate: {
    title: 'Activate user?',
    color: '#166534',
    msg: name => `Activate ${name}? They'll regain full platform access.`,
    btnLabel: 'Activate',
    btnBg: '#16a34a',
  },
};

function ConfirmModal({ action, userName, onConfirm, onCancel, acting, error }) {
  const cfg = ACTION_CFG[action];
  if (!cfg) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
      onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: '10px', padding: '1.75rem',
        maxWidth: '420px', width: '93%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 0.6rem', color: cfg.color, fontSize: '1rem' }}>{cfg.title}</h3>
        <p style={{ color: '#374151', fontSize: '0.88rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
          {cfg.msg(userName)}
        </p>
        {error && (
          <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.4rem 0.7rem',
            borderRadius: '5px', fontSize: '0.82rem', marginBottom: '0.75rem', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={onConfirm} disabled={acting} style={{
            flex: 1, padding: '0.6rem', background: acting ? '#d1d5db' : cfg.btnBg,
            color: '#fff', border: 'none', borderRadius: '5px',
            cursor: acting ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}>{acting ? 'Working…' : cfg.btnLabel}</button>
          <button onClick={onCancel} style={{
            padding: '0.6rem 1rem', background: 'transparent', border: '1px solid #d1d5db',
            color: '#374151', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── AdminUsers ────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();

  const roleParam   = searchParams.get('role')   || '';
  const statusParam = searchParams.get('status') || '';
  const searchParam = searchParams.get('search') || '';
  const pageParam   = parseInt(searchParams.get('page') || '1', 10);

  const [roleInput,   setRoleInput]   = useState(roleParam);
  const [statusInput, setStatusInput] = useState(statusParam);
  const [searchInput, setSearchInput] = useState(searchParam);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // { action:'suspend'|'ban'|'activate', userId, userName }
  const [confirm, setConfirm] = useState(null);
  const [acting,  setActing]  = useState(false);
  const [actErr,  setActErr]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page: pageParam, page_size: 20 };
    if (roleParam)   params.role   = roleParam;
    if (statusParam) params.status = statusParam;
    if (searchParam) params.search = searchParam;
    listUsers(params)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [roleParam, statusParam, searchParam, pageParam]);

  useEffect(() => { load(); }, [load]);

  function handleApply(e) {
    e.preventDefault();
    const p = {};
    if (roleInput)   p.role   = roleInput;
    if (statusInput) p.status = statusInput;
    if (searchInput) p.search = searchInput;
    setSearchParams(p);
  }

  function handleClear() {
    setRoleInput(''); setStatusInput(''); setSearchInput('');
    setSearchParams({});
  }

  function setPage(n) {
    const p = Object.fromEntries(searchParams);
    p.page = String(n);
    setSearchParams(p);
  }

  async function doAction() {
    if (!confirm) return;
    setActing(true);
    setActErr(null);
    try {
      if (confirm.action === 'suspend')  await suspendUser(confirm.userId);
      else if (confirm.action === 'ban') await banUser(confirm.userId);
      else                               await activateUser(confirm.userId);
      setConfirm(null);
      load();
    } catch (err) {
      setActErr(err.response?.data?.error || 'Action failed.');
    } finally {
      setActing(false);
    }
  }

  const isFiltered = !!(roleParam || statusParam || searchParam);
  const users = data?.users || [];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />

      {confirm && (
        <ConfirmModal
          action={confirm.action}
          userName={confirm.userName}
          onConfirm={doAction}
          onCancel={() => { setConfirm(null); setActErr(null); }}
          acting={acting}
          error={actErr}
        />
      )}

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          User Management
        </h1>

        {/* Filters */}
        <form onSubmit={handleApply} style={{
          background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '1.25rem',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>Role</div>
            <select value={roleInput} onChange={e => setRoleInput(e.target.value)}
              style={{ ...inp, paddingRight: '1.5rem', cursor: 'pointer' }}>
              <option value="">All</option>
              {['CUSTOMER','OWNER','STAFF','ADMIN'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>Status</div>
            <select value={statusInput} onChange={e => setStatusInput(e.target.value)}
              style={{ ...inp, paddingRight: '1.5rem', cursor: 'pointer' }}>
              <option value="">All</option>
              {['ACTIVE','SUSPENDED','BANNED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>Search</div>
            <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by email or name…" />
          </div>
          <button type="submit" style={{
            padding: '0.45rem 1.1rem', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
          }}>Search</button>
          {isFiltered && (
            <button type="button" onClick={handleClear} style={{
              padding: '0.45rem 1rem', background: 'transparent', color: '#6b7280',
              border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
            }}>Clear</button>
          )}
        </form>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: '52px', borderRadius: '8px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '2.5rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ color: '#6b7280', margin: 0 }}>No users match your filters.</p>
          </div>
        )}

        {!loading && users.length > 0 && (
          <>
            <div style={{ background: '#fff', borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {['Name','Email','Role','Status','Joined','Actions'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                        color: '#6b7280', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '0.7rem 1rem', fontWeight: 500, color: '#1e3a5f' }}>{u.name || '—'}</td>
                      <td style={{ padding: '0.7rem 1rem', color: '#374151', fontSize: '0.83rem' }}>{u.email}</td>
                      <td style={{ padding: '0.7rem 1rem' }}><Badge text={u.role} cfg={ROLE_CFG[u.role]} /></td>
                      <td style={{ padding: '0.7rem 1rem' }}><Badge text={u.status} cfg={STATUS_CFG[u.status]} /></td>
                      <td style={{ padding: '0.7rem 1rem', color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {fmtDate(u.created_at)}
                      </td>
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {u.status === 'ACTIVE' && (<>
                            <button onClick={() => setConfirm({ action: 'suspend', userId: u.user_id, userName: u.name || u.email })} style={{
                              padding: '0.25rem 0.6rem', background: '#fef3c7', border: '1px solid #fcd34d',
                              color: '#92400e', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                              Suspend
                            </button>
                            <button onClick={() => setConfirm({ action: 'ban', userId: u.user_id, userName: u.name || u.email })} style={{
                              padding: '0.25rem 0.6rem', background: '#fee2e2', border: '1px solid #fca5a5',
                              color: '#b91c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                              Ban
                            </button>
                          </>)}
                          {u.status === 'SUSPENDED' && (<>
                            <button onClick={() => setConfirm({ action: 'activate', userId: u.user_id, userName: u.name || u.email })} style={{
                              padding: '0.25rem 0.6rem', background: '#dcfce7', border: '1px solid #86efac',
                              color: '#166534', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                              Activate
                            </button>
                            <button onClick={() => setConfirm({ action: 'ban', userId: u.user_id, userName: u.name || u.email })} style={{
                              padding: '0.25rem 0.6rem', background: '#fee2e2', border: '1px solid #fca5a5',
                              color: '#b91c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                              Ban
                            </button>
                          </>)}
                          {u.status === 'BANNED' && (
                            <button onClick={() => setConfirm({ action: 'activate', userId: u.user_id, userName: u.name || u.email })} style={{
                              padding: '0.25rem 0.6rem', background: '#dcfce7', border: '1px solid #86efac',
                              color: '#166534', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                              Activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary + pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                {data.total_results} user{data.total_results !== 1 ? 's' : ''}{isFiltered ? ' (filtered)' : ''}
              </span>
              {data.total_pages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button disabled={pageParam <= 1} onClick={() => setPage(pageParam - 1)}
                    style={{ padding: '0.35rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '5px',
                      background: pageParam <= 1 ? '#f9fafb' : '#fff',
                      cursor: pageParam <= 1 ? 'not-allowed' : 'pointer',
                      color: pageParam <= 1 ? '#9ca3af' : '#374151', fontSize: '0.85rem' }}>← Prev</button>
                  <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                    {data.page} / {data.total_pages}
                  </span>
                  <button disabled={pageParam >= data.total_pages} onClick={() => setPage(pageParam + 1)}
                    style={{ padding: '0.35rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '5px',
                      background: pageParam >= data.total_pages ? '#f9fafb' : '#fff',
                      cursor: pageParam >= data.total_pages ? 'not-allowed' : 'pointer',
                      color: pageParam >= data.total_pages ? '#9ca3af' : '#374151', fontSize: '0.85rem' }}>Next →</button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
