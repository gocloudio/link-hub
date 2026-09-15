import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { WorkspacePage } from "./pages/WorkspacePage";

export default function App() {
  const auth = useAuth();
  if (!auth.ready || !auth.user) return <LoginPage />;
  return <WorkspacePage key={auth.user.id} />;
}
