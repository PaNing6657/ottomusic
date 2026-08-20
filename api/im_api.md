# IM 私信模块 API 文档

## 概述

私信模块提供未读消息统计、消息列表查询、发送/读取/删除消息、系统消息一键已读，以及会话列表与会话消息等功能。

**基础信息**:
- **基础路径**: `/api/im`
- **请求格式**: 查询参数（GET）或 JSON 请求体（POST / PATCH / DELETE）
- **响应格式**: JSON
- **认证方式**: 所有接口均需登录，通过 `token` 传递
- **字符编码**: UTF-8

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
- `error_type`: 参数类型错误
- `error_token`: Token 无效或已过期
- `error_receiver`: 接收者不存在
- `error_msg_id`: 消息编号无效或无权访问
- `error_friend_uid`: 好友 UID 无效
- `too_short_message`: 消息内容为空
- `too_long_message`: 消息内容超过 222 字
- `too_big_num`: 请求数量过大
- `warn`: 内容触发敏感词
- `blocked`: 存在拉黑关系，无法发送
- `no_permission`: 没有权限（仅发送者可删除消息）
- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 请求成功 | — |
| `400` | 参数错误 | `missing_argument`、`error_type`、`error_receiver` 等 |
| `401` | 未登录或 Token 无效 | `error_token` |
| `403` | 无权限 | `blocked`、`no_permission` |
| `404` | 接口路径不存在 | `Not found` |
| `405` | HTTP 方法不允许 | `Method not allowed` |
| `500` | 服务器内部错误 | `system_error` |

---

## 消息统计

### 1. 未读消息数

**请求**: `GET /api/im/unread-count?token={token}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "new_message_num": 5
  }
}
```

**HTTP 状态码**:
- `200`: 获取成功
- `401`: Token 无效（`error_token`）

---

## 消息列表

### 2. 已读消息列表

**请求**: `GET /api/im/read-list?token={token}&offset={offset}&num={num}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 50

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "message_list": [
      {
        "msg_id": 1001,
        "sender": 23,
        "receiver": 1,
        "content": "消息内容",
        "time": "2026-04-18 12:00:00",
        "sender_name": "发送者昵称",
        "receiver_name": "接收者昵称",
        "sender_avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**说明**: 发送者为系统账号（UID `0`）时，`sender_name` 为「爱丽丝网络节点」。

**HTTP 状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token 无效
- `500`: 系统错误

---

### 3. 未读消息列表

**请求**: `GET /api/im/unread-list?token={token}&offset={offset}&num={num}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 50

**成功响应**: 结构与「已读消息列表」相同，`data.message_list` 为未读消息。

**HTTP 状态码**: 同「已读消息列表」

---

### 4. 已发消息列表

**请求**: `GET /api/im/sent-list?token={token}&offset={offset}&num={num}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 50

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "message_list": [
      {
        "msg_id": 1001,
        "sender": 1,
        "receiver": 23,
        "content": "消息内容",
        "time": "2026-04-18 12:00:00",
        "sender_name": "发送者昵称",
        "receiver_name": "接收者昵称",
        "receiver_avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**HTTP 状态码**: 同「已读消息列表」

---

## 消息操作

### 5. 发送消息

**请求**: `POST /api/im/messages`

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `receiver` (int, 必需): 接收者 UID
- `message` (string, 必需): 消息内容，1-222 字

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`: 缺少 `receiver` 或 `message`
- `error_receiver`: 接收者不存在
- `too_short_message`: 消息为空
- `too_long_message`: 消息超过 222 字
- `warn`: 触发敏感词
- `blocked`: 与对方存在拉黑关系

**HTTP 状态码**:
- `200`: 发送成功
- `400`: 参数或内容校验错误
- `401`: Token 无效
- `403`: 存在拉黑关系（`blocked`）
- `500`: 系统错误

---

### 6. 读取单条消息

**请求**: `PATCH /api/im/messages/{msg_id}/read`

**路径参数**:
- `msg_id` (int, 必需): 消息编号

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "sender": 23,
    "receiver": 1,
    "content": "消息内容",
    "sender_name": "发送者昵称",
    "receiver_name": "接收者昵称"
  }
}
```

**说明**: 若当前用户为接收者，会将该消息标记为已读。

**错误码**:
- `error_msg_id`: 消息不存在或无权访问

**HTTP 状态码**:
- `200`: 读取成功
- `400`: 消息无效（`error_msg_id`）
- `401`: Token 无效
- `500`: 系统错误

---

### 7. 系统消息一键已读

**请求**: `PATCH /api/im/system/read-all`

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 将当前用户收到的所有系统消息（发送者 UID 为 `0`）标记为已读。

**HTTP 状态码**:
- `200`: 操作成功
- `401`: Token 无效
- `500`: 系统错误

---

### 8. 删除消息

**请求**: `DELETE /api/im/messages/{msg_id}`

**路径参数**:
- `msg_id` (int, 必需): 消息编号

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**: 仅消息发送者可删除。

**错误码**:
- `no_permission`: 非发送者，无权删除

**HTTP 状态码**:
- `200`: 删除成功
- `400`: 消息编号无效
- `401`: Token 无效
- `403`: 无权限（`no_permission`）
- `500`: 系统错误

---

## 会话

### 9. 会话列表

**请求**: `GET /api/im/conversations?token={token}&offset={offset}&num={num}&if_time_desc={if_time_desc}`

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 12
- `if_time_desc` (int, 可选): 是否按最后沟通时间倒序，默认 `1`（`0` 或 `1`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "user_list": [
      {
        "uid": 23,
        "username": "昵称",
        "intro": "简介",
        "avatar_url": "https://example.com/avatar.jpg",
        "last_time": "2026-04-18 12:00:00",
        "last_message": "最后一条消息内容",
        "new_message_num": 2
      }
    ]
  }
}
```

**HTTP 状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token 无效
- `500`: 系统错误

---

### 10. 会话消息列表

**请求**: `GET /api/im/conversations/{friend_uid}/messages?token={token}&offset={offset}&num={num}&if_time_desc={if_time_desc}`

**路径参数**:
- `friend_uid` (int, 必需): 对方 UID（系统账号为 `0`）

**请求参数** (Query):
- `token` (string, 必需): 用户认证令牌
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 50
- `if_time_desc` (int, 可选): 是否按时间倒序，默认 `1`（`0` 或 `1`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "message_list": [
      {
        "msg_id": 1001,
        "sender": 23,
        "receiver": 1,
        "content": "消息内容",
        "time": "2026-04-18 12:00:00",
        "sender_name": "发送者昵称",
        "sender_avatar_url": "https://example.com/avatar1.jpg",
        "receiver_name": "接收者昵称",
        "receiver_avatar_url": "https://example.com/avatar2.jpg",
        "is_read": 1
      }
    ]
  }
}
```

**说明**: 获取会话消息时，会将对方发送给当前用户的未读消息自动标记为已读。

**错误码**:
- `error_friend_uid`: 好友 UID 无效（`0` 为系统账号，合法）

**HTTP 状态码**:
- `200`: 获取成功
- `400`: 参数错误（`error_friend_uid`、`error_type` 等）
- `401`: Token 无效
- `500`: 系统错误

---

## 评论/回复互动收件箱

提供跨视频/动态/静画的结构化评论与回复通知。已读状态独立于私信维护。

**content_type**: `1`=视频 `2`=动态 `3`=静画  
**kind**: `1`=根评论 `2`=回复

### 1. 未读数

**请求**: `GET /api/im/comment-replies/unread-count?token={token}`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "unread_count": 3
  }
}
```

### 2. 收件箱列表

**请求**: `GET /api/im/comment-replies?token={token}&offset={offset}&num={num}`

**可选 Query 参数**:
- `kind` (int): `1` 仅根评论 / `2` 仅回复
- `content_type` (int): `1` 视频 / `2` 动态 / `3` 静画
- `is_read` (int): `0` 未读 / `1` 已读

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "list": [
      {
        "rid": 1001,
        "content_type": 2,
        "content_id": 12345,
        "source_comment_id": 67890,
        "kind": 2,
        "parent_rid": 800,
        "root_rid": 800,
        "sender_uid": 42,
        "receiver_uid": 1,
        "content": "说得对",
        "time": "2026-08-16 12:00:00",
        "is_read": 0,
        "sender_username": "alice",
        "sender_honour": "",
        "sender_avatar_url": "https://example.com/avatar.jpg",
        "content_title": "动态标题"
      }
    ],
    "total": 128
  }
}
```

### 3. 单条已读

**请求**: `PATCH /api/im/comment-replies/{rid}/read`

**请求体** (JSON):
```json
{
  "token": "用户令牌"
}
```

**错误码**: `error_rid`

### 4. 全部已读

**请求**: `PATCH /api/im/comment-replies/read-all`

**请求体** (JSON):
```json
{
  "token": "用户令牌"
}
```

**说明**:
- 自己评自己的内容不产生收件箱记录
- 仅 `audit_status=1` 且未删除的记录出现在列表中

---

## @ 提及收件箱

记录视频简介、动态正文、静画说明、根评论、子评论中的 `@` 提及。已读状态独立维护，与评论回复、私信未读互不影响。

**写入规则**:
- 发表/编辑时，若 `@用户名` 能解析到站内用户，正文中会替换为 `[@用户名](https://www.ottohub.cn/u/{uid})` 链接（与评论 Markdown 链接一致）
- `@` 提及通知仍按原始文本解析，不受 Markdown 替换影响

**content_type**: `1`=视频 `2`=动态 `3`=静画  
**context_type**: `1`=正文/简介/描述 `2`=根评论 `3`=子评论

### 1. 未读数

**请求**: `GET /api/im/mentions/unread-count?token={token}`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "unread_count": 2
  }
}
```

### 2. 收件箱列表

**请求**: `GET /api/im/mentions?token={token}&offset={offset}&num={num}`

**可选 Query 参数**:
- `content_type` (int): `1` 视频 / `2` 动态 / `3` 静画
- `context_type` (int): `1` 正文 / `2` 根评论 / `3` 子评论
- `is_read` (int): `0` 未读 / `1` 已读

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "list": [
      {
        "mid": 501,
        "content_type": 2,
        "content_id": 12345,
        "context_type": 2,
        "source_comment_id": 67890,
        "sender_uid": 42,
        "receiver_uid": 1,
        "excerpt": "...@alice 说得对...",
        "time": "2026-08-16 13:00:00",
        "is_read": 0,
        "sender_username": "bob",
        "sender_honour": "",
        "sender_avatar_url": "https://example.com/avatar.jpg",
        "content_title": "动态标题"
      }
    ],
    "total": 15
  }
}
```

### 3. 单条已读

**请求**: `PATCH /api/im/mentions/{mid}/read`

**请求体** (JSON):
```json
{
  "token": "用户令牌"
}
```

**错误码**: `error_mid`

### 4. 全部已读

**请求**: `PATCH /api/im/mentions/read-all`

**请求体** (JSON):
```json
{
  "token": "用户令牌"
}
```

**说明**:
- 不会给自己发 `@` 通知
- 存在拉黑关系时，写入操作返回 `blocked`
- 仅 `audit_status=1` 且未删除的记录出现在列表中
- 编辑视频简介 / 静画说明时会替换该来源下的旧 `@` 记录
