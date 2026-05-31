import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OnboardingPage from './pages/OnboardingPage';
import EventSelectPage from './pages/EventSelectPage';
import CourseSelectPage from './pages/CourseSelectPage';
import CourseResultPage from './pages/CourseResultPage';
import BookingPage from './pages/BookingPage';
import CompletePage from './pages/CompletePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnboardingPage />} />
        <Route path="/events" element={<EventSelectPage />} />
        <Route path="/courses" element={<CourseSelectPage />} />
        <Route path="/result" element={<CourseResultPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/complete" element={<CompletePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
