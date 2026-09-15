import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";
import { useTheme } from "@/hooks/useTheme";

export function WorkspaceHeader({
  onOpenSidebar,
}: {
  onOpenSidebar: () => void;
}) {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <Button
          size="icon"
          variant="ghost"
          className="menu-button"
          aria-label="打开分类栏"
          onClick={onOpenSidebar}
        >
          <Menu />
        </Button>
        <span className="breadcrumb-root">工作空间</span>
        <span className="breadcrumb-slash">/</span>
        <span>团队导航</span>
      </div>
      <div className="topbar-actions">
        <div className="theme-switch" role="group" aria-label="外观">
          <button
            aria-label="浅色模式"
            aria-pressed={theme === "light"}
            onClick={() => setTheme("light")}
          >
            <Sun />
          </button>
          <button
            aria-label="深色模式"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme("dark")}
          >
            <Moon />
          </button>
        </div>
        <span className="action-divider" />
        <div className="user-menu">
          <span title={auth.user?.username}>
            {auth.user?.name || "团队成员"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="退出登录"
            onClick={() => void auth.logout()}
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </header>
  );
}
