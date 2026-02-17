import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import EditorPage from './pages/EditorPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import SharedDocumentPage from './pages/SharedDocumentPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/shared/:token" element={<SharedDocumentPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/documents/:documentId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
    </Routes>
  );
}
