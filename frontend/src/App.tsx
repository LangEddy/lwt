import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { UpdateBanner } from "./components/UpdateBanner";
import { syncPendingWrites } from "./lib/offlineSync";
import DashboardPage from "./pages/DashboardPage";
import LearnPage from "./pages/LearnPage";
import LoginPage from "./pages/LoginPage";
import ReaderPage from "./pages/ReaderPage";
import SentencesPage from "./pages/SentencesPage";
import SettingsPage from "./pages/SettingsPage";
import TextEditorPage from "./pages/TextEditorPage";
import TextsPage from "./pages/TextsPage";
import TriviasPage from "./pages/TriviasPage";
import WordListPage from "./pages/WordListPage";
import { useAuthStore } from "./stores/authStore";

const QUERY_KEYS_TO_REFRESH = [
  ["texts"],
  ["words"],
  ["examples"],
  ["languages"],
  ["sentences"],
] as const;

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

function canAccessOfflineApp(
  token: string | null,
  canUseOffline: boolean,
  isOnline: boolean,
) {
  return Boolean(token) || (canUseOffline && !isOnline);
}

function PrivateRoute({
  children,
  isOnline,
}: {
  children: React.ReactNode;
  isOnline: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const canUseOffline = useAuthStore((s) => s.canUseOffline);

  if (isLoading) return null;

  return canAccessOfflineApp(token, canUseOffline, isOnline) ? (
    <Layout>{children}</Layout>
  ) : (
    <Navigate to="/login" replace />
  );
}

function PublicRoute({
  children,
  isOnline,
}: {
  children: React.ReactNode;
  isOnline: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const canUseOffline = useAuthStore((s) => s.canUseOffline);

  if (isLoading) return null;

  return canAccessOfflineApp(token, canUseOffline, isOnline) ? (
    <Navigate to="/" replace />
  ) : (
    <>{children}</>
  );
}

function OfflineSyncController({ isOnline }: { isOnline: boolean }) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOnline || !token) {
      return;
    }

    let cancelled = false;

    const syncAndRefresh = async () => {
      const syncedAny = await syncPendingWrites();
      if (!syncedAny || cancelled) {
        return;
      }

      await Promise.all(
        QUERY_KEYS_TO_REFRESH.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      );
    };

    void syncAndRefresh();

    return () => {
      cancelled = true;
    };
  }, [isOnline, queryClient, token]);

  return null;
}

function App() {
  const isOnline = useOnlineStatus();

  return (
    <BrowserRouter>
      <UpdateBanner />
      <OfflineSyncController isOnline={isOnline} />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute isOnline={isOnline}>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute isOnline={isOnline}>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts"
          element={
            <PrivateRoute isOnline={isOnline}>
              <TextsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/trivia"
          element={
            <PrivateRoute isOnline={isOnline}>
              <TriviasPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/trivia/:id"
          element={
            <PrivateRoute isOnline={isOnline}>
              <ReaderPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/new"
          element={
            <PrivateRoute isOnline={isOnline}>
              <TextEditorPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/:id"
          element={
            <PrivateRoute isOnline={isOnline}>
              <ReaderPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/texts/:id/edit"
          element={
            <PrivateRoute isOnline={isOnline}>
              <TextEditorPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/learn"
          element={
            <PrivateRoute isOnline={isOnline}>
              <LearnPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/words"
          element={
            <PrivateRoute isOnline={isOnline}>
              <WordListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/sentences"
          element={
            <PrivateRoute isOnline={isOnline}>
              <SentencesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute isOnline={isOnline}>
              <SettingsPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
