# GitHub Actions 构建群晖 Docker 镜像

## Goal

为个人部署场景提供更方便的 GitHub Actions Docker 镜像构建/推送流程，让用户可以在群晖 DS920+ 的 Docker/Container Manager 中拉取对应版本镜像运行 Metapi。

用户最初倾向：“可以的话只部署对应版本的就行”，即优先避免每次都维护宽泛的 `latest`/多架构/完整 release 产物，重点支持指定版本标签。

最新需求更新：用户希望群晖直接拉取 `ghcr.io/2263075977/metapi:latest`，方便在 Docker/Container Manager 或 Compose 里固定使用一个镜像地址。

进一步方向更新：用户说明以后都是个人使用，希望删除原先不必要的发布复杂性。规划需要把“个人 DS920+ 拉 GHCR latest”作为主目标，并重新界定哪些旧 Docker 发布路径应删除或停用。

最终确认：只用 Docker 镜像，连桌面 Release 也删除；最终镜像固定为 `ghcr.io/2263075977/metapi:latest`。

## Confirmed Facts

- 仓库已有 `docker/Dockerfile`，生产镜像使用 `node:22-bookworm-slim`，并构建 web/server 产物。
- `docker/docker-compose.yml` 需要改为默认使用 `ghcr.io/2263075977/metapi:latest`。
- `README.md` / `README_EN.md` 文档写明 Docker 镜像支持 `amd64`、`arm64`、`armv7l`。
- 群晖 DS920+ 使用 Intel x86_64 平台，Docker 镜像目标通常是 `linux/amd64`。
- `.github/workflows/release.yml` 已在 `push tags: v*` 时发布 Docker 镜像：
  - 构建 `amd64`、`arm64`、`armv7` 架构镜像；
  - 推送到 Docker Hub 和 GHCR；
  - 生成 tag 与 `latest` manifest。
- `.github/workflows/ci.yml` 已在普通 push 时发布 Docker Hub 镜像：
  - 构建多架构；
  - 生成 `latest`、branch、sha 标签；
  - 依赖 Docker Hub secrets。
- 当前仓库已有 `permissions: packages: write` 的 release workflow，具备推送 GHCR 的基础。
- 如果目标只是 DS920+ 个人使用，最小可行方案只需要 `linux/amd64`，并推送独立 GHCR package，例如 `ghcr.io/<owner>/<repo>-synology:<version>`，避免与现有 release workflow 的 `ghcr.io/<owner>/<repo>:<version>` 多架构发布冲突。
- 但用户现在明确希望使用 `ghcr.io/2263075977/metapi:latest`。现有 `release.yml` 已经会在 `v*` tag release 时推送 `ghcr.io/${{ github.repository }}:latest`，因此新增轻量 workflow 如果也在 tag push 时推同一个 `latest`，会与现有 release workflow 争用同一个 GHCR tag。
- 现有 `ci.yml` 和 `release.yml` 都包含 Docker 发布 jobs，并依赖 Docker Hub secrets / 多架构 manifest；这些对“个人 DS920+ 只拉 GHCR latest”可能是冗余复杂度。
- 现有 `release.yml` 还构建 Windows/macOS/Linux 桌面安装包并上传 GitHub Release；用户已确认以后不需要桌面 Release。

## Requirements

- 支持通过 GitHub Actions 构建 Docker 镜像，供群晖 DS920+ 拉取运行。
- 支持固定 `latest` 标签，便于群晖 Container Manager / Compose 长期使用同一个镜像地址。
- 尽量复用现有 `docker/Dockerfile`，避免引入新的 Dockerfile。
- 以个人自用为目标，可以删除或停用不再需要的 Docker Hub / 多架构 Docker 发布链路。
- 删除桌面 Release 发布链路，只保留个人 Docker 镜像发布。
- 对个人使用给出清晰文档或示例，说明 Synology/Compose 应拉取 `ghcr.io/2263075977/metapi:latest`。
- 需求变更后，目标倾向改为 `ghcr.io/2263075977/metapi:latest`，并删除/停用旧 Docker 发布链路中不必要的部分。
- 已确认删除桌面 Release，只保留 Docker 镜像。

## Acceptance Criteria

- [x] GitHub Actions workflow 能在 `main` push 或手动触发时构建并推送 Docker 镜像。
- [x] DS920+ 目标默认使用 `linux/amd64` 镜像。
- [x] 镜像 tag 固定为 `latest`，不要求额外发布桌面安装包。
- [x] 不需要 Docker Hub secrets 即可使用 GitHub Container Registry 方案。
- [x] 文档说明如何在群晖或 Compose 中使用 `ghcr.io/2263075977/metapi:latest`。

## Likely Out Of Scope

- 自动远程更新群晖 Docker 容器。
- 改造应用运行逻辑、数据库 schema 或 Dockerfile 基础镜像。
- 为 Synology DSM UI 写完整图形教程截图。
- 多架构 Docker manifest、Docker Hub 推送、桌面安装包构建、GitHub Release 资产上传。

## Open Questions

- None.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
