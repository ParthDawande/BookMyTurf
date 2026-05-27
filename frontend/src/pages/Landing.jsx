import { Link } from 'react-router-dom';

const s = {
  wrap:   { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  header: { background: 'var(--color-primary)', color: '#fff', padding: 'var(--space-4) var(--space-8)' },
  title:  { fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: '#fff' },
  hero:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-6)', padding: 'var(--space-12)' },
  h1:     { fontSize: 'var(--font-size-4xl)', color: 'var(--color-neutral-900)' },
  sub:    { fontSize: 'var(--font-size-lg)', color: 'var(--color-neutral-600)' },
  ctas:   { display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' },
  btnPrimary: { padding: 'var(--space-3) var(--space-8)', background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-base)', textDecoration: 'none' },
  btnSecondary: { padding: 'var(--space-3) var(--space-8)', background: '#fff', color: 'var(--color-primary)', border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-base)', textDecoration: 'none' },
  footer: { textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-neutral-400)', fontSize: 'var(--font-size-sm)', borderTop: '1px solid var(--color-neutral-200)' },
};

export default function Landing() {
  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <span style={s.title}>BookMyTurf</span>
      </header>

      <main style={s.hero}>
        <h1 style={s.h1}>BookMyTurf</h1>
        <p style={s.sub}>Book sports turf slots online — fast, simple, and reliable.</p>
        <div style={s.ctas}>
          <Link to="/login"    style={s.btnPrimary}>Login</Link>
          <Link to="/register" style={s.btnSecondary}>Register</Link>
        </div>
      </main>

      <footer style={s.footer}>
        &copy; {new Date().getFullYear()} BookMyTurf. All rights reserved.
      </footer>
    </div>
  );
}
