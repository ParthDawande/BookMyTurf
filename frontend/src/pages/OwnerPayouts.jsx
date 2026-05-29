import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listPayouts } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

const STATUS_CFG = {
  PENDING:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  PAID:      { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  CANCELLED: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.CANCELLED;
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.55rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}

function fmtMoney(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inp = {
  padding: '0.4rem 0.65rem', border: '1px solid #d1d5db',
  borderRadius: '5px', fontSize: '0.88rem',
};

export default function OwnerPayouts() {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status')    || '';
  const fromParam   = searchParams.get('from_date') || '';
  const toParam     = searchParams.get('to_date')   || '';
  const pageParam   = parseInt(searchParams.get('page') || '1', 10);

  const [statusInput, setStatusInput] = useState(statusParam);
  const [fromInput,   setFromInput]   = useState(fromParam);
  const [toInput,     setToInput]     = useState(toParam);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page: pageParam };
    if (statusParam) params.status    = statusParam;
    if (fromParam)   params.from_date = fromParam;
    if (toParam)     params.to_date   = toParam;
    listPayouts(params)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load payouts.'))
      .finally(() => setLoading(false));
  }, [statusParam, fromParam, toParam, pageParam]);

  useEffect(() => { load(); }, [load]);

  function handleApply(e) {
    e.preventDefault();
    const p = {};
    if (statusInput) p.status    = statusInput;
    if (fromInput)   p.from_date = fromInput;
    if (toInput)     p.to_date   = toInput;
    setSearchParams(p);
  }

  function handleClear() {
    setStatusInput('');
    setFromInput('');
    setToInput('');
    setSearchParams({});
  }

  function setPage(n) {
    const p = Object.fromEntries(searchParams);
    p.page = String(n);
    setSearchParams(p);
  }

  const isFiltered = !!(statusParam || fromParam || toParam);
  const payouts = data?.payouts || [];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
          Payouts
        </h1>

        {/* Filters */}
        <form onSubmit={handleApply} style={{
          background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '1.5rem',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>
              Status
            </div>
            <select value={statusInput} onChange={e => setStatusInput(e.target.value)}
              style={{ ...inp, paddingRight: '1.5rem', cursor: 'pointer' }}>
              <option value="">All</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>
              From
            </div>
            <input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>
              To
            </div>
            <input type="date" value={toInput} onChange={e => setToInput(e.target.value)} style={inp} />
          </div>
          <button type="submit" style={{
            padding: '0.45rem 1.1rem', background: '#1d4ed8', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
          }}>
            Apply
          </button>
          {isFiltered && (
            <button type="button" onClick={handleClear} style={{
              padding: '0.45rem 1rem', background: 'transparent', color: '#6b7280',
              border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
            }}>
              Clear filters
            </button>
          )}
        </form>

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                height: '48px', borderRadius: '8px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%',
              }} />
            ))}
          </div>
        )}

        {!loading && !error && payouts.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '10px', padding: '3rem 2rem', textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💰</div>
            <p style={{ color: '#6b7280', margin: 0, lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
              No payouts yet. Once customers book your turfs and payments are released, payouts will appear here.
            </p>
          </div>
        )}

        {!loading && payouts.length > 0 && (
          <>
            <div style={{
              background: '#fff', borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflowX: 'auto',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {['Scheduled for', 'Paid on', 'Turf', 'Amount', 'Booking', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '0.75rem 1rem', textAlign: 'left',
                        color: '#6b7280', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.payout_id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '0.75rem 1rem', color: '#1e3a5f', whiteSpace: 'nowrap' }}>
                        {fmtDate(p.scheduled_at)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap',
                        color: p.paid_at ? '#374151' : '#9ca3af' }}>
                        {fmtDate(p.paid_at)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', maxWidth: '200px' }}>
                        {p.turf_name}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>
                        {fmtMoney(p.amount)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#9ca3af', fontSize: '0.8rem' }}>
                        #{p.booking_id}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem', textAlign: 'right' }}>
              {data.total_results} payout{data.total_results !== 1 ? 's' : ''}
              {isFiltered ? ' (filtered)' : ''}
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '0.5rem',
                marginTop: '1rem', alignItems: 'center',
              }}>
                <button
                  disabled={pageParam <= 1}
                  onClick={() => setPage(pageParam - 1)}
                  style={{
                    padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                    background: pageParam <= 1 ? '#f9fafb' : '#fff',
                    cursor: pageParam <= 1 ? 'not-allowed' : 'pointer',
                    color: pageParam <= 1 ? '#9ca3af' : '#374151', fontSize: '0.88rem',
                  }}>
                  ← Prev
                </button>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', padding: '0 0.25rem' }}>
                  Page {data.page} of {data.total_pages}
                </span>
                <button
                  disabled={pageParam >= data.total_pages}
                  onClick={() => setPage(pageParam + 1)}
                  style={{
                    padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '5px',
                    background: pageParam >= data.total_pages ? '#f9fafb' : '#fff',
                    cursor: pageParam >= data.total_pages ? 'not-allowed' : 'pointer',
                    color: pageParam >= data.total_pages ? '#9ca3af' : '#374151', fontSize: '0.88rem',
                  }}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
