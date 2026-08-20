# User 用户模块 API 文档

## 概述

用户模块提供用户搜索、用户名匹配（@人联想）、用户详情等功能。

**基础信息**:
- **基础路径**: `/api/user`
- **请求格式**: 查询参数（GET）
- **响应格式**: JSON
- **认证方式**: 无需登录
- **字符编码**: UTF-8

## 通用响应格式

**成功响应**:
```json
{
  "status": "success",
  "data": { ... }
}
```

**列表类接口**：用户列表统一使用嵌套格式，`data` 内包含 `user_list` 数组；若接口带总数或分页信息，则同时包含 `total_count` 等字段。

**错误响应**:
```json
{
  "status": "error",
  "message": "错误信息代码"
}
```

## 通用错误码

- `missing_argument`: 缺少必需参数
- `error_type`: 参数类型错误
- `error_uid`: 用户ID无效或用户不存在
- `too_big_num`: 请求数量过大
- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 请求成功 | — |
| `400` | 参数错误、用户不存在 | `missing_argument`、`error_type`、`too_big_num`、`error_uid` |
| `404` | 接口路径不存在 | `Not found` |
| `405` | 使用了非 GET 方法 | `Method not allowed` |
| `500` | 服务器内部错误 | `system_error` |

---

## 用户查询

### 1. 搜索用户列表

**请求**: `GET /api/user/search?search_term={search_term}&offset={offset}&num={num}&uid_desc={uid_desc}&fans_count_desc={fans_count_desc}&experience_desc={experience_desc}`

**请求参数** (Query):
- `search_term` (string, 必需): 搜索词（匹配用户名、简介、性别等）
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 24
- `uid_desc` (int, 可选): 是否按用户ID从新到旧排序（0 或 1，默认 0）
- `fans_count_desc` (int, 可选): 是否按粉丝数降序排序（0 或 1，默认 0）
- `experience_desc` (int, 可选): 是否按经验值降序排序（0 或 1，默认 0）
- `channel_id` (int, 可选): 频道号；仅返回已加入该频道（`channel_user.status=1`）的用户；不传则不过滤

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "total_count": 42,
    "user_list": [
      {
        "uid": 123,
        "username": "用户名",
        "intro": "简介",
        "honour": "荣誉",
        "fans_count": 100,
        "level": "UNO",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**响应字段说明**:
- `total_count`: 匹配结果总数
- `user_list`: 用户列表
- `level`: 经验等级（ZERO / UNO / DUE / TRE / QUATTRO / CINQUE / SEI / SETTE / OTTO）

**错误码**:
- `missing_argument`: 缺少必需参数（`search_term`、`offset`、`num` 任一缺失）
- `error_type`: 参数类型错误（`offset` 或 `num` 非数字）
- `too_big_num`: 数量超过 24

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误（对应 `missing_argument`、`error_type`、`too_big_num`）
- `404`: 接口路径不存在（`message`: `Not found`）
- `405`: 请求方法错误，仅支持 GET（`message`: `Method not allowed`）

---

### 2. 用户名匹配（@人联想）

**请求**: `GET /api/user/username-match?match={match}&num={num}`

**请求参数** (Query):
- `match` (string, 必需): 用于匹配用户名的字段，不可为空字符串
- `num` (int, 必需): 返回数量，最大 30

**说明**:
- 按用户名模糊匹配（`LIKE %match%`），仅返回 `status = 0` 的用户
- 排序：前缀匹配优先，其次粉丝数降序，再按 `uid` 降序

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "user_list": [
      {
        "uid": 123,
        "username": "otto_hub",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数，或 `match` 为空字符串
- `error_type`: 参数类型错误（`num` 非数字或 ≤ 0）
- `too_big_num`: 数量超过 30
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误（对应 `missing_argument`、`error_type`、`too_big_num`）
- `404`: 接口路径不存在（`message`: `Not found`）
- `405`: 请求方法错误，仅支持 GET（`message`: `Method not allowed`）
- `500`: 系统错误（对应 `system_error`）

---

### 3. 用户详情

**请求**: `GET /api/user/{uid}`

**请求参数** (Path):
- `uid` (int, 必需): 用户ID

**请求参数** (Query):
- `channel_id` (int, 可选): 频道号；传入后 `video_num`、`blog_num` 仅统计该频道内已发布内容；`followings_count`、`fans_count` 仅统计该频道的正式成员（`channel_user.status=1`），不含仅关注频道未加入的用户；不传则返回全站统计（`video_num`、`blog_num` 不含 `channel_only_visible=1` 的内容）。`seiga_num`、`media_num` 不受 `channel_id` 影响，均为用户全站已过审作品数

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "uid": 123,
    "username": "用户名",
    "intro": "简介",
    "time": "2023-01-01 00:00:00",
    "sex": "男",
    "honour": "荣誉",
    "experience": 100,
    "avatar_url": "https://example.com/avatar.jpg",
    "cover_url": "https://example.com/cover.jpg",
    "cover_h_url": "https://example.com/user_cover_h.jpg",
    "cover_v_url": "https://example.com/user_cover_v.jpg",
    "video_num": 10,
    "blog_num": 5,
    "seiga_num": 3,
    "media_num": 2,
    "followings_count": 20,
    "fans_count": 15
  }
}
```

**响应字段说明**:
- `uid`: 用户ID
- `username`: 用户名
- `intro`: 简介
- `time`: 注册时间
- `sex`: 性别
- `honour`: 荣誉
- `experience`: 经验值
- `avatar_url`: 头像URL
- `cover_url`: 旧版通用封面 URL；旧客户端继续使用
- `cover_h_url`: 横版个人封面 URL；未设置时为默认图 `https://img.ottohub.cn/image/1786881459_5146_1.png`，不回退旧 `cover_url`
- `cover_v_url`: 竖版个人封面 URL（`user/user_cover_v/user_cover_v_{uid}.jpg`）；未设置时回退为 `cover_url`
- `video_num`: 已发布视频数量（审核通过且未删除）；全站统计时排除 `channel_only_visible=1`；携带 `channel_id` 时仅计该频道内
- `blog_num`: 已发布动态数量（审核通过且未删除）；全站统计时排除 `channel_only_visible=1`；携带 `channel_id` 时仅计该频道内
- `seiga_num`: 已发布静画数量；不受 `channel_id` 影响
- `media_num`: 已发布媒体数量（审核通过且未删除）；不受 `channel_id` 影响
- `followings_count`: 关注数；携带 `channel_id` 时仅计所关注用户中为该频道正式成员的数量
- `fans_count`: 粉丝数；携带 `channel_id` 时仅计粉丝中为该频道正式成员的数量（非 `profile.fans_count` 缓存值）

**错误码**:
- `error_type`: 用户ID格式错误（`uid` 非数字）
- `error_uid`: 用户不存在
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误或用户不存在（对应 `error_type`、`error_uid`）
- `404`: 接口路径不存在（`message`: `Not found`）
- `405`: 请求方法错误，仅支持 GET（`message`: `Method not allowed`）
- `500`: 系统错误（对应 `system_error`）
