import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoleGuard } from './components/RoleGuard';

import Landing      from './pages/Landing';
import Login        from './pages/Login';
import Register     from './pages/Register';
import RegisterOwner from './pages/RegisterOwner';
import CustomerHome from './pages/CustomerHome';
import AdminHome    from './pages/AdminHome';
import StaffHome    from './pages/StaffHome';
import TurfList      from './pages/TurfList';
import TurfDetail    from './pages/TurfDetail';
import BookingReceipt  from './pages/BookingReceipt';
import MyBookings      from './pages/MyBookings';
import ReschedulePage  from './pages/ReschedulePage';
import ComplaintNew    from './pages/ComplaintNew';
import ComplaintList   from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';
import QueryNew        from './pages/QueryNew';
import QueryList       from './pages/QueryList';
import QueryDetail     from './pages/QueryDetail';
import NotificationsPage from './pages/NotificationsPage';
import OwnerDashboard  from './pages/OwnerDashboard';
import OwnerStub       from './pages/OwnerStub';
import OwnerNav        from './components/OwnerNav';

function CG({ children }) {
  return <RoleGuard role="CUSTOMER">{children}</RoleGuard>;
}
function OG({ children }) {
  return <RoleGuard role="OWNER">{children}</RoleGuard>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"              element={<Landing />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/register"      element={<Register />} />
        <Route path="/register-owner" element={<RegisterOwner />} />

        {/* Public browse */}
        <Route path="/turfs"      element={<TurfList />} />
        <Route path="/turfs/:id"  element={<TurfDetail />} />

        {/* Customer — specific routes before wildcard */}
        <Route path="/customer/bookings"                element={<CG><MyBookings /></CG>} />
        <Route path="/customer/bookings/:id/reschedule" element={<CG><ReschedulePage /></CG>} />
        <Route path="/customer/bookings/:id"            element={<CG><BookingReceipt /></CG>} />
        <Route path="/customer/complaints/new"          element={<CG><ComplaintNew /></CG>} />
        <Route path="/customer/complaints/:id"          element={<CG><ComplaintDetail /></CG>} />
        <Route path="/customer/complaints"              element={<CG><ComplaintList /></CG>} />
        <Route path="/customer/queries/new"             element={<CG><QueryNew /></CG>} />
        <Route path="/customer/queries/:id"             element={<CG><QueryDetail /></CG>} />
        <Route path="/customer/queries"                 element={<CG><QueryList /></CG>} />
        <Route path="/customer/notifications"           element={<CG><NotificationsPage /></CG>} />
        <Route path="/customer/*"                       element={<CG><CustomerHome /></CG>} />

        {/* Owner — /owner redirects to /owner/dashboard */}
        <Route path="/owner"              element={<Navigate to="/owner/dashboard" replace />} />
        <Route path="/owner/dashboard"    element={<OG><OwnerDashboard /></OG>} />
        <Route path="/owner/notifications" element={<OG><NotificationsPage Nav={OwnerNav} /></OG>} />
        <Route path="/owner/turfs"        element={<OG><OwnerStub title="My Turfs" coming="Coming in 9-owner-turf-management." /></OG>} />
        <Route path="/owner/payouts"      element={<OG><OwnerStub title="Payouts" coming="Coming in 9-owner-finance-and-engagement." /></OG>} />
        <Route path="/owner/reviews"      element={<OG><OwnerStub title="Reviews" coming="Coming in 9-owner-finance-and-engagement." /></OG>} />
        <Route path="/owner/*"            element={<OG><OwnerDashboard /></OG>} />

        <Route path="/admin/*"  element={<RoleGuard role="ADMIN"><AdminHome /></RoleGuard>} />
        <Route path="/staff/*"  element={<RoleGuard role="STAFF"><StaffHome /></RoleGuard>} />
      </Routes>
    </AuthProvider>
  );
}
