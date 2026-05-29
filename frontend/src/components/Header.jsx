import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.5rem',
      background: '#1e3a5f',
      color: '#fff',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '0.5px' }}>
        BookMyTurf
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <Link to="/turfs" style={{ color: '#cce4ff', textDecoration: 'none', fontSize: '0.9rem' }}>Browse Turfs</Link>
        {isAuthenticated ? (
          <>
            <span style={{ fontSize: '0.85rem', color: '#a8d4ff', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </span>
            <button
              onClick={logout}
              style={{
                background: 'transparent',
                border: '1px solid #cce4ff',
                color: '#fff',
                padding: '0.3rem 0.8rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ color: '#cce4ff', textDecoration: 'none', fontSize: '0.9rem' }}>Login</Link>
            <Link
              to="/register"
              style={{
                background: '#2e86de',
                color: '#fff',
                textDecoration: 'none',
                padding: '0.3rem 0.9rem',
                borderRadius: '4px',
                fontSize: '0.85rem',
              }}
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
