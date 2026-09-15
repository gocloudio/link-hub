#!/usr/bin/env bash
# 参考 rebalancer 的共享 build-image.sh：Buildx、REPO/APP/TAG、amd64 默认平台。
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd "$script_dir/.." && pwd)
if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
    cat <<'HELP'
用法：scripts/build-image.sh [-- Docker buildx 参数...]

无额外参数：构建项目根目录的 Dockerfile，并 --load 到本地 Docker。
示例：
  scripts/build-image.sh
  scripts/build-image.sh -- --push .
  DRY_RUN=1 scripts/build-image.sh

变量：REPO、APP、TAG、PLATFORM（默认 linux/amd64）、IMAGE_TAG_SH、GIT_REPO。
默认按 Git 状态生成 TAG，无 Git 提交时生成 local-时间戳；TAG 仅用于手动覆盖。
多架构构建需明确 --push 或 --output。
Docker 参数按数组传递；脚本不会读取 .env，也不会打印登录凭据。
HELP
    exit 0
fi
if [[ "${1:-}" == '--' ]]; then shift; fi

tag_script=${IMAGE_TAG_SH:-$script_dir/image-tag}
if [[ ! -x "$tag_script" ]]; then
    printf '%s\n' '找不到可执行的 image-tag 脚本，请检查 IMAGE_TAG_SH。' >&2
    exit 1
fi
tag=$(GIT_REPO="${GIT_REPO:-$project_dir}" "$tag_script")
repo=${REPO:-r.do-ny3.gocloudio.com/core}
app=${APP:-link-hub}
platform=${PLATFORM:-linux/amd64}
image="${repo}/grpc-apis-${app}:${tag}"

# 与共享脚本一样，-- 后可传完整 Dockerfile、缓存选项及构建上下文。
if [[ $# -eq 0 ]]; then set -- -f "$project_dir/Dockerfile" "$project_dir"; fi
has_output=false
push=false
load=false
for arg in "$@"; do
    case "$arg" in
        --push|--push=true) push=true; has_output=true ;;
        --load|--load=true) load=true; has_output=true ;;
        --output|--output=*|-o|-o?*) has_output=true ;;
    esac
done
if $push && $load; then
    printf '%s\n' '--push 和 --load 不能同时使用。' >&2
    exit 1
fi
if [[ "$platform" == *,* ]] && { $load || ! $has_output; }; then
    printf '%s\n' '多架构构建请使用 --push 或 --output；--load 只支持单个平台。' >&2
    exit 1
fi

args=(buildx build --progress plain --platform "$platform" -t "$image" --build-arg "TAG=$tag")
if ! $has_output; then args+=(--load); fi
args+=("$@")
printf '构建镜像：%s\n目标平台：%s\n' "$image" "$platform"
if [[ "${DRY_RUN:-0}" == '1' ]]; then
    printf '%q ' docker "${args[@]}"
    printf '\n'
    exit 0
fi
DOCKER_BUILDKIT=1 docker "${args[@]}"
printf '镜像构建完成：%s\n' "$image"
