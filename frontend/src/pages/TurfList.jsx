import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPublicTurfs, getPublicCities } from '../api/turfs';
import TurfCard from '../components/TurfCard';
import Header from '../components/Header';

// Case-insensitive sport labels; values sent to backend (equalsIgnoreCase match on server)
const SPORTS = [
  { label: 'Football',    value: 'Football' },
  { label: 'Cricket',     value: 'Cricket' },
  { label: 'Basketball',  value: 'Basketball' },
  { label: 'Badminton',   value: 'Badminton' },
  { label: 'Tennis',      value: 'Tennis' },
  { label: 'Volleyball',  value: 'Volleyball' },
  { label: 'Squash',      value: 'Squash' },
];

const SORT_OPTIONS = [
  { label: 'Best Rated',        value: 'rating_desc' },
  { label: 'Price: Low → High', value: 'price_asc' },
  { label: 'Price: High → Low', value: 'price_desc' },
  { label: 'Newest',            value: 'newest' },
];

export default function TurfList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read current filters from URL
  const sport  = searchParams.get('sport')   || '';
  const city   = searchParams.get('city')    || '';
  const sortBy = searchParams.get('sort_by') || 'rating_desc';
  const page   = parseInt(searchParams.get('page') || '1', 10);

  const [turfs,      setTurfs]      = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [cities,     setCities]     = useState([]);

  // Fetch city list once for the dropdown
  useEffect(() => {
    getPublicCities()
      .then(res => setCities(res.data.cities || []))
      .catch(() => {}); // non-critical; dropdown falls back to text
  }, []);

  // Fetch turfs whenever filters / page change
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = { sort_by: sortBy, page, page_size: 12 };
    if (sport) params.sport = sport;
    if (city)  params.city  = city;

    getPublicTurfs(params)
      .then(res => {
        // API returns snake_case: total_pages, total_results, page_size
        setTurfs(res.data.turfs || []);
        setTotalPages(res.data.total_pages || 1);
        setTotal(res.data.total_results ?? 0);
      })
      .catch(err => setError(err.response?.data?.error || "Couldn't load turfs. Try again."))
      .finally(() => setLoading(false));
  }, [sport, city, sortBy, page]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1'); // reset pagination on filter change
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => setSearchParams({}, { replace: true });

  const hasActiveFilters = sport || city;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <h1 style={{ margin: '0 0 1.25rem', color: '#1e3a5f', fontSize: '1.5rem', fontWeight: 700 }}>
          Browse Turfs
        </h1>

        {/* ── Filter / sort bar ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          alignItems: 'center',
          background: '#fff',
          padding: '0.9rem 1rem',
          borderRadius: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          marginBottom: '1.5rem',
        }}>
          {/* Sport */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sport</span>
            <select
              value={sport}
              onChange={e => updateFilter('sport', e.target.value)}
              style={{ padding: '0.38rem 0.55rem', borderRadius: '4px', border: '1px solid #d0d5dd', fontSize: '0.85rem', minWidth: '130px', color: '#333' }}
            >
              <option value="">All sports</option>
              {SPORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* City */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>City</span>
            <select
              value={city}
              onChange={e => updateFilter('city', e.target.value)}
              style={{ padding: '0.38rem 0.55rem', borderRadius: '4px', border: '1px solid #d0d5dd', fontSize: '0.85rem', minWidth: '140px', color: '#333' }}
            >
              <option value="">All cities</option>
              {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>

          {/* Sort */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort</span>
            <select
              value={sortBy}
              onChange={e => updateFilter('sort_by', e.target.value)}
              style={{ padding: '0.38rem 0.55rem', borderRadius: '4px', border: '1px solid #d0d5dd', fontSize: '0.85rem', minWidth: '160px', color: '#333' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                alignSelf: 'flex-end',
                padding: '0.38rem 0.8rem',
                background: 'transparent',
                border: '1px solid #d0d5dd',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#555',
                fontSize: '0.85rem',
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading…</div>
        ) : error ? (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
          }}>
            {error}
          </div>
        ) : turfs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3.5rem 1rem',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '1rem' }}>
              No turfs found matching your filters.
            </p>
            <button
              onClick={resetFilters}
              style={{
                padding: '0.5rem 1.3rem',
                background: '#2e86de',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: '#888', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {total} turf{total !== 1 ? 's' : ''} found
            </p>

            {/* Card grid — collapses to 1 col on narrow screens */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}>
              {turfs.map(turf => (
                <TurfCard
                  key={turf.turf_id}
                  turf={turf}
                  onClick={() => navigate(`/turfs/${turf.turf_id}`, { state: { turf } })}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.75rem',
                marginTop: '2rem',
              }}>
                <button
                  onClick={() => updateFilter('page', String(page - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: '1px solid #d0d5dd',
                    borderRadius: '4px',
                    cursor: page <= 1 ? 'default' : 'pointer',
                    opacity: page <= 1 ? 0.4 : 1,
                    background: '#fff',
                    color: '#333',
                  }}
                >
                  ← Previous
                </button>
                <span style={{ color: '#555', fontSize: '0.9rem' }}>Page {page} of {totalPages}</span>
                <button
                  onClick={() => updateFilter('page', String(page + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: '1px solid #d0d5dd',
                    borderRadius: '4px',
                    cursor: page >= totalPages ? 'default' : 'pointer',
                    opacity: page >= totalPages ? 0.4 : 1,
                    background: '#fff',
                    color: '#333',
                  }}
                >
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
