import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ModuleName } from "../types";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireModule({ module, children }: { module: ModuleName; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(module, "view")) {
    return (
      <div className="card text-center py-16">
        <h2 className="text-xl mb-2">Access restricted</h2>
        <p className="text-brown/60 text-sm">Your role does not have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream text-brown">
      <p>Loading...</p>
    </div>
  );
}
