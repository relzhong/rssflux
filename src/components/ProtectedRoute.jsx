import { Navigate, useLocation } from "react-router-dom";
import { useStore } from "@nanostores/react";
import { authState } from "@/stores/authStore";
import { Spinner } from "@heroui/react";

export default function ProtectedRoute({ children }) {
  const auth = useStore(authState);
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
