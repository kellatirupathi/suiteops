import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Guests from './pages/Guests.jsx';
import GuestDetail from './pages/GuestDetail.jsx';
import Dues from './pages/Dues.jsx';
import Inventory from './pages/Inventory.jsx';
import Rooms from './pages/Rooms.jsx';
import Activity from './pages/Activity.jsx';
import Staff from './pages/Staff.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/guests/:id" element={<GuestDetail />} />
        <Route path="/dues" element={<Dues />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route
          path="/rooms"
          element={
            <ProtectedRoute managerOnly>
              <Rooms />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute managerOnly>
              <Activity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute managerOnly>
              <Staff />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<div className="p-8">Page not found</div>} />
    </Routes>
  );
}
