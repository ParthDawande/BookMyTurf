import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuery } from '../api/queries';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_STYLE = {
  OPEN:        { bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { bg: '#fef3c7', color: '#92400e' },
  RESOLVED:    { bg: '#dcfce7', color: '#166534' },
};

const STATUS_MESSAGE = {
  OPEN:        'We have received your query and will respond shortly.',
  IN_PROGRESS: 'Your query is being reviewed by our support team.',
};

export default function QueryDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [query,   setQuery]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    getQuery(id)
      .then(res => setQuery(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('not_found');
        else setError('Failed to load query.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><CustomerNav />
      <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>Loading…</div>
    </div>
  );

  if (error === 'not_found') return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><CustomerNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>❌</div>
        <p style={{ color: '#555', marginBottom: '1rem' }}>Query not found.</p>
        <button onClick={() => navigate('/customer/queries')}
          style={{ color: '#2e86de', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          ← Back to Queries
        </button>
      </main>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}><Header /><CustomerNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#555' }}>{error}</p>
      </main>
    </div>
  );

  const { status } = query;
  const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#6b7280' };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <CustomerNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <button onClick={() => navigate('/customer/queries')}
          style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' }}>
          ← Queries
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>
            Query #{query.query_id}
          </h1>
          <span style={{ display: 'inline-block', padding: '0.25rem 0.8rem', borderRadius: '999px',
            fontSize: '0.85rem', fontWeight: 600, background: s.bg, color: s.color }}>
            {status}
          </span>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.88rem', color: '#9ca3af', marginBottom: '0.3rem' }}>Subject</div>
          <div style={{ fontWeight: 600, color: '#1e3a5f', fontSize: '1rem', marginBottom: '1rem' }}>{query.subject}</div>

          <div style={{ fontSize: '0.88rem', color: '#9ca3af', marginBottom: '0.3rem' }}>Description</div>
          <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {query.description}
          </p>

          <div style={{ fontSize: '0.88rem', color: '#6b7280' }}>
            Raised on {fmtDate(query.created_at)}
          </div>
        </div>

        <div style={{
          background: s.bg + '66', border: `1px solid ${s.bg}`,
          borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.88rem', color: s.color,
        }}>
          {status === 'RESOLVED'
            ? `Resolved on ${fmtDate(query.resolved_at)}.`
            : STATUS_MESSAGE[status]}
        </div>
      </main>
    </div>
  );
}
