import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';

export default function BookingReceipt() {
  const { id }   = useParams();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1 style={{ color: '#1e3a5f', marginBottom: '0.5rem' }}>Booking Confirmed!</h1>
        <p style={{ color: '#555', marginBottom: '0.25rem', fontSize: '0.95rem' }}>
          Your booking has been confirmed.
        </p>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Booking ID: <strong style={{ color: '#1e3a5f' }}>#{id}</strong>
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/turfs')}
            style={{
              padding: '0.6rem 1.4rem', background: '#2e86de', color: '#fff',
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
            }}
          >
            Browse more turfs
          </button>
          <button
            onClick={() => navigate('/customer')}
            style={{
              padding: '0.6rem 1.4rem', background: 'transparent',
              border: '1px solid #2e86de', color: '#2e86de',
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            My bookings (next sub-phase)
          </button>
        </div>
      </main>
    </div>
  );
}
