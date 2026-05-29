import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createQuery } from '../api/queries';
import Header from '../components/Header';
import CustomerNav from '../components/CustomerNav';

export default function QueryNew() {
  const navigate = useNavigate();
  const [subject,     setSubject]     = useState('');
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await createQuery({ subject, description });
      navigate(`/customer/queries/${res.data.query_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit query. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <CustomerNav />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <button onClick={() => navigate('/customer/queries')}
          style={{ background: 'none', border: 'none', color: '#2e86de', cursor: 'pointer', fontSize: '0.88rem', padding: 0, marginBottom: '1rem' }}>
          ← Queries
        </button>

        <h1 style={{ margin: '0 0 1.5rem', color: '#1e3a5f', fontSize: '1.35rem', fontWeight: 700 }}>
          Ask a question
        </h1>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Subject <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text" required maxLength={200}
                value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="What's your question about?"
                style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                  border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Description <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                required rows={5}
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Provide details about your query…"
                style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '5px',
                  border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
                padding: '0.6rem 0.9rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} style={{
              width: '100%', padding: '0.65rem',
              background: submitting ? '#93c5fd' : '#1d4ed8',
              color: '#fff', border: 'none', borderRadius: '5px',
              cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95rem',
            }}>
              {submitting ? 'Submitting…' : 'Submit query'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
