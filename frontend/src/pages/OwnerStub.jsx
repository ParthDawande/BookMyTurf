import Header from '../components/Header';
import OwnerNav from '../components/OwnerNav';

export default function OwnerStub({ title, coming }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <OwnerNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚧</div>
        <h1 style={{ margin: '0 0 0.5rem', color: '#1e3a5f', fontSize: '1.3rem' }}>{title}</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
          {coming || 'Coming in the next sub-phase.'}
        </p>
      </main>
    </div>
  );
}
