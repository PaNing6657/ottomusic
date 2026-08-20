# Moderation 审核模块 API 文档

## 概述

审核模块提供对视频、动态、静画、用户头像、用户封面（旧通用 / 横版 / 竖版）、弹幕、视频评论、动态评论、静画评论的审核管理功能，包括获取审核列表、过审、驳回、申诉、举报等操作。

**基础信息**:
- **基础路径**: `/api/moderation`
- **请求格式**: JSON（POST/PUT/DELETE）或 Query参数（GET）
- **响应格式**: JSON
- **认证方式**: 通过 `token` 参数传递（GET请求）或请求体（POST/PUT/DELETE请求）
- **字符编码**: UTF-8

### 多人表决（重要）

待审内容需多人表决后才会真正改状态：

- 阈值票数由服务端配置控制（默认 3 票），修改后对后续表决立刻生效。
- 同一内容、同一轮次，同一审核员只能表决一次；重复表决返回 `already_voted`。
- 通过票或驳回票**哪一侧先达到阈值**，即触发对应结果；流程结束本轮票封存。
- `profile.is_admin=1` 拥有一票通过 / 一票否决（立即定局）。审核员身份仍为 `is_audit=1`。
- 每次表决都会记录审核日志；仅真正改内容状态的那票 `is_decisive=1`，中间票为 `0`。
- 内容被驳回/通过后，若因举报或申诉再次进入待审，开启**新一轮**表决，不受上一轮干扰（上一轮投过的人可以再投）。
- 路径与原有请求/响应字段保持兼容：只**新增**参数与返回字段，不删减。

---

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

- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `not_reviewer`: 不是审核员（审核操作需要审核员权限）
- `no_permission`: 没有权限
- `error_type`: 错误的数值类型
- `too_big_num`: 数量太大
- `error`: 一般错误
- `error_vid`: 错误的视频ID
- `error_bid`: 错误的动态ID
- `error_vcid`: 错误的视频评论ID
- `error_bcid`: 错误的动态评论ID
- `error_scid`: 错误的静画评论ID
- `error_sid`: 错误的静画作品ID
- `error_danmaku_id`: 错误的弹幕ID
- `error_uid`: 错误的用户ID
- `system_error`: 系统错误
- `cannot_review_own_content`: 不能审核自己上传的内容（回避机制）
- `cannot_review_own_report`: 不能审核自己举报的内容（回避机制）
- `already_voted`: 本轮已对该内容表决过
- `reason_too_long`: 理由过长（超过50字）

---

## 获取审核列表

各待审列表共用规则：

- 新增 Query 参数 `include_voted`（int，可选）：
  - **不传或非 1**：默认隐藏「当前审核员在本轮已表决过」的内容（上一轮投过、本轮未投的仍可见）。
  - **`include_voted=1`**：返回全部尚未走完表决流程的待审内容（含自己已表决的）。
- 每条内容新增返回字段 `has_voted`（int）：`0` 本轮未表决，`1` 本轮已表决。

### 1. 获取视频审核列表

**请求**: `GET /api/moderation/videos`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容
- `channel_id` (int, 可选): 频道号；仅返回该频道内的待审视频；不传则不过滤

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 123,
        "uid": 456,
        "username": "作者用户名",
        "title": "视频标题",
        "intro": "视频简介",
        "tags": ["滚木", "搞笑"],
        "tag": "#滚木#搞笑",
        "cover_url": "https://example.com/cover.jpg",
        "video_url": "https://example.com/video.mp4",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 2. 获取动态审核列表

**请求**: `GET /api/moderation/blogs`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容
- `channel_id` (int, 可选): 频道号；仅返回该频道内的待审动态；不传则不过滤

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "blog_list": [
      {
        "bid": 123,
        "uid": 456,
        "username": "作者用户名",
        "title": "动态标题",
        "content": "动态内容",
        "attached_vid": 0,
        "is_gore": 0,
        "blog_type": 0,
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 3. 获取头像审核列表

**请求**: `GET /api/moderation/avatars`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "avatar_list": [
      {
        "uid": 123,
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 4. 获取封面审核列表（旧通用封面）

**请求**: `GET /api/moderation/covers`

**说明**: 审核旧客户端使用的通用封面（`cover_status`），与横版、竖版封面**分开队列**，互不混合。

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "cover_list": [
      {
        "uid": 123,
        "username": "用户名",
        "cover_url": "https://example.com/cover.jpg",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 4.1 获取横版封面审核列表

**请求**: `GET /api/moderation/covers-h`

**说明**: 审核横版个人封面（`cover_h_status`）。参数、权限、响应结构与「获取封面审核列表」相同；`audit_type` 为 `cover_h`。

---

### 4.2 获取竖版封面审核列表

**请求**: `GET /api/moderation/covers-v`

**说明**: 审核竖版个人封面（`cover_v_status`）。参数、权限、响应结构与「获取封面审核列表」相同；`audit_type` 为 `cover_v`。

---

### 5. 获取弹幕审核列表

**请求**: `GET /api/moderation/danmakus`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "danmaku_list": [
      {
        "danmaku_id": 123,
        "vid": 789,
        "uid": 456,
        "username": "作者用户名",
        "text": "弹幕文本",
        "time": 10.5,
        "mode": 1,
        "color": "#FFFFFF",
        "font_size": 25,
        "render": "",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 6. 获取视频评论审核列表

**请求**: `GET /api/moderation/video-comments`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "vcid": 123,
        "parent_vcid": 0,
        "vid": 789,
        "uid": 456,
        "content": "评论内容",
        "time": "2024-01-01 12:00:00",
        "username": "用户名",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 7. 获取动态评论审核列表

**请求**: `GET /api/moderation/blog-comments`

**请求参数** (Query):
- `token` (string, 必需): 审核员Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `include_voted` (int, 可选): `1` 时包含自己本轮已表决的内容

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "bcid": 123,
        "parent_bcid": 0,
        "bid": 456,
        "uid": 456,
        "content": "评论内容",
        "time": "2024-01-01 12:00:00",
        "username": "用户名",
        "has_voted": 0,
        "report_reason": "举报理由（如果是因为被举报而进入审核流程的，否则不返回此字段）"
      }
    ]
  }
}
```

---

### 8. 获取静画作品审核列表

**请求**: `GET /api/moderation/seigas`

**请求参数** (Query): 同视频列表（`token`、`offset`、`num`、`include_voted`）

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "seiga_list": [
      {
        "sid": 10001,
        "uid": 42,
        "username": "作者",
        "title": "标题",
        "description": "说明",
        "cover_url": "https://...",
        "cover_preview_url": "https://...",
        "page_count": 3,
        "is_gore": 0,
        "is_fanwork": 1,
        "has_voted": 0,
        "report_reason": "举报理由（可选）"
      }
    ]
  }
}
```

---

### 9. 获取静画评论审核列表

**请求**: `GET /api/moderation/seiga-comments`

**请求参数** (Query): 同视频评论列表

**权限要求**: 审核员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "scid": 5001,
        "parent_scid": 0,
        "sid": 10001,
        "uid": 23,
        "content": "评论内容",
        "time": "2026-08-10 12:00:00",
        "username": "用户名",
        "has_voted": 0
      }
    ]
  }
}
```

---

## 审核日志（替代 IM 通知）

### 1. 获取未读审核结果数量（用户视角）

**请求**: `GET /api/moderation/logs/unread-count`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `is_admin` (int, 可选): 0或1（如携带将与账号权限校验，不一致则拒绝）
- `is_audit` (int, 可选): 0或1（如携带将与账号权限校验，不一致则拒绝）

**权限要求**: 用户视角（`profile.is_admin=0` 且 `profile.is_audit=0`）

**说明**:
- 只统计 **自己的** 未读「决定性」过审/驳回记录；中间表决票会出现在日志列表中，但不计入未读角标

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "unread_count": 5,
    "unread_approved": 3,
    "unread_rejected": 2
  }
}
```

---

### 2. 获取审核日志列表（用户/审核员/管理员统一接口）

**请求**: `GET /api/moderation/logs`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 限制数量，默认20，最大100
- `audit_type` (string, 可选): `video|blog|avatar|cover|cover_h|cover_v|video_comment|blog_comment|danmaku|seiga|seiga_comment`
- `action` (int, 可选): `1|2|3|4`
- `is_read` (int, 可选): `0|1`
- `is_admin` (int, 可选): 0或1（如携带将与账号权限校验，不一致则拒绝）
- `is_audit` (int, 可选): 0或1（如携带将与账号权限校验，不一致则拒绝）

**权限要求 / 返回范围**:
- **管理员（is_admin=1）**：返回全部日志（is_admin 压过 is_audit）
- **审核员（is_admin=0 且 is_audit=1）**：只返回自己的操作记录
- **普通用户（is_admin=0 且 is_audit=0）**：只返回与自己内容相关的记录，包含过审/驳回/举报/申诉

**已读机制（重要）**:
- 返回给前端的每条日志里会带 `is_unread`（根据查询时的 `is_read` 计算）
- **接口在本次响应后，会把本次返回的记录批量标记为已读**，避免重复未读
- 新增字段 `is_decisive`（int）：`1` 表示该票触发了真正通过/驳回；`0` 为普通表决票或举报/申诉。同一内容可出现多条 `action=1/2` 日志。

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "role": "user",
    "is_admin": 0,
    "is_audit": 0,
    "offset": 0,
    "num": 20,
    "logs": [
      {
        "log_id": 1001,
        "operator_uid": 9001,
        "operator_username": "reviewer",
        "owner_uid": 123,
        "owner_username": "alice",
        "audit_type": "video",
        "action": 2,
        "reject_reason": "不符合规范",
        "target_id": 456,
        "is_decisive": 1,
        "is_read": 0,
        "is_unread": 1,
        "created_at": "2026-02-12 13:00:00",
        "view_role": "user",
        "target_detail": {
          "type": "video",
          "target_id": 456,
          "title": "视频标题",
          "cover_url": "https://...",
          "video_url": "https://..."
        }
      }
    ]
  }
}
```

---

## 过审操作

> **表决说明（所有 approve 接口通用）**  
> 调用成功仅表示「本票已计入」；未达阈值且非管理员强制时，内容仍保持待审。达阈值或管理员一票通过后才真正改状态。重复表决返回 `already_voted`。响应格式仍为 `{ "status": "success" }`，与旧客户端兼容。

### 1. 通过视频

**请求**: `PUT /api/moderation/videos/{vid}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```
或
```json
{
  "status": "error",
  "message": "already_voted"
}
```

---

### 2. 通过动态

**请求**: `PUT /api/moderation/blogs/{bid}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 3. 通过头像

**请求**: `PUT /api/moderation/avatars/{uid}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 4. 通过封面（旧通用封面）

**请求**: `PUT /api/moderation/covers/{uid}/approve`

**横版 / 竖版**（路径对称，其余规则相同）:
- `PUT /api/moderation/covers-h/{uid}/approve` — `audit_type=cover_h`
- `PUT /api/moderation/covers-v/{uid}/approve` — `audit_type=cover_v`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 5. 通过弹幕

**请求**: `PUT /api/moderation/danmakus/{danmaku_id}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 6. 通过视频评论

**请求**: `PUT /api/moderation/video-comments/{vcid}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 7. 通过动态评论

**请求**: `PUT /api/moderation/blog-comments/{bcid}/approve`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 8. 通过静画作品

**请求**: `PUT /api/moderation/seigas/{sid}/approve`

**请求参数** (Body): `token`（审核员）

**权限要求**: 审核员；回避机制同视频

**成功响应**: `{ "status": "success" }`

---

### 9. 通过静画评论

**请求**: `PUT /api/moderation/seiga-comments/{scid}/approve`

**请求参数** (Body): `token`（审核员）

**权限要求**: 审核员；回避机制同视频评论

**成功响应**: `{ "status": "success" }`

---

## 驳回操作

**注意**: 所有驳回操作都**强制要求**提供 `reason`（驳回理由）参数，不能为空。

> **表决说明（所有 reject 接口通用）**  
> 与过审相同：成功表示本票已计入；未达驳回阈值且非管理员强制时内容仍待审。达阈值或管理员一票否决后才真正驳回。重复表决返回 `already_voted`。

### 1. 驳回视频

**请求**: `PUT /api/moderation/videos/{vid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 2. 驳回动态

**请求**: `PUT /api/moderation/blogs/{bid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 3. 驳回头像

**请求**: `PUT /api/moderation/avatars/{uid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 4. 驳回封面（旧通用封面）

**请求**: `PUT /api/moderation/covers/{uid}/reject`

**横版 / 竖版**:
- `PUT /api/moderation/covers-h/{uid}/reject`
- `PUT /api/moderation/covers-v/{uid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 5. 驳回弹幕

**请求**: `PUT /api/moderation/danmakus/{danmaku_id}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 6. 驳回视频评论

**请求**: `PUT /api/moderation/video-comments/{vcid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 7. 驳回动态评论

**请求**: `PUT /api/moderation/blog-comments/{bcid}/reject`

**请求参数** (Body):
- `token` (string, 必需): 审核员Token
- `reason` (string, 必需): 驳回理由

**权限要求**: 审核员

**回避机制**: 
- 不能审核自己上传的内容（会返回 `cannot_review_own_content` 错误）
- 不能审核自己举报的内容（会返回 `cannot_review_own_report` 错误）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误响应**:
```json
{
  "status": "error",
  "message": "cannot_review_own_content"
}
```
或
```json
{
  "status": "error",
  "message": "cannot_review_own_report"
}
```

---

### 8. 驳回静画作品

**请求**: `PUT /api/moderation/seigas/{sid}/reject`

**请求参数** (Body): `token`、`reason`（必需，≤50 字）

**权限要求**: 审核员；回避机制同视频。驳回 **不修改** `is_hall`。

---

### 9. 驳回静画评论

**请求**: `PUT /api/moderation/seiga-comments/{scid}/reject`

**请求参数** (Body): `token`、`reason`（必需）

**权限要求**: 审核员；回避机制同视频评论

---

## 举报操作

**注意**: 所有举报操作都**强制要求**提供 `reason`（举报理由）参数，不能为空。

### 1. 举报视频

**请求**: `POST /api/moderation/videos/{vid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 2. 举报动态

**请求**: `POST /api/moderation/blogs/{bid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 3. 举报头像

**请求**: `POST /api/moderation/avatars/{uid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 4. 举报封面（旧通用封面）

**请求**: `POST /api/moderation/covers/{uid}/report`

**横版 / 竖版**:
- `POST /api/moderation/covers-h/{uid}/report`
- `POST /api/moderation/covers-v/{uid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 5. 举报弹幕

**请求**: `POST /api/moderation/danmakus/{danmaku_id}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 6. 举报视频评论

**请求**: `POST /api/moderation/video-comments/{vcid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（需要经验值>=500）
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户，且经验值>=500

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 7. 举报动态评论

**请求**: `POST /api/moderation/blog-comments/{bcid}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（需要经验值>=500）
- `reason` (string, 必需): 举报理由

**权限要求**: 已登录用户，且经验值>=500

**成功响应**:
```json
{
  "status": "success"
}
```

---

### 8. 举报静画作品

**请求**: `POST /api/moderation/seigas/{sid}/report`

**请求参数** (Body): `token`、`reason`（必需）

**权限要求**: 已登录用户，经验值 ≥500

---

### 9. 举报静画评论

**请求**: `POST /api/moderation/seiga-comments/{scid}/report`

**请求参数** (Body): `token`、`reason`（必需）

**权限要求**: 已登录用户，经验值 ≥500

---

## 申诉操作

**注意**: 所有申诉操作都**强制要求**提供 `reason`（申诉理由）参数，不能为空。申诉操作只能由内容作者本人执行。

### 1. 申诉视频

**请求**: `POST /api/moderation/videos/{vid}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是视频作者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是视频作者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（audit_status=2）的视频进行申诉。

---

### 2. 申诉动态

**请求**: `POST /api/moderation/blogs/{bid}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是动态作者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是动态作者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（audit_status=2）的动态进行申诉。

---

### 3. 申诉头像

**请求**: `POST /api/moderation/avatars/{uid}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是头像所有者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是头像所有者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（avatar_status=-1）的头像进行申诉。

---

### 4. 申诉封面（旧通用封面）

**请求**: `POST /api/moderation/covers/{uid}/appeal`

**横版 / 竖版**:
- `POST /api/moderation/covers-h/{uid}/appeal` — 仅 `cover_h_status=-1` 可申诉
- `POST /api/moderation/covers-v/{uid}/appeal` — 仅 `cover_v_status=-1` 可申诉

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是封面所有者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是封面所有者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（`cover_status=-1`）的旧通用封面进行申诉；横版、竖版分别对应 `cover_h_status=-1`、`cover_v_status=-1`。

---

### 5. 申诉弹幕

**请求**: `POST /api/moderation/danmakus/{danmaku_id}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是弹幕作者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是弹幕作者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（audit_status=2）的弹幕进行申诉。

---

### 6. 申诉视频评论

**请求**: `POST /api/moderation/video-comments/{vcid}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是评论作者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是评论作者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（audit_status=2）的视频评论进行申诉。

---

### 7. 申诉动态评论

**请求**: `POST /api/moderation/blog-comments/{bcid}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token（必须是评论作者）
- `reason` (string, 必需): 申诉理由

**权限要求**: 必须是评论作者本人

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 只能对已被驳回（audit_status=2）的动态评论进行申诉。

---

### 8. 申诉静画作品

**请求**: `POST /api/moderation/seigas/{sid}/appeal`

**请求参数** (Body): `token`（作者本人）、`reason`（必需）

**说明**: 仅 `audit_status=2` 时可申诉。

---

### 9. 申诉静画评论

**请求**: `POST /api/moderation/seiga-comments/{scid}/appeal`

**请求参数** (Body): `token`（评论作者）、`reason`（必需）

**说明**: 仅 `audit_status=2` 时可申诉。

---

## 状态说明

### 审核状态

- **视频/动态/弹幕/评论**:
  - `0`: 待审核
  - `1`: 已通过
  - `2`: 已驳回

- **头像/封面**:
  - `0`: 待审核
  - `正整数（审核员UID）`: 已通过
  - `-1`: 已驳回

### 操作流程

1. **提交内容** → 状态变为 `0`（待审核），开启表决轮次
2. **审核员表决通过** → 记一票；未达阈值时状态仍为待审；达阈值或管理员强制通过后 → 状态变为 `1` 或审核员UID（已通过）
3. **审核员表决驳回** → 记一票（须提供理由）；未达阈值时状态仍为待审；达阈值或管理员强制驳回后 → 状态变为 `2` 或 `-1`（已驳回）
4. **用户申诉** → 状态重新变为 `0`（待审核），**必须提供申诉理由**，开启**新一轮**表决
5. **用户举报** → 状态从 `1` 变为 `0`（待审核），**必须提供举报理由**，开启**新一轮**表决

---

## 注意事项

1. **审核员权限**: 所有审核操作（获取列表、过审、驳回）都需要审核员权限，通过 `is_audit` 字段判断。管理员强制票额外要求 `is_admin=1`。

2. **强制理由**: 驳回、举报、申诉操作都**强制要求**提供 `reason` 参数，不能为空或只包含空白字符。

3. **申诉权限**: 申诉操作只能由内容作者本人执行，系统会验证 `token` 对应的用户是否为内容所有者。

4. **举报权限**: 
   - 视频、动态、头像、封面、弹幕的举报：所有已登录用户都可以举报
   - 视频评论、动态评论的举报：需要用户经验值>=500

5. **审核日志**: 每次表决、举报、申诉都会写入审核日志。表决中间票与决定票均可见；用 `is_decisive` 区分是否真正改状态。

6. **通知 / 未读**: 
   - 用户未读角标仅统计 `is_decisive=1` 的过审/驳回
   - 日志列表仍可查看全部表决记录（含非决定票）

7. **状态转换**: 
   - 申诉会将状态从"已驳回"改回"待审核"并开新轮表决
   - 举报会将状态从"已通过"改回"待审核"并开新轮表决

8. **待审列表**: 默认不返回自己本轮已表决内容；传 `include_voted=1` 可查看并配合 `has_voted` 展示。
