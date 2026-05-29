import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listComplaints } from '../api/complaints';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

const STATUS_STYLE = {
  OPEN:        { bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { bg: '#fef3c7', color: '#92400e' },
  RESOLVED:    { bg: '#dcfce7', color: '#166534' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

export default function ComplaintList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const pageParam = Number(searchParams.get('page') || '1');

  const [complaints, setComplaints] = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback((pg, status) => {
    setLoading(true);
    setError(null);
    const params = { page: pg, pageSize: 10 };
    if (status) params.status = status;
    listComplaints(params)
      .then(res => {
        setComplaints(res.data.complaints || []);
        setTotal(res.data.total_results);
        setTotalPages(res.data.total_pages);
      })
      .catch(() => setError('Failed to load complaints.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(pageParam, statusFilter); }, [load, pageParam, statusFilter]);

  function setFilter(s) {
    setSearchParams(s ? { status: s, page: '1' } : { page: '1' });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <CustomerNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>My Complaints</h1>
          <button onClick={() => navigate('/customer/complaints/new')} style={{
            padding: '0.5rem 1.1rem', background: '#dc2626', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
          }}>
            + Raise a complaint
          </button>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[['All', ''], ['Open', 'OPEN'], ['In Progress', 'IN_PROGRESS'], ['Resolved', 'RESOLVED']].map(([label, val]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem', cursor: 'pointer',
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
        {error && <div style={{ color: '#b91c1c', padding: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        {!loading && !error && complaints.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem' }}>
              {statusFilter
                ? `No ${statusFilter.toLowerCase().replace('_', ' ')} complaints.`
                : "You haven't raised any complaints."}
            </p>
            {!statusFilter && (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#6b7280' }}>
                If something's wrong, you can report it from your booking receipt or{' '}
                <button onClick={() => navigate('/customer/complaints/new')}
                  style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}>
                  raise a general complaint
                </button>.
              </p>
            )}
          </div>
        )}

        {!loading && complaints.map(c => (
          <div
            key={c.complaint_id}
            onClick={() => navigate(`/customer/complaints/${c.complaint_id}`)}
            style={{ background: '#fff', borderRadius: '10px', padding: '1rem 1.2rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '0.6rem', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1e3a5f', fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                  {c.subject}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{fmtDate(c.created_at)}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          </div>
        ))}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
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
