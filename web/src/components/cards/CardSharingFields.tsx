import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Member } from "@/gen/linkhub/v1/linkhub_pb";
import { api, errorText } from "@/lib/api";

type SharingValue = { isPrivate: boolean; sharedUserIds: string[] };
export function CardSharingFields({
  isPrivate,
  sharedUserIds,
  ownerId,
  onChange,
}: SharingValue & {
  ownerId?: string;
  onChange: (value: Partial<SharingValue>) => void;
}) {
  const auth = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [memberError, setMemberError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberRetry, setMemberRetry] = useState(0);
  const { run } = auth;
  useEffect(() => {
    if (!isPrivate) return;
    let alive = true;
    setMembersLoading(true);
    setMemberError("");
    run((options) => api.listMembers({}, options))
      .then((response) => {
        if (alive) setMembers(response.members);
      })
      .catch((e) => {
        if (alive) setMemberError(errorText(e));
      })
      .finally(() => {
        if (alive) setMembersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isPrivate, run, memberRetry]);
  return (
    <>
      <fieldset className="visibility-fieldset">
        <legend className="field-label">可见范围</legend>
        <div className="category-options">
          <label className="category-option">
            <input
              type="radio"
              name="visibility"
              checked={!isPrivate}
              onChange={() => onChange({ isPrivate: false })}
            />
            内部公开
          </label>
          <label className="category-option">
            <input
              type="radio"
              name="visibility"
              checked={isPrivate}
              onChange={() => onChange({ isPrivate: true })}
            />
            私有
          </label>
        </div>
        <p className="field-hint">
          {isPrivate
            ? "创建者和指定成员可见；管理员可查看和维护。普通分享接收者只读。"
            : "所有登录用户可见，创建者和管理员可维护。"}
        </p>
      </fieldset>
      {isPrivate && (
        <fieldset className="sharing-fieldset">
          <legend className="field-label">
            分享给团队成员 <small>选填 · 只读</small>
          </legend>
          <Input
            aria-label="搜索分享成员"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="搜索姓名或账号"
          />
          <div className="sharing-members">
            {members
              .filter(
                (m) =>
                  m.id !== (ownerId || auth.user?.id) &&
                  `${m.name} ${m.username}`
                    .toLowerCase()
                    .includes(memberSearch.toLowerCase()),
              )
              .map((m) => (
                <label className="sharing-member" key={m.id}>
                  <input
                    type="checkbox"
                    checked={sharedUserIds.includes(m.id)}
                    onChange={(e) =>
                      onChange({
                        sharedUserIds: e.target.checked
                          ? [...sharedUserIds, m.id]
                          : sharedUserIds.filter((id) => id !== m.id),
                      })
                    }
                  />
                  <span>
                    {m.name || m.username}
                    <small>{m.username}</small>
                  </span>
                </label>
              ))}
          </div>
          {membersLoading && (
            <p className="field-hint" role="status">
              正在加载成员…
            </p>
          )}
          {memberError && (
            <p className="field-error" role="alert">
              {memberError}
              <Button
                variant="ghost"
                onClick={() => setMemberRetry((value) => value + 1)}
              >
                重试
              </Button>
            </p>
          )}
          <p className="field-hint">
            已选择 {sharedUserIds.length}{" "}
            人。成员需至少登录过本站一次，才会出现在名单中。取消勾选并保存即可撤销分享。
          </p>
        </fieldset>
      )}
    </>
  );
}
