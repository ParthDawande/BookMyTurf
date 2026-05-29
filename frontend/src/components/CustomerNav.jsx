import { NavLink } from 'react-router-dom';

const links = [
  { to: '/customer/bookings',      label: 'My Bookings' },
  { to: '/customer/notifications', label: 'Notifications' },
  { to: '/customer/complaints',    label: 'Complaints' },
  { to: '/customer/queries',       label: 'Queries' },
];

export default function CustomerNav() {
  return (
    <nav style={{
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      padding: '0 1rem', display: 'flex', gap: 0,
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
