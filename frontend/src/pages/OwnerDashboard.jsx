import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getDashboard } from '../api/ownerDashboard';
import { getProfile } from '../api/ownerTurfs';
import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';
import { ErrorBanner } from '../components/ErrorBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  if (n == null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '1.25rem 1.4rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderTop: `3px solid ${accent || '#e5e7eb'}`,
    }}>
      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.4rem', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: '#1e3a5f' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

// ── Booking status mini-card ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  CONFIRMED:  { label: 'Confirmed',  color: '#166534', bg: '#dcfce7', border: '#86efac' },
  COMPLETED:  { label: 'Completed',  color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  CANCELLED:  { label: 'Cancelled',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  REFUNDED:   { label: 'Refunded',   color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
};

function StatusCard({ status, count }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#374151', bg: '#f3f4f6', border: '#d1d5db' };
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '8px',
      padding: '0.85rem 1rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: cfg.color }}>{count ?? 0}</div>
      <div style={{ fontSize: '0.78rem', color: cfg.color, fontWeight: 500, marginTop: '0.2rem' }}>{cfg.label}</div>
    </div>
  );
}

// ── OwnerDashboard ────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromParam = searchParams.get('from_date') || '';
  const toParam   = searchParams.get('to_date')   || '';

  const [fromInput, setFromInput] = useState(fromParam);
  const [toInput,   setToInput]   = useState(toParam);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // null = not yet fetched; true/false = resolved
  const [bankComplete, setBankComplete] = useState(null);

  const load = useCallback((from, to) => {
    setLoading(true);
    setError(null);
    const params = {};
    if (from) params.from_date = from;
    if (to)   params.to_date   = to;
    getDashboard(params)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(fromParam, toParam); }, [load, fromParam, toParam]);

  // One-time profile fetch to check bank_details_complete
  useEffect(() => {
    getProfile()
      .then(res => setBankComplete(res.data.bank_details_complete))
      .catch(() => {}); // non-critical — silently skip if it fails
  }, []);

  function handleFilterSubmit(e) {
    e.preventDefault();
    const p = {};
    if (fromInput) p.from_date = fromInput;
    if (toInput)   p.to_date   = toInput;
    setSearchParams(p);
  }

  function handleClearFilters() {
    setFromInput('');
    setToInput('');
    setSearchParams({});
  }

  const isFiltered = !!(fromParam || toParam);
  const isEmpty = data && Number(data.total_revenue) === 0 &&
    Object.values(data.bookings_by_status || {}).every(v => v === 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Bank-details incomplete banner */}
        {bankComplete === false && (
          <div style={{
            background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px',
            padding: '0.75rem 1.1rem', marginBottom: '1.1rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1.1rem' }}>🏦</span>
            <span style={{ fontSize: '0.88rem', color: '#92400e', flex: 1 }}>
              Your bank details are incomplete. Add your bank account to receive payouts.
            </span>
            <Link to="/owner/account" style={{
              fontSize: '0.85rem', color: '#92400e', fontWeight: 600,
              textDecoration: 'underline', whiteSpace: 'nowrap',
            }}>
              Complete now →
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>Dashboard</h1>
        </div>

        {/* Date filter */}
        <form onSubmit={handleFilterSubmit} style={{
          background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '1.5rem',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>From</div>
            <input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)}
              style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.88rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>To</div>
            <input type="date" value={toInput} onChange={e => setToInput(e.target.value)}
              style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.88rem' }} />
          </div>
          <button type="submit" style={{
            padding: '0.45rem 1.1rem', background: '#1d4ed8', color: '#fff',
            border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
          }}>
            Apply
          </button>
          {isFiltered && (
            <button type="button" onClick={handleClearFilters} style={{
              padding: '0.45rem 1rem', background: 'transparent', color: '#6b7280',
              border: '1px solid #d1d5db', borderRadius: '5px', cursor: 'pointer', fontSize: '0.88rem',
            }}>
              Clear filters
            </button>
          )}
          {isFiltered && (
            <span style={{ fontSize: '0.8rem', color: '#6b7280', alignSelf: 'center' }}>
              {fromParam} → {toParam || 'today'}
            </span>
          )}
        </form>

        {error && <ErrorBanner error={{ message: error }} />}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', height: '90px',
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)', backgroundSize: '200% 100%' }} />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Row 1: Revenue KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <KpiCard label="Total Revenue"       value={fmtMoney(data.total_revenue)}       accent="#1d4ed8" />
              <KpiCard label="Platform Commission" value={fmtMoney(data.total_commission)}    accent="#9ca3af" sub="Deducted from revenue" />
              <KpiCard label="Your Earnings"       value={fmtMoney(data.owner_payout_total)}  accent="#166534" />
            </div>

            {/* Row 2: Bookings by status */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.25rem 1.4rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.88rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.85rem' }}>
                BOOKINGS BY STATUS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                {['CONFIRMED','COMPLETED','CANCELLED','REFUNDED'].map(status => (
                  <StatusCard key={status} status={status} count={data.bookings_by_status?.[status] ?? 0} />
                ))}
              </div>
            </div>

            {/* Row 3: Payouts summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <KpiCard label="Pending Payout"     value={fmtMoney(data.payouts_summary?.pending_amount)}   accent="#f59e0b" />
              <KpiCard label="Paid Out"            value={fmtMoney(data.payouts_summary?.paid_amount)}       accent="#166534" />
              <KpiCard label="Cancelled Payouts"   value={fmtMoney(data.payouts_summary?.cancelled_amount)} accent="#9ca3af" />
            </div>

            {/* Empty state CTA */}
            {isEmpty && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
                padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏟️</div>
                <p style={{ margin: '0 0 0.75rem', color: '#1e3a5f', fontWeight: 500 }}>
                  No data yet. Add your first turf to start receiving bookings.
                </p>
                <button onClick={() => navigate('/owner/turfs')} style={{
                  padding: '0.55rem 1.3rem', background: '#1d4ed8', color: '#fff',
                  border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                }}>
                  Add your first turf →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
