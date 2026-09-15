import {
  createClient,
  Code,
  ConnectError,
  type CallOptions,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { HubService } from "@/gen/linkhub/v1/linkhub_pb";
export const api = createClient(
  HubService,
  createConnectTransport({
    baseUrl: window.location.origin,
    defaultTimeoutMs: 15000,
  }),
);
export function bearer(token: string): CallOptions {
  return { headers: { Authorization: `Bearer ${token}` } };
}
export function errorText(error: unknown): string {
  if (error instanceof ConnectError) {
    if (error.code === Code.Unauthenticated)
      return "登录已失效，请重新登录。填写的内容已保留。";
    if (error.code === Code.PermissionDenied)
      return "当前账号没有管理员权限，请联系 Entra 管理员。";
    if (
      [Code.Unavailable, Code.DeadlineExceeded, Code.Unknown].includes(
        error.code,
      )
    )
      return "暂时无法连接服务，请稍后重试。";
    return error.rawMessage || "操作失败，请重试。";
  }
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
