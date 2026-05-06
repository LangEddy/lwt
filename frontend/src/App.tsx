import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LearnPage from "./pages/LearnPage";
import LoginPage from "./pages/LoginPage";
import ReaderPage from "./pages/ReaderPage";
import SettingsPage from "./pages/SettingsPage";
import TextEditorPage from "./pages/TextEditorPage";
import TextsPage from "./pages/TextsPage";
import WordListPage from "./pages/WordListPage";
import { useAuthStore } from "./stores/authStore";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts"
          element={
            <PrivateRoute>
              <TextsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/new"
          element={
            <PrivateRoute>
              <TextEditorPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/:id"
          element={
            <PrivateRoute>
              <ReaderPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/:id/edit"
          element={
            <PrivateRoute>
              <TextEditorPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/learn"
          element={
            <PrivateRoute>
              <LearnPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/words"
          element={
            <PrivateRoute>
              <WordListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <SettingsPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
