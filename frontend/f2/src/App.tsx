import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import EventSelectPage from "./pages/EventSelectPage";
import CourseSelectPage from "./pages/CourseSelectPage";
import CourseResultPage from "./pages/CourseResultPage";
import BookingPage from "./pages/BookingPage";
import CompletePage from "./pages/CompletePage";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><EventSelectPage /></ProtectedRoute>} />
          <Route path="/courses" element={<ProtectedRoute><CourseSelectPage /></ProtectedRoute>} />
          <Route path="/result" element={<ProtectedRoute><CourseResultPage /></ProtectedRoute>} />
          <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/complete" element={<ProtectedRoute><CompletePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
