import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/adminDashboard';
import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n) {
  if (n == null) return '₹0.00';
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: '10px', padding: '1.25rem 1.4rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        borderTop: `3px solid ${accent || '#e5e7eb'}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.14)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'; }}
    >
      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.4rem', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 700, color: '#1e3a5f' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  );
}

// ── Booking / payout status mini-cards ───────────────────────────────────────

const STATUS_CFG = {
  CONFIRMED:  { label: 'Confirmed',  color: '#166534', bg: '#dcfce7', border: '#86efac' },
  COMPLETED:  { label: 'Completed',  color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
  CANCELLED:  { label: 'Cancelled',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  REFUNDED:   { label: 'Refunded',   color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
};

const PAYOUT_CFG = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  paid:      { label: 'Paid Out',  color: '#166534', bg: '#dcfce7', border: '#86efac' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

function MiniCard({ label, value, color, bg, border }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: '8px',
      padding: '0.85rem 1rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value ?? 0}</div>
      <div style={{ fontSize: '0.78rem', color, fontWeight: 500, marginTop: '0.2rem' }}>{label}</div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.78rem', color: '#6b7280', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem',
    }}>
      {children}
    </div>
  );
}

// ── AdminDashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromParam = searchParams.get('from_date') || '';
  const toParam   = searchParams.get('to_date')   || '';

  const [fromInput, setFromInput] = useState(fromParam);
  const [toInput,   setToInput]   = useState(toParam);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>
            Admin Dashboard
          </h1>
        </div>

        {/* Date filter */}
        <form onSubmit={handleFilterSubmit} style={{
          background: '#fff', borderRadius: '10px', padding: '1rem 1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '1.5rem',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>
              From
            </div>
            <input type="date" value={fromInput} onChange={e => setFromInput(e.target.value)}
              style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.88rem' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.3rem', fontWeight: 500 }}>
              To
            </div>
            <input type="date" value={toInput} onChange={e => setToInput(e.target.value)}
              style={{ padding: '0.4rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.88rem' }} />
          </div>
          <button type="submit" style={{
            padding: '0.45rem 1.1rem', background: '#7c3aed', color: '#fff',
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

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
            padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  borderRadius: '10px', height: '90px',
                  background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                  backgroundSize: '200% 100%',
                }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  borderRadius: '10px', height: '80px',
                  background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                  backgroundSize: '200% 100%',
                }} />
              ))}
            </div>
          </>
        )}

        {!loading && data && (
          <>
            {/* ── Section 1: Financial overview (date-filtered) ──────────────── */}
            <div style={{ marginBottom: '1.75rem' }}>
              <SectionLabel>Financial Overview{isFiltered ? ` · ${fromParam} → ${toParam}` : ' · All Time'}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <KpiCard label="Total Revenue"       value={fmtMoney(data.total_revenue)}        accent="#7c3aed" />
                <KpiCard label="Platform Commission" value={fmtMoney(data.platform_commission)}   accent="#9ca3af" sub="Platform's earned share" />
                <KpiCard label="Owners' Payouts"     value={fmtMoney(data.owners_payout_total)}   accent="#166534" />
              </div>
            </div>

            {/* ── Section 2: Operational snapshot (NOT date-filtered) ────────── */}
            <div style={{
              background: '#fff', borderRadius: '10px', padding: '1.25rem 1.4rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '1rem' }}>
                <SectionLabel>Current State</SectionLabel>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                  These reflect the current operational state, not the date range.
                </span>
              </div>

              {/* Pending approvals */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>
                  PENDING APPROVALS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <KpiCard
                    label="Turfs Awaiting Approval"
                    value={data.pending_approvals?.turfs ?? 0}
                    accent="#f59e0b"
                    sub="Click to review"
                    onClick={() => navigate('/admin/approvals')}
                  />
                  <KpiCard
                    label="Sub-Courts Awaiting"
                    value={data.pending_approvals?.sub_courts ?? 0}
                    accent="#f59e0b"
                    sub="Click to review"
                    onClick={() => navigate('/admin/approvals')}
                  />
                </div>
              </div>

              {/* Open tickets */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>
                  OPEN SUPPORT TICKETS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <KpiCard
                    label="Open Complaints"
                    value={data.open_complaints ?? 0}
                    accent="#dc2626"
                    sub="Click to manage"
                    onClick={() => navigate('/admin/complaints')}
                  />
                  <KpiCard
                    label="Open Queries"
                    value={data.open_queries ?? 0}
                    accent="#2563eb"
                    sub="Click to manage"
                    onClick={() => navigate('/admin/queries')}
                  />
                </div>
              </div>

              {/* Active users */}
              <div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>
                  ACTIVE USERS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                  <KpiCard label="Customers" value={data.active_users?.customers ?? 0} accent="#0369a1" />
                  <KpiCard label="Owners"    value={data.active_users?.owners    ?? 0} accent="#166534" />
                  <KpiCard label="Staff"     value={data.active_users?.staff     ?? 0} accent="#7c3aed" />
                </div>
              </div>
            </div>

            {/* ── Section 3: Bookings + payouts (date-filtered) ──────────────── */}
            <div style={{ marginBottom: '1.25rem' }}>
              <SectionLabel>Bookings by Status{isFiltered ? ` · ${fromParam} → ${toParam}` : ''}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                {['CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].map(status => {
                  const cfg = STATUS_CFG[status];
                  return (
                    <MiniCard
                      key={status}
                      label={cfg.label}
                      value={data.bookings_by_status?.[status] ?? 0}
                      color={cfg.color} bg={cfg.bg} border={cfg.border}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Payouts Summary{isFiltered ? ` · ${fromParam} → ${toParam}` : ''}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {[
                  { key: 'pending',   field: 'pending_amount' },
                  { key: 'paid',      field: 'paid_amount' },
                  { key: 'cancelled', field: 'cancelled_amount' },
                ].map(({ key, field }) => {
                  const cfg = PAYOUT_CFG[key];
                  return (
                    <MiniCard
                      key={key}
                      label={cfg.label}
                      value={fmtMoney(data.payouts_summary?.[field])}
                      color={cfg.color} bg={cfg.bg} border={cfg.border}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
