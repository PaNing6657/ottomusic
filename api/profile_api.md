# Profile 个人资料模块 API 文档

## 概述

个人资料模块提供当前登录用户的资料查询、统计数据查询、资料更新，以及头像/封面上传接口。原 `update_username`、`update_pw`、`update_phone`、`update_qq`、`update_sex`、`update_intro` 六个接口已合并为单一更新接口；原 creator 模块的 `update_avatar`、`update_cover` 已迁移至本模块。

**基础信息**:
- **基础路径**: `/api/profile`
- **请求格式**: 查询参数（GET）或 JSON 请求体（PATCH）
- **响应格式**: JSON
- **认证方式**: 所有接口均需登录，通过 `token` 传递
- **字符编码**: UTF-8

## 相关模块说明

以下原 profile 模块接口已迁移至其他 REST 模块：

| 功能 | 新接口 |
|------|--------|
| 收藏视频列表 | `GET /api/video/favorite-list` |
| 视频历史记录 | `GET /api/video/history-list` |
| 管理视频列表 | `GET /api/video/manage-list` |
| 收藏动态列表 | `GET /api/blog/favorite-list` |
| 管理动态列表 | `GET /api/blog/manage-list` |
| 点赞/收藏动态 | `POST /api/blog/like/{bid}`、`POST /api/blog/favorite/{bid}` |
| 删除动态 | `DELETE /api/blog/{bid}` |
| 审核头像/封面及审批操作 | `/api/moderation/avatars`、`/api/moderation/covers` 等 |

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
- `error_token`: Token 无效或已过期
- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 请求成功 | — |
| `400` | 参数错误或字段校验失败 | `missing_argument`、`error_username` 等 |
| `401` | 未登录或 Token 无效 | `error_token` |
| `404` | 接口路径不存在 | `Not found` |
| `405` | HTTP 方法不允许 | `Method not allowed` |
| `500` | 服务器内部错误 | `system_error` |

---

## 资料查询

### 1. 获取当前用户资料

**请求**: `GET /api/profile?token={token}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "uid": 123,
    "email": "user@qq.com",
    "phone": "13800138000",
    "qq": "123456789",
    "username": "用户名",
    "time": "2024-01-01 12:00:00",
    "sex": "保密",
    "intro": "个人简介",
    "honour": "荣誉",
    "experience": 100,
    "show_seiga_gore": 0
  }
}
```

**响应字段补充**:
- `show_seiga_gore`: 静画区恶心猎奇可见开关，`0` 默认不看，`1` 允许在列表不传 `is_gore` 时看到猎奇，以及显式筛 `is_gore=1`

**错误码**:
- `error_token`: Token 无效

**HTTP 状态码**:
- `200`: 获取成功
- `401`: Token 无效（`error_token`）
- `500`: 系统错误（`system_error`）

---

### 2. 获取当前用户统计数据

**请求**: `GET /api/profile/stats?token={token}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_num": 10,
    "blog_num": 5,
    "followings_count": 20,
    "fans_count": 100
  }
}
```

**响应字段说明**:
- `video_num`: 已发布（审核通过）视频数量
- `blog_num`: 已发布（审核通过）动态数量
- `followings_count`: 关注数
- `fans_count`: 粉丝数

**错误码**:
- `error_token`: Token 无效

**HTTP 状态码**:
- `200`: 获取成功
- `401`: Token 无效（`error_token`）

---

### 3. 查询是否为审核员

**请求**: `GET /api/profile/is-audit?token={token}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "is_audit": 1
  }
}
```

**错误码**:
- `error_token`: Token 无效

**HTTP 状态码**:
- `200`: 获取成功
- `401`: Token 无效（`error_token`）

---

## 资料更新

### 4. 更新用户资料

**请求**: `PATCH /api/profile`

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `username` (string, 可选): 昵称，2-20 字符
- `pw` (string, 可选): 新密码，8-20 位 ASCII 字符
- `phone` (string, 可选): 手机号，11 位中国大陆号码
- `qq` (string, 可选): QQ 号，5-11 位数字
- `sex` (string, 可选): 性别，1-10 字符
- `intro` (string, 可选): 简介，1-50 字符
- `show_seiga_gore` (int, 可选): 静画区恶心猎奇开关，`0` 或 `1`

至少传入一个可更新字段（`username`、`pw`、`phone`、`qq`、`sex`、`intro`、`show_seiga_gore` 之一）。可同时传入多个字段；**先校验全部字段，任一不通过则所有字段均不更新**；若有多个字段不符合要求，会按字段顺序（`username` → `pw` → `phone` → `qq` → `sex` → `intro` → `show_seiga_gore`）依次返回全部错误码。

**请求示例**（同时修改昵称和简介）:
```json
{
  "token": "abc123...",
  "username": "新昵称",
  "intro": "新的个人简介"
}
```

**成功响应**（未修改密码）:
```json
{
  "status": "success"
}
```

**成功响应**（修改了密码，返回新 Token）:
```json
{
  "status": "success",
  "data": {
    "new_token": "新的认证令牌"
  }
}
```

**错误响应**（单个字段错误）:
```json
{
  "status": "error",
  "message": "error_username"
}
```

**错误响应**（多个字段错误，按字段顺序依次列出）:
```json
{
  "status": "error",
  "message": ["error_username", "error_pw", "error_intro"]
}
```

**字段校验规则**:

| 字段 | 规则 |
|------|------|
| `username` | 2-20 字符；不可含 `@`、`<`、空格；仅允许字母、数字、符号（含 emoji）与下划线 `_`；不可与已有昵称重复 |
| `pw` | 8-20 位；仅 ASCII 可打印字符 |
| `phone` | 11 位数字，以 `1` 开头 |
| `qq` | 5-11 位纯数字 |
| `sex` | 1-10 字符 |
| `intro` | 1-50 字符 |
| `show_seiga_gore` | 仅 `0` 或 `1`；`1` 时登录用户可在静画列表不传 `is_gore` 时同时看到猎奇，以及显式传 `is_gore=1` |

**错误码**:
- `missing_argument`: 未传入任何可更新字段
- `error_token`: Token 无效
- `error_username`: 昵称格式不合法
- `username_exist`: 昵称已被占用
- `error_pw`: 密码格式不合法
- `error_phone`: 手机号格式不合法
- `error_qq`: QQ 号格式不合法
- `error_sex`: 性别格式不合法
- `error_intro`: 简介格式不合法
- `error_type`: 参数类型错误（如 `show_seiga_gore` 非 0/1）
- `warn`: 内容触发敏感词过滤
- `system_error`: 系统错误

**HTTP 状态码**:
- `200`: 更新成功
- `400`: 参数或字段校验错误
- `401`: Token 无效（`error_token`）
- `500`: 系统错误（`system_error`）

**说明**:
- 也支持 `PUT /api/profile`，行为与 `PATCH` 相同
- 修改密码后旧 Token 失效，需使用响应中的 `new_token`

---

## 头像与封面

### 5. 上传用户头像

**请求**: `POST /api/profile/avatar`

**请求参数** (Form Data):
- `token` (string, 必需): 用户认证令牌
- `file_jpg` (file, 必需): 头像图片文件

**支持格式**: `jpg`、`jpeg`、`png`、`gif`、`webp`

**大小限制**: 最大 3 MB

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `error_token`: Token 无效
- `file_not_found`: 未上传文件或上传失败
- `error_file`: 文件格式不支持
- `too_big_file`: 文件超过大小限制
- `system_error`: 系统错误

**HTTP 状态码**:
- `200`: 上传成功
- `400`: 参数或文件错误（`file_not_found`、`error_file`、`too_big_file`）
- `401`: Token 无效（`error_token`）
- `500`: 系统错误（`system_error`）

**说明**:
- 上传后 `avatar_status` 重置为待审核（`0`），`avatar_version` 自增

---

### 6. 上传用户封面

**请求**: `POST /api/profile/cover`

**请求参数** (Form Data):
- `token` (string, 必需): 用户认证令牌
- `file_jpg` (file, 必需): 封面图片文件

**支持格式**: `jpg`、`jpeg`、`png`、`gif`、`webp`

**大小限制**: 最大 3 MB（上传后自动压缩至约 100 KB 以内）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `error_token`: Token 无效
- `file_not_found`: 未上传文件或上传失败
- `error_file`: 文件格式不支持
- `too_big_file`: 文件超过大小限制
- `system_error`: 系统错误

**HTTP 状态码**:
- `200`: 上传成功
- `400`: 参数或文件错误（`file_not_found`、`error_file`、`too_big_file`）
- `401`: Token 无效（`error_token`）
- `500`: 系统错误（`system_error`）

**说明**:
- 上传后 `cover_status` 重置为待审核（`0`），`cover_version` 自增
- 非 GIF 图片会缩放至最大 1200×800 并压缩；GIF 不压缩

---

### 7. 上传横版个人封面

**请求**: `POST /api/profile/cover-h`

参数、格式、大小限制、响应与错误码同「上传用户封面」。

**说明**:
- 字段：`cover_h_status`、`cover_h_version`
- 横版客户端读取 `cover_h_url`；未设置时使用默认横版封面图，不回退旧 `cover_url`

---

### 8. 上传竖版个人封面

**请求**: `POST /api/profile/cover-v`

参数、格式、大小限制、响应与错误码同「上传用户封面」。

**说明**:
- COS：`user/user_cover_v/user_cover_v_{uid}.jpg`
- 竖版客户端读取 `cover_v_url`；若未设置竖版封面，对外展示会回退到旧 `cover_url`
- 图片缩放至最大 800×1200
