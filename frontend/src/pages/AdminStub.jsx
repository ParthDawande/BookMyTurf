import Header from '../components/Header';
import AdminNav from '../components/AdminNav';

export default function AdminStub({ title }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Header />
      <AdminNav />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔧</div>
        <h1 style={{ margin: '0 0 0.5rem', color: '#1e3a5f', fontSize: '1.4rem', fontWeight: 700 }}>{title}</h1>
        <p style={{ color: '#6b7280', margin: 0 }}>Coming in 9-admin-operations.</p>
      </main>
    </div>
  );
}
