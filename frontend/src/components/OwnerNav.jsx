import { NavLink } from 'react-router-dom';

const links = [
  { to: '/owner/dashboard',     label: 'Dashboard' },
  { to: '/owner/turfs',         label: 'My Turfs' },
  { to: '/owner/payouts',       label: 'Payouts' },
  { to: '/owner/reviews',       label: 'Reviews' },
  { to: '/owner/notifications', label: 'Notifications' },
];

export default function OwnerNav() {
  return (
    <nav style={{
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      padding: '0 1rem', display: 'flex', gap: 0, overflowX: 'auto',
    }}>
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'inline-block', padding: '0.65rem 1.1rem',
            fontSize: '0.88rem', fontWeight: isActive ? 600 : 400,
            color: isActive ? '#1d4ed8' : '#374151',
            borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
            textDecoration: 'none', whiteSpace: 'nowrap',
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
