import {
  BookOpen,
  Brain,
  Home,
  List,
  LogOut,
  Menu,
  MessageSquare,
  Sparkles,
  User,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    "Learner";
  const userEmail = user?.email ?? "";

  const handleSignOut = async () => {
    await logout();
    setSidebarOpen(false);
    navigate("/login", { replace: true });
  };

  const handleOpenSettings = () => {
    navigate("/settings");
    setSidebarOpen(false);
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const tabs = [
    { id: "/", icon: Home, label: "Home" },
    { id: "/texts", icon: BookOpen, label: "Texts" },
    { id: "/trivia", icon: Sparkles, label: "Trivia" },
    { id: "/learn", icon: Brain, label: "Learn" },
    { id: "/words", icon: List, label: "Words" },
  ];

  const navItems = [
    { id: "/", icon: Home, label: "Dashboard" },
    { id: "/texts", icon: BookOpen, label: "Texts" },
    { id: "/trivia", icon: Sparkles, label: "Trivia" },
    { id: "/learn", icon: Brain, label: "Learn" },
    { id: "/words", icon: List, label: "Word List" },
    { id: "/sentences", icon: MessageSquare, label: "Sentences" },
  ];

  // Hide bottom nav on immersive screens (reader, text editor)
  const hideBottomNav =
    location.pathname.startsWith("/texts/") ||
    location.pathname.startsWith("/trivia/");

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] lg:flex-row">
      {/* Mobile header */}
      {!isDesktop && (
        <header className="flex items-center gap-2 px-4 h-14 bg-[var(--color-text)] text-[var(--color-surface)] shrink-0 sticky top-0 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="flex-1 font-bold text-lg tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
            LWT
          </span>
        </header>
      )}

      {/* Desktop sidebar */}
      {isDesktop && (
        <aside className="w-[240px] shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-screen sticky top-0">
          <div className="px-5 py-6 border-b border-[var(--color-border)]">
            <span className="font-serif text-2xl font-normal tracking-tight">
              LWT
            </span>
            <p className="text-xs text-[var(--color-text3)] mt-0.5">
              Learn With Text
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.id ||
                (item.id !== "/" && location.pathname.startsWith(item.id));
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-bg)] text-[var(--color-text)]"
                      : "text-[var(--color-text2)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="p-4 border-t border-[var(--color-border)]">
            <button
              onClick={handleOpenSettings}
              aria-label="Open settings"
              className={`flex items-center gap-3 w-full px-3 py-2 mb-2 rounded-lg transition-colors text-left ${
                location.pathname.startsWith("/settings")
                  ? "bg-[var(--color-bg)]"
                  : "hover:bg-[var(--color-bg)]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg2)] flex items-center justify-center shrink-0">
                <User size={16} className="text-[var(--color-text3)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{userName}</p>
                <p className="text-[11px] text-[var(--color-text3)] truncate">
                  {userEmail}
                </p>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[15px] font-medium text-[var(--color-red)] hover:bg-[var(--color-red-bg)] transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      {!isDesktop && (
        <aside
          className={`fixed top-0 left-0 bottom-0 w-[280px] bg-[var(--color-surface)] border-r border-[var(--color-border)] z-[201] flex flex-col transition-transform duration-250 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
        >
          <div className="px-5 py-6 border-b border-[var(--color-border)]">
            <span className="font-serif text-2xl font-normal tracking-tight">
              LWT
            </span>
            <p className="text-xs text-[var(--color-text3)] mt-0.5">
              Learn With Text
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.id ||
                (item.id !== "/" && location.pathname.startsWith(item.id));
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-bg)] text-[var(--color-text)]"
                      : "text-[var(--color-text2)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="p-4 border-t border-[var(--color-border)]">
            <button
              onClick={handleOpenSettings}
              aria-label="Open settings"
              className={`flex items-center gap-3 w-full px-3 py-2 mb-2 rounded-lg transition-colors text-left ${
                location.pathname.startsWith("/settings")
                  ? "bg-[var(--color-bg)]"
                  : "hover:bg-[var(--color-bg)]"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg2)] flex items-center justify-center shrink-0">
                <User size={16} className="text-[var(--color-text3)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{userName}</p>
                <p className="text-[11px] text-[var(--color-text3)] truncate">
                  {userEmail}
                </p>
              </div>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[15px] font-medium text-[var(--color-red)] hover:bg-[var(--color-red-bg)] transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-h-0">{children}</main>

      {/* Bottom nav (mobile only, hidden on immersive screens) */}
      {!isDesktop && !hideBottomNav && (
        <nav className="flex items-stretch bg-[var(--color-surface)] border-t border-[var(--color-border)] h-16 shrink-0 sticky bottom-0 z-50">
          {tabs.map((t) => {
            const isActive =
              location.pathname === t.id ||
              (t.id !== "/" && location.pathname.startsWith(t.id));
            return (
              <button
                key={t.id}
                onClick={() => navigate(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive
                    ? "text-[var(--color-text)] font-bold"
                    : "text-[var(--color-text3)] font-medium"
                }`}
              >
                <t.icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className="text-[11px]">{t.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
