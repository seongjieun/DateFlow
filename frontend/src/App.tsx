import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import PreferencesPage from './pages/PreferencesPage';
import OnboardingPage from './pages/OnboardingPage';
import CourseResultPage from './pages/CourseResultPage';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

function SmartHome() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  useEffect(() => {
    logout();
    navigate('/login', { replace: true });
  }, []);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SmartHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/result" element={<CourseResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
