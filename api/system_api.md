# System 系统模块 API 文档

## 概述

系统模块提供客户端启动与合规所需的公共配置接口：API 版本、首页幻灯片、启动屏、法律文档。

**基础信息**:
- **基础路径**: `/api/system`
- **请求格式**: 查询参数（GET；除公开配置外，`staff` 需传 `role`）
- **响应格式**: JSON
- **认证方式**: 无需登录
- **字符编码**: UTF-8

旧接口 `?module=system&action=...` 仍可用；新客户端请使用本 REST 路径。成功响应统一包在 `data` 内（与旧接口顶层字段布局不同）。

## 通用响应格式

**成功响应**:
```json
{
  "status": "success",
  "data": { ... }
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "错误信息代码"
}
```

## 通用错误码

- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 请求成功 | — |
| `400` | 接口路径不存在 | `Not found` |
| `405` | 使用了非 GET 方法 | `Method not allowed` |
| `500` | 服务器内部错误 | `system_error` |

---

## 系统信息

### 1. 获取 API 版本

**请求**: `GET /api/system/version`

**请求参数**: 无

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "version": "3.12.6"
  }
}
```

**响应字段说明**:
- `version`: 当前 API 版本号（与 `version.md` / 旧接口 `action=version` 保持同步）

**错误码**: 无业务错误（仅路径/方法错误见通用状态码）

**HTTP状态码**:
- `200`: 获取成功
- `400`: 接口路径不存在（`Not found`）
- `405`: 请求方法错误，仅支持 GET（`Method not allowed`）

**旧接口对照**: `GET ?module=system&action=version` → `{status, version}`（版本字段在顶层）

---

### 2. 获取首页幻灯片

**请求**: `GET /api/system/slideshow`

**请求参数**: 无

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "slides": [
      {
        "img_url": "https://example.com/slide.jpg",
        "title": "幻灯片标题",
        "href": "https://example.com/target"
      }
    ]
  }
}
```

**响应字段说明**:
- `slides`: 幻灯片数组（已启用条目，按 `sort_order` 升序、`id` 升序）
- `img_url`: 图片地址
- `title`: 标题
- `href`: 点击跳转地址

> 管理端见 `slideshow_api.md`（`/api/slideshow`）。公开展示亦可使用 `GET /api/slideshow/active`（与本接口效果一致）。本公开接口响应结构保持不变，旧客户端无需修改。

**错误码**:
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 接口路径不存在（`Not found`）
- `405`: 请求方法错误，仅支持 GET（`Method not allowed`）
- `500`: 系统错误（`system_error`）

**旧接口对照**: `GET ?module=system&action=slideshow` → `{status, slides}`（`slides` 在顶层）

---

### 3. 获取启动屏

**请求**: `GET /api/system/launch-screen`

**请求参数**: 无

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "launch_screen_url": "https://cdn-cos.ottohub.cn/system/launch_screen/launch_screen_2.jpg?sign=...&t=...",
    "dark_launch_screen_url": "https://cdn-cos.ottohub.cn/system/launch_screen/launch_screen_2_dark.jpg?sign=...&t=..."
  }
}
```

**响应字段说明**:
- `launch_screen_url`: 浅色模式启动屏（腾讯云 CDN 防盗链签名 URL）
- `dark_launch_screen_url`: 深色模式启动屏（腾讯云 CDN 防盗链签名 URL）

**错误码**: 无业务错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 接口路径不存在（`Not found`）
- `405`: 请求方法错误，仅支持 GET（`Method not allowed`）

**旧接口对照**: `GET ?module=system&action=launch_screen` → `{status, launch_screen_url, dark_launch_screen_url}`（字段在顶层）

---

### 4. 获取法律文档

**请求**: `GET /api/system/legal-documents`

**请求参数**: 无

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "documents": {
      "terms_of_service_url": "https://cdn-cos.ottohub.cn/system/document/terms_of_service_v1.0.md?sign=...&t=...",
      "privacy_policy_url": "https://cdn-cos.ottohub.cn/system/document/privacy_policy_v1.0.md?sign=...&t=...",
      "platform_content_review_specification_url": "https://cdn-cos.ottohub.cn/system/document/platform_content_review_specification_v1.3.md?sign=...&t=..."
    }
  }
}
```

**响应字段说明**:
- `documents.terms_of_service_url`: 用户协议（Markdown，CDN 签名，有效期约 1 小时）
- `documents.privacy_policy_url`: 隐私政策（Markdown，CDN 签名，有效期约 1 小时）
- `documents.platform_content_review_specification_url`: 平台内容审核规范（Markdown，CDN 签名，有效期约 1 小时）

**错误码**: 无业务错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 接口路径不存在（`Not found`）
- `405`: 请求方法错误，仅支持 GET（`Method not allowed`）

**旧接口对照**: `GET ?module=system&action=legal_documents` → `{status, documents}`（`documents` 在顶层）

---

### 5. 获取站务/审核身份组列表

**请求**: `GET /api/system/staff?role={role}`

**请求参数** (Query):
- `role` (string, 必需): 身份组，取值：
  - `audit` — 审核员（`profile.is_audit=1`）
  - `admin` — 站务员（`profile.is_admin=1`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "role": "audit",
    "staff_list": [
      {
        "uid": 123,
        "username": "审核员A",
        "intro": "个人简介",
        "avatar_url": "https://example.com/avatar.jpg",
        "is_audit": 1,
        "is_admin": 0
      }
    ]
  }
}
```

**响应字段说明**:
- `role`: 本次查询的身份组（与请求参数一致）
- `staff_list`: 成员数组，按 `uid` 升序
- `uid`: 用户 ID
- `username`: 用户名
- `intro`: 个人简介
- `avatar_url`: 头像地址
- `is_audit`: 是否为审核员（0/1）
- `is_admin`: 是否为站务员（0/1）

**说明**:
- 仅返回 `user.status=0`（正常账号）的用户
- 同一用户若同时拥有两种身份，会分别出现在对应身份组列表中
- 无需登录

**错误码**:
- `missing_argument`: 未传 `role`
- `error_role`: `role` 不是 `audit` 或 `admin`
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误或接口路径不存在（`missing_argument`、`error_role`、`Not found`）
- `405`: 请求方法错误，仅支持 GET（`Method not allowed`）
- `500`: 系统错误（`system_error`）

---

## 旧接口对照总表

| 旧 action | REST |
|-----------|------|
| `version` | `GET /api/system/version` |
| `slideshow` | `GET /api/system/slideshow` |
| `launch_screen` | `GET /api/system/launch-screen` |
| `legal_documents` | `GET /api/system/legal-documents` |
| — | `GET /api/system/staff?role=audit\|admin` |
