#!/usr/bin/env python3
"""安全读取 .env 后运行本地 Go 服务，不通过 shell source 配置。"""
import importlib.util
import os
from pathlib import Path
import sys
from urllib.parse import quote

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("setup_env", root / "scripts/setup-env.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
settings = module.read_env(root / ".env")
if not settings.get("POSTGRES_PASSWORD"):
    raise SystemExit("请先运行 python3 scripts/setup-env.py")
env = os.environ.copy()
env.update(settings)
env.setdefault("DATABASE_URL", f"postgresql://linkhub:{quote(settings['POSTGRES_PASSWORD'], safe='')}@127.0.0.1:{settings.get('DB_PORT','55484')}/linkhub?sslmode=disable")
env.setdefault("HTTP_ADDR", "127.0.0.1:8180")
env.setdefault("WEB_DIR", str(root / "web/dist"))
os.chdir(root / "backend")
os.execvpe("go", ["go", "run", "./cmd/server", *sys.argv[1:]], env)
