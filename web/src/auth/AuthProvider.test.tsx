// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { GetMeResponseSchema } from "../gen/linkhub/v1/linkhub_pb";
import { AuthProvider, useAuth } from "./AuthProvider";
import { api } from "../lib/api";

const msal = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  handleRedirectPromise: vi.fn().mockResolvedValue(null),
  getActiveAccount: vi.fn(),
  getAllAccounts: vi.fn().mockReturnValue([]),
  setActiveAccount: vi.fn(),
  acquireTokenSilent: vi.fn(),
  logoutRedirect: vi.fn(),
}));
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    constructor() {
      return msal;
    }
  },
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api: { getMe: vi.fn() },
}));

function Harness({ code }: { code: Code }) {
  const auth = useAuth();
  return (
    <>
      <p>
        {!auth.ready
          ? "loading"
          : !auth.user
            ? "signed-out"
            : auth.user.isAdmin
              ? "admin"
              : "reader"}
      </p>
      <button
        onClick={() =>
          void auth
            .run(async () => {
              throw new ConnectError("rejected", code);
            })
            .catch(() => {})
        }
      >
        request
      </button>
      <button onClick={() => void auth.logout()}>logout</button>
    </>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          tenantId: "tenant",
          clientId: "client",
          apiScope: "scope",
        }),
      }),
  );
  msal.getActiveAccount.mockReturnValue({ homeAccountId: "member" });
  msal.acquireTokenSilent.mockResolvedValue({ accessToken: "test-token" });
  msal.logoutRedirect.mockResolvedValue(undefined);
  vi.mocked(api.getMe).mockResolvedValue(
    create(GetMeResponseSchema, { id: "member", isAdmin: true }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("身份失效清除当前用户", async () => {
  render(
    <AuthProvider>
      <Harness code={Code.Unauthenticated} />
    </AuthProvider>,
  );
  await screen.findByText("admin");
  await userEvent.click(screen.getByText("request"));
  expect(await screen.findByText("signed-out")).toBeTruthy();
});
it("权限被收回后保留登录身份并降为只读", async () => {
  render(
    <AuthProvider>
      <Harness code={Code.PermissionDenied} />
    </AuthProvider>,
  );
  await screen.findByText("admin");
  await userEvent.click(screen.getByText("request"));
  expect(await screen.findByText("reader")).toBeTruthy();
});
it("退出跳转尚未完成时也立即清除身份和草稿", async () => {
  msal.logoutRedirect.mockImplementationOnce(() => new Promise(() => {}));
  sessionStorage.setItem("link-hub-card-draft", "private-draft");
  render(
    <AuthProvider>
      <Harness code={Code.Internal} />
    </AuthProvider>,
  );
  await screen.findByText("admin");
  await userEvent.click(screen.getByText("logout"));
  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(sessionStorage.getItem("link-hub-card-draft")).toBeNull();
});
