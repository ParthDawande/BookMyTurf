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
import OwnerNav        from './components/OwnerNav';
import OwnerTurfList   from './pages/OwnerTurfList';
import OwnerTurfNew    from './pages/OwnerTurfNew';
import OwnerTurfDetail from './pages/OwnerTurfDetail';
import OwnerPayouts    from './pages/OwnerPayouts';
import OwnerReviews    from './pages/OwnerReviews';
import OwnerAccount    from './pages/OwnerAccount';
import AdminDashboard  from './pages/AdminDashboard';
import AdminApprovals  from './pages/AdminApprovals';
import AdminUsers      from './pages/AdminUsers';
import AdminStaff      from './pages/AdminStaff';
import AdminComplaints from './pages/AdminComplaints';
import AdminQueries    from './pages/AdminQueries';
import AdminNav        from './components/AdminNav';
import StaffComplaints from './pages/StaffComplaints';
import StaffQueries    from './pages/StaffQueries';
import StaffNav        from './components/StaffNav';

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

        {/* Customer — /customer redirects to /customer/bookings */}
        <Route path="/customer" element={<Navigate to="/customer/bookings" replace />} />

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
        <Route path="/owner/turfs/new"     element={<OG><OwnerTurfNew /></OG>} />
        <Route path="/owner/turfs/:id"    element={<OG><OwnerTurfDetail /></OG>} />
        <Route path="/owner/turfs"        element={<OG><OwnerTurfList /></OG>} />
        <Route path="/owner/payouts"       element={<OG><OwnerPayouts /></OG>} />
        <Route path="/owner/reviews"       element={<OG><OwnerReviews /></OG>} />
        <Route path="/owner/account"       element={<OG><OwnerAccount /></OG>} />
        <Route path="/owner/*"             element={<OG><OwnerDashboard /></OG>} />

        {/* Admin */}
        <Route path="/admin"               element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard"     element={<RoleGuard role="ADMIN"><AdminDashboard /></RoleGuard>} />
        <Route path="/admin/notifications" element={<RoleGuard role="ADMIN"><NotificationsPage Nav={AdminNav} /></RoleGuard>} />
        <Route path="/admin/approvals"     element={<RoleGuard role="ADMIN"><AdminApprovals /></RoleGuard>} />
        <Route path="/admin/users"         element={<RoleGuard role="ADMIN"><AdminUsers /></RoleGuard>} />
        <Route path="/admin/staff"         element={<RoleGuard role="ADMIN"><AdminStaff /></RoleGuard>} />
        <Route path="/admin/complaints"    element={<RoleGuard role="ADMIN"><AdminComplaints /></RoleGuard>} />
        <Route path="/admin/queries"       element={<RoleGuard role="ADMIN"><AdminQueries /></RoleGuard>} />
        <Route path="/admin/*"             element={<RoleGuard role="ADMIN"><AdminDashboard /></RoleGuard>} />
        {/* Staff */}
        <Route path="/staff"                 element={<Navigate to="/staff/complaints" replace />} />
        <Route path="/staff/complaints"      element={<RoleGuard role="STAFF"><StaffComplaints /></RoleGuard>} />
        <Route path="/staff/queries"         element={<RoleGuard role="STAFF"><StaffQueries /></RoleGuard>} />
        <Route path="/staff/notifications"   element={<RoleGuard role="STAFF"><NotificationsPage Nav={StaffNav} /></RoleGuard>} />
        <Route path="/staff/*"               element={<RoleGuard role="STAFF"><StaffComplaints /></RoleGuard>} />
      </Routes>
    </AuthProvider>
  );
}
