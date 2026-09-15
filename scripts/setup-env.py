#!/usr/bin/env python3
"""创建独立的数据库配置，仅从参考项目复制 Entra 字段；绝不输出配置值。"""
import argparse
import os
from pathlib import Path
import secrets
import shlex
import tempfile

ROOT = Path(__file__).resolve().parent.parent
KEYS = {"ENTRA_TENANT_ID", "VITE_ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "VITE_ENTRA_CLIENT_ID", "ENTRA_AUDIENCE", "ENTRA_REQUIRED_SCOPE", "VITE_ENTRA_API_SCOPE", "ENTRA_ADMIN_ROLE"}

def read_env(path, allowed=None):
    result = {}
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        key, separator, raw = line.strip().removeprefix("export ").partition("=")
        key = key.strip()
        if not separator or key.startswith("#") or (allowed is not None and key not in allowed):
            continue
        values = shlex.split(raw, comments=True)
        if len(values) > 1 or (values and "$" in values[0]):
            raise ValueError(f"{key} 需要一个字面值，不执行 shell 展开")
        result[key] = values[0] if values else ""
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT.parent / "device-manager-v3/.env")
    args = parser.parse_args()
    target = ROOT / ".env"
    values = read_env(target)
    source = read_env(args.source, KEYS)
    for key, value in source.items():
        if value and not values.get(key):
            values[key] = value
    for backend, frontend in [("ENTRA_TENANT_ID", "VITE_ENTRA_TENANT_ID"), ("ENTRA_CLIENT_ID", "VITE_ENTRA_CLIENT_ID")]:
        values[backend] = values.get(backend) or values.get(frontend, "")
        values[frontend] = values.get(frontend) or values[backend]
    values.setdefault("APP_PORT", "3180")
    values.setdefault("DB_PORT", "55484")
    values["POSTGRES_PASSWORD"] = values.get("POSTGRES_PASSWORD") or secrets.token_hex(32)
    values["AUTH_MODE"] = values["VITE_AUTH_MODE"] = "entra"
    values["ENTRA_REQUIRED_SCOPE"] = values.get("ENTRA_REQUIRED_SCOPE") or "dm.access"
    values["ENTRA_ADMIN_ROLE"] = values.get("ENTRA_ADMIN_ROLE") or "dm.admin"
    values["VITE_ENTRA_API_SCOPE"] = values.get("VITE_ENTRA_API_SCOPE") or f"api://{values.get('ENTRA_AUDIENCE', '')}/{values['ENTRA_REQUIRED_SCOPE']}"
    missing = [key for key in ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_AUDIENCE"] if not values.get(key)]
    if missing:
        raise ValueError("缺少登录配置：" + ", ".join(missing))
    fd, temporary = tempfile.mkstemp(prefix=".env-", dir=ROOT)
    try:
        with os.fdopen(fd, "w") as output:
            output.write("# 本地配置，不提交版本控制。\n")
            output.writelines(f"{key}={shlex.quote(value)}\n" for key, value in values.items())
        os.replace(temporary, target)
        os.chmod(target, 0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("已生成本项目数据库配置并导入 Entra 环境变量，未复制 Graph 密钥或其他项目的数据库凭据。")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        raise SystemExit(f"配置准备失败：{error}") from None
