import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listTurfs } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

const STATUS_CONFIG = {
  PENDING:  { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  APPROVED: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  REJECTED: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
  return (
    <span style={{ display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

function TurfCard({ turf, onEdit }) {
  return (
    <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.09)', display: 'flex', flexDirection: 'column' }}>
      {/* Cover */}
      <div style={{ height: '140px', background: '#e5e7eb', overflow: 'hidden', position: 'relative' }}>
        {turf.cover_photo_url
          ? <img src={turf.cover_photo_url} alt={turf.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#9ca3af', fontSize: '2rem' }}>🏟️</div>
        }
        <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
          <StatusBadge status={turf.status} />
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '0.9rem 1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '0.95rem', marginBottom: '0.2rem' }}>
          {turf.name}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
          {turf.city} · {turf.sub_court_count} sub-court{turf.sub_court_count !== 1 ? 's' : ''}
        </div>
        {turf.sports?.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            {turf.sports.join(', ')}
          </div>
        )}
        <button onClick={() => onEdit(turf.turf_id)} style={{
          marginTop: 'auto', padding: '0.45rem', background: '#1d4ed8', color: '#fff',
          border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        }}>
          Edit →
        </button>
      </div>
    </div>
  );
}

export default function OwnerTurfList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const pageParam = Number(searchParams.get('page') || '1');

  const [turfs,      setTurfs]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback((page, status) => {
    setLoading(true);
    setError(null);
    const params = { page, page_size: 12 };
    if (status) params.status = status;
    listTurfs(params)
      .then(res => {
        setTurfs(res.data.turfs || []);
        setTotal(res.data.total_results || 0);
        setTotalPages(res.data.total_pages || 1);
      })
      .catch(() => setError('Failed to load turfs.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(pageParam, statusFilter); }, [load, pageParam, statusFilter]);

  function setFilter(s) { setSearchParams(s ? { status: s, page: '1' } : { page: '1' }); }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>My Turfs</h1>
          <button onClick={() => navigate('/owner/turfs/new')} style={{
            padding: '0.55rem 1.2rem', background: '#1d4ed8', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
          }}>
            + Add a turf
          </button>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[['All', ''], ['Pending', 'PENDING'], ['Approved', 'APPROVED'], ['Rejected', 'REJECTED']].map(([label, val]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.83rem', cursor: 'pointer',
              fontWeight: statusFilter === val ? 600 : 400,
              background: statusFilter === val ? '#1e3a5f' : '#fff',
              color: statusFilter === val ? '#fff' : '#374151',
              border: `1px solid ${statusFilter === val ? '#1e3a5f' : '#d1d5db'}`,
            }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#888', padding: '3rem' }}>Loading…</div>}
        {error && <div style={{ color: '#b91c1c', padding: '1rem' }}>{error}</div>}

        {!loading && !error && turfs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏟️</div>
            <p style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1e3a5f', fontWeight: 500 }}>
              {statusFilter ? `No ${statusFilter.toLowerCase()} turfs.` : "You haven't added any turfs yet."}
            </p>
            {!statusFilter && (
              <button onClick={() => navigate('/owner/turfs/new')} style={{
                padding: '0.55rem 1.3rem', background: '#1d4ed8', color: '#fff',
                border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600,
              }}>
                + Add your first turf
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {!loading && turfs.map(t => (
            <TurfCard key={t.turf_id} turf={t} onEdit={id => navigate(`/owner/turfs/${id}`)} />
          ))}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button disabled={pageParam <= 1}
              onClick={() => setSearchParams({ status: statusFilter, page: String(pageParam - 1) })}
              style={{ padding: '0.4rem 0.9rem', background: '#fff', border: '1px solid #d1d5db',
                borderRadius: '5px', cursor: pageParam <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
              ← Prev
            </button>
            <span style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', color: '#555' }}>
              {pageParam} / {totalPages}
            </span>
            <button disabled={pageParam >= totalPages}
              onClick={() => setSearchParams({ status: statusFilter, page: String(pageParam + 1) })}
              style={{ padding: '0.4rem 0.9rem', background: '#fff', border: '1px solid #d1d5db',
                borderRadius: '5px', cursor: pageParam >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
