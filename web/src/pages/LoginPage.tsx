import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";

export function LoginPage() {
  const auth = useAuth();
  return (
    <main className="login-page">
      <section
        className="login-dialog login-panel"
        aria-labelledby="login-title"
      >
        <div className="login-illustration">
          <ShieldCheck />
        </div>
        <div className="modal-eyebrow">LINK HUB / WORKSPACE</div>
        <h1 id="login-title">团队导航</h1>
        <p>登录团队账号，访问常用系统、工具与文档。</p>
        {!auth.ready ? (
          <p role="status">正在验证登录状态…</p>
        ) : (
          <Button onClick={() => void auth.login()}>
            <span className="microsoft-logo" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            使用 Microsoft 登录
            <ArrowUpRight />
          </Button>
        )}
        {auth.error && (
          <p className="field-error" role="alert">
            {auth.error}
          </p>
        )}
        <p>收藏常用入口，管理个人私有工具。</p>
      </section>
    </main>
  );
}
