# Slideshow 首页幻灯片管理 API 文档

## 概述

独立模块，用于读取与管理首页幻灯片。

**基础信息**:
- **基础路径**: `/api/slideshow`
- **请求格式**: JSON（POST/PUT）或查询参数（GET）
- **响应格式**: JSON
- **认证方式**:
  - 公开展示列表 `GET /active`：**无需登录**
  - 其余管理接口：需要 `token`，且 `profile.is_admin=1`
- **字符编码**: UTF-8

## 通用错误码

- `Token required` / `error_token`: 未登录或 token 无效
- `no_permission`: 非管理员
- `missing_argument`: 缺少参数
- `error_type`: 参数类型错误
- `error_id`: 幻灯片不存在
- `system_error`: 系统错误
- `Not found`: 路径不存在
- `Method not allowed`: 方法不允许

---

## 1. 公开展示列表

**请求**: `GET /api/slideshow/active`

**认证**: 无需 token

**说明**: 与 `GET /api/system/slideshow` 效果一致——仅返回 `is_enabled=1` 的条目，按 `sort_order ASC, id ASC`，字段仅 `img_url` / `title` / `href`。

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

---

## 2. 管理列表（全部历史）

**请求**: `GET /api/slideshow?token={token}`

**可选查询参数**:
| 参数 | 说明 | 默认 |
|------|------|------|
| `is_enabled` | `1`=仅有效，`0`=仅失效；不传=全部 | 全部 |
| `sort_by` | `sort_order` / `id` / `created_at` / `updated_at` | `sort_order` |
| `order` | `asc` 正序 / `desc` 倒序 | `asc` |

主字段相同时按 `id` 同向稳定排序。

**示例**:
- 全部：`GET /api/slideshow?token=...`
- 仅有效：`GET /api/slideshow?token=...&is_enabled=1`
- 仅失效：`GET /api/slideshow?token=...&is_enabled=0`
- 按创建时间倒序：`GET /api/slideshow?token=...&sort_by=created_at&order=desc`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "slides": [
      {
        "id": 1,
        "img_url": "https://example.com/slide.jpg",
        "title": "标题",
        "href": "https://example.com/target",
        "is_enabled": 1,
        "sort_order": 0,
        "created_at": "2026-08-07 13:00:00",
        "updated_at": "2026-08-07 13:00:00"
      }
    ]
  }
}
```

**字段说明**:
- `is_enabled`: `1`=客户端展示（有效），`0`=不展示（失效）
- `sort_order`: 越小越靠前（公开列表默认序）

**失效 / 恢复**: `PUT /api/slideshow/{id}`，Body 只传 `token` + `is_enabled`（`0` 或 `1`）即可。

---

## 3. 新增幻灯片

**请求**: `POST /api/slideshow`

**Body**:
- `token` (string, 必需)
- `img_url` (string, 必需): 图片 URL
- `title` (string, 必需): 标题
- `href` (string, 可选): 跳转 URL，默认空字符串
- `is_enabled` (int, 可选): 默认 `1`
- `sort_order` (int, 可选): 不传则自动追加到末尾（`max(sort_order)+1`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "slide": { "id": 2, "img_url": "...", "title": "...", "href": "...", "is_enabled": 1, "sort_order": 1, "created_at": "...", "updated_at": "..." }
  }
}
```

---

## 4. 更新幻灯片

**请求**: `PUT /api/slideshow/{id}`（亦支持 `PATCH`）

**Body**:
- `token` (string, 必需)
- `img_url` / `title` / `href` / `is_enabled` / `sort_order`：至少传一项
- **`id` 主键不可修改**（以路径 `{id}` 为准；Body 若传不同 `id` 会返回 `error_type`）

**成功响应**: 同新增，返回更新后的 `slide`

---

## 5. 删除幻灯片

**请求**: `DELETE /api/slideshow/{id}`

**Body / Query**:
- `token` (string, 必需)

**成功响应**:
```json
{ "status": "success" }
```

---

## 6. 批量设置顺序与展示

**请求**: `PUT /api/slideshow/reorder`

**Body**:
- `token` (string, 必需)
- `items` (array, 必需): 每项含 `id`；可选 `sort_order`、`is_enabled`

```json
{
  "token": "...",
  "items": [
    { "id": 2, "sort_order": 0, "is_enabled": 1 },
    { "id": 1, "sort_order": 1, "is_enabled": 0 }
  ]
}
```

**成功响应**: 返回更新后的完整管理列表 `data.slides`

---

## 与 system 公开接口的关系

| 接口 | 用途 |
|------|------|
| `GET /api/slideshow/active` | 本模块公开展示列表（推荐新客户端） |
| `GET /api/system/slideshow` | 旧路径，数据源与响应与 `/active` 相同 |
| `GET /api/slideshow` 等 | 管理端；需管理员 token |
