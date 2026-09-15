import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { Code, ConnectError, type CallOptions } from "@connectrpc/connect";
import { api, bearer, errorText } from "@/lib/api";
import type { GetMeResponse } from "@/gen/linkhub/v1/linkhub_pb";
function interactionRequired(error: unknown) {
  return (
    error instanceof Error && error.name === "InteractionRequiredAuthError"
  );
}
type Runtime = { tenantId: string; clientId: string; apiScope: string };
let initialization:
  Promise<{ msal: PublicClientApplication; config: Runtime }> | undefined;
function initialize() {
  return (initialization ??= (async () => {
    const response = await fetch("/api/runtime-config");
    if (!response.ok) throw new Error("登录配置暂时无法读取，请刷新页面重试。");
    const config = (await response.json()) as Runtime;
    if (!config.clientId || !config.tenantId || !config.apiScope)
      throw new Error("Entra 登录配置不完整。");
    const { PublicClientApplication } = await import("@azure/msal-browser");
    const msal = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin + "/",
        postLogoutRedirectUri: window.location.origin + "/",
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await msal.initialize();
    const result = await msal.handleRedirectPromise({
      navigateToLoginRequestUrl: false,
    });
    if (result?.account) msal.setActiveAccount(result.account);
    else if (!msal.getActiveAccount())
      msal.setActiveAccount(msal.getAllAccounts()[0] ?? null);
    return { msal, config };
  })().catch((error) => {
    initialization = undefined;
    throw error;
  }));
}
type Auth = {
  user: GetMeResponse | null;
  ready: boolean;
  error: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  run: <T>(operation: (options: CallOptions) => Promise<T>) => Promise<T>;
};
export const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GetMeResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  async function accessToken(account?: AccountInfo) {
    const { msal, config } = await initialize();
    const active = account ?? msal.getActiveAccount();
    if (!active) throw new Error("请先登录管理员账号。填写的内容已保留。");
    return (
      await msal.acquireTokenSilent({
        account: active,
        scopes: [config.apiScope],
      })
    ).accessToken;
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { msal } = await initialize();
        if (msal.getActiveAccount()) {
          const me = await api.getMe({}, bearer(await accessToken()));
          if (alive) setUser(me);
        }
      } catch (e) {
        if (alive)
          setError(
            interactionRequired(e) ? "登录已过期，请重新登录。" : errorText(e),
          );
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function login() {
    setError("");
    try {
      const { msal, config } = await initialize();
      await msal.loginRedirect({
        scopes: [config.apiScope],
        prompt: "select_account",
      });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function logout() {
    try {
      const { msal } = await initialize();
      await msal.logoutRedirect({ account: msal.getActiveAccount() });
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function run<T>(
    operation: (options: CallOptions) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(bearer(await accessToken()));
    } catch (e) {
      if (
        interactionRequired(e) ||
        (e instanceof ConnectError &&
          [Code.Unauthenticated, Code.PermissionDenied].includes(e.code))
      ) {
        setUser(null);
        const message = interactionRequired(e)
          ? "登录已失效，请重新登录。填写的内容已保留。"
          : errorText(e);
        setError(message);
        throw new Error(message);
      }
      throw e;
    }
  }
  return (
    <AuthContext.Provider value={{ user, ready, error, login, logout, run }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("缺少 AuthProvider");
  return context;
}
