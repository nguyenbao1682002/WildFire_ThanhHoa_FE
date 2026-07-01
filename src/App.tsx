import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import Incidents from './pages/Incidents'
import Analytics from './pages/Analytics'
import Hotspots from './pages/Hotspots'
import Users from './pages/Users'
import Profile from './pages/Profile'
import AuditLog from './pages/AuditLog'
import Bulletins from './pages/Bulletins'
import Search from './pages/Search'
import Performance from './pages/Performance'
import AOR from './pages/AOR'
import FAQ from './pages/FAQ'
import Timelapse from './pages/Timelapse'
import Integrations from './pages/Integrations'
import CameraStations from './pages/CameraStations'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="map"        element={<MapPage />} />
          <Route path="incidents"  element={<Incidents />} />
          <Route path="hotspots"   element={<Hotspots />} />
          <Route path="analytics"  element={<Analytics />} />
          <Route path="users"      element={<Users />} />
          <Route path="profile"    element={<Profile />} />
          <Route path="audit-log"  element={<AuditLog />} />
          <Route path="bulletins"  element={<Bulletins />} />
          <Route path="search"       element={<Search />} />
          <Route path="performance"  element={<Performance />} />
          <Route path="aor"          element={<AOR />} />
          <Route path="faq"          element={<FAQ />} />
          <Route path="timelapse"      element={<Timelapse />} />
          <Route path="integrations"   element={<Integrations />} />
          <Route path="cameras"        element={<CameraStations />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
