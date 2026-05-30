import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import CourseResultPage from "./pages/CourseResultPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/result" element={<CourseResultPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
