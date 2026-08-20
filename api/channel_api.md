# Channel 频道模块 API 文档

## 概述

频道模块是一个多人协作的内容聚合系统，允许用户创建频道、管理成员、发布内容等。

**基础信息**:
- **基础路径**: `/api/channel`
- **请求格式**: JSON（POST/PUT/DELETE）或 Query参数（GET）
- **响应格式**: JSON
- **认证方式**: 通过 `token` 参数传递（GET请求）或请求体（POST/PUT/DELETE请求）
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
- `error_token`: Token无效或已过期
- `permission_denied`: 权限不足
- `resource_not_found`: 资源不存在
- `invalid_parameter`: 参数无效
- `system_error`: 系统错误
- `warn`: 内容包含敏感词

## 通用 HTTP 状态码

与 `video_api.md` 一致：业务结果以响应体 `status` / `message` 为准，HTTP 状态码用于分层错误。

| HTTP | 含义 |
|------|------|
| `200` / `201` | 成功（创建类接口多为 `201`） |
| `400` | 参数错误、业务校验失败；**含资源不存在**（`resource_not_found`，不用 `404`，避免 nginx 拦截成 HTML） |
| `401` | 未登录（`Token required`）或 Token 无效（`error_token`） |
| `403` | 权限不足或策略拒绝 |
| `409` | 冲突（已存在 / 重复操作） |
| `429` | 请求过于频繁 |
| `500` | 系统错误 |

各接口下方的 **HTTP状态码** 小节为该接口可能返回的集合。

---

## 频道管理

### 1. 创建频道

**请求**: `POST /api/channel/create`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `channel_name` (string, 必需): 频道名（必须包含字母和数字，3-20个字符，唯一，创建后不可修改，大写字母会自动转换为小写存储）
- `channel_title` (string, 必需): 频道显示名称（1-15字）
- `description` (string, 可选): 频道描述（0-150字，可以为空）
- `cover_url` (string, 可选): 频道封面URL
- `join_permission` (int, 可选): 加入权限（0-任何人可加入，1-需要申请审核，2-不允许申请），默认0
- `open_post` (int, 可选): 免加入投稿（0-关闭，须成员资格投稿；1-开启，登录用户无需加入即可投稿，不自动加入/关注），默认0

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "channel_name": "techhub",
    "channel_title": "技术交流社区",
    "description": "技术讨论和分享",
    "cover_url": "https://example.com/cover.jpg",
    "join_permission": 0,
    "open_post": 0,
    "creator_uid": 456,
    "owner_uid": 456,
    "member_count": 1,
    "follower_count": 0,
    "created_at": "2024-01-01 12:00:00"
  }
}
```

**限制说明**:
- 每个用户最多可以拥有10个有效频道（未删除的）
- 每个用户一周内最多可以创建10个频道（包括已删除的）
- 频道标题和描述会进行敏感词检测，包含敏感词时会返回 `warn` 错误

**HTTP状态码**:
- `201`: 创建成功
- `400`: 参数错误 / `warn` 等
- `401`: 未登录或 Token 无效
- `403`: 创建数量超限
- `409`: 频道名已存在
- `500`: 系统错误

---

### 2. 获取频道详情

**请求**: `GET /api/channel/{channel_id}`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（用于判断是否为成员）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "channel_name": "techhub",
    "channel_title": "技术交流社区",
    "description": "技术讨论和分享",
    "cover_url": "https://example.com/cover.jpg",
    "creator_uid": 456,
    "owner_uid": 456,
    "admin_uids": [789, 101],
    "join_permission": 0,
    "open_post": 0,
    "member_count": 50,
    "follower_count": 200,
    "created_at": "2024-01-01 12:00:00",
    "updated_at": "2024-01-15 10:30:00",
    "is_member": true,
    "is_following": false,
    "user_role": 0,
    "is_blacklisted": false
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 3. 更新频道信息

**请求**: `PUT /api/channel/{channel_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `channel_title` (string, 可选): 频道显示名称（1-15字）
- `description` (string, 可选): 频道描述（0-150字，可以为空）
- `cover_url` (string, 可选): 频道封面URL
- `join_permission` (int, 可选): 加入权限（0-任何人可加入，1-需要申请审核，2-不允许申请）
- `open_post` (int, 可选): 免加入投稿（0-关闭；1-开启，登录用户无需加入即可投稿）

**权限要求**: 仅所有者

**注意**: 
- `channel_name`（频道名）不能修改，如果传入此参数将被直接忽略
- 当将 `join_permission` 从需要审批改为不需要审批时，所有待审核的申请会自动被审批通过
- `open_post=1` 时投稿不自动加入、不自动关注；黑名单用户仍不可投稿；`channel_only_visible=1` 内容的可见性规则不变

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "updated_at": "2024-01-15 15:00:00"
  }
}
```

**HTTP状态码**:
- `200`: 更新成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 4. 删除频道

**请求**: `DELETE /api/channel/{channel_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `verification_code` (string/int, 必需): 删除频道验证码（需先调用“发送删除频道验证码”接口获取）

**权限要求**: 所有者

**成功响应**:
```json
{
  "status": "success",
  "message": "频道已删除",
  "data": {
    "video_count": 25,
    "blog_count": 10,
    "total_content": 35
  }
}
```

**注意**: 删除频道时，该频道下的所有视频和动态的 `channel_id`、`channel_section_id` 会被设置为 `0`，`channel_only_visible` 同步重置为 `0`，让内容回归站外可见且不属于任何频道。

**错误码补充**:
- `missing_argument_verification_code`: 缺少验证码参数
- `error_verification_code`: 验证码错误或已失效
- `email_unexist`: 当前用户未绑定邮箱或邮箱为空

**HTTP状态码**:
- `200`: 删除成功
- `400`: 参数错误 / 资源不存在 / 验证码相关错误
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 5. 获取频道列表

**请求**: `GET /api/channel`

**请求参数** (Query):
- `token` (string, 可选): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100
- `sort` (string, 可选): 排序方式（`created_at`-创建时间，`member_count`-成员数，`follower_count`-关注数），默认`created_at`
- `order` (string, 可选): 排序顺序（`asc`-升序，`desc`-降序），默认`desc`
- `keyword` (string, 可选): 搜索关键词（搜索频道名和标题）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channels": [
      {
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "description": "技术讨论和分享",
        "cover_url": "https://example.com/cover.jpg",
        "member_count": 50,
        "follower_count": 200,
        "created_at": "2024-01-01 12:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

## 成员管理

### 6. 申请加入频道

**请求**: `POST /api/channel/{channel_id}/members`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "uid": 456,
    "status": 0,
    "message": "申请已提交，等待审核"
  }
}
```

**注意**: 
- 如果频道允许直接加入（`join_permission=0`），`status` 为 1，`message` 为 "已成功加入频道"
- 如果频道需要申请审核（`join_permission=1`），`status` 为 0，`message` 为 "申请已提交，等待审核"

**HTTP状态码**:
- `201`: 申请/加入成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录或 Token 无效
- `403`: 黑名单 / 不允许加入
- `409`: 已是成员 / 已申请
- `500`: 系统错误

---

### 7. 获取成员列表

**请求**: `GET /api/channel/{channel_id}/members`

**请求参数** (Query):
- `token` (string, 可选): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100
- `role` (int, 可选): 角色筛选（0-普通成员，1-管理员，2-所有者）
- `status` (int, 可选): 状态筛选（0-待审核，1-已加入，2-已拒绝）

**权限说明**: 
- 非成员和普通成员：只能查看已加入的成员（status=1）
- 管理员和所有者：可以查看所有状态的成员

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "members": [
      {
        "uid": 456,
        "username": "张三",
        "avatar_url": "https://example.com/avatar.jpg",
        "role": 0,
        "status": 1,
        "joined_at": "2024-01-01 12:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "total_pages": 3
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 8. 审批成员申请

**请求**: `PUT /api/channel/{channel_id}/members/{uid}`

**请求参数** (Body):
- `token` (string, 必需): 管理员Token
- `action` (string, 必需): 操作类型（`approve`-通过，`reject`-拒绝）
- `reason` (string, 可选): 拒绝原因

**权限要求**: 管理员或所有者

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "uid": 456,
    "status": 1,
    "message": "申请已通过"
  }
}
```

**HTTP状态码**:
- `200`: 审批成功
- `400`: 参数错误 / 资源不存在 / 非待审核状态
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 9. 踢出成员

**请求**: `DELETE /api/channel/{channel_id}/members/{uid}`

**请求参数** (Body):
- `token` (string, 必需): 管理员Token
- `reason` (string, 可选): 踢出原因

**权限要求**: 管理员或所有者

**限制说明**:
- 不能踢出所有者
- 不能踢出管理员，必须先通过"设置成员角色"接口将其角色改为普通成员后才能踢出

**成功响应**:
```json
{
  "status": "success",
  "message": "成员已踢出"
}
```

**HTTP状态码**:
- `200`: 踢出成功
- `400`: 参数错误 / 资源不存在 / 非成员
- `401`: 未登录或 Token 无效
- `403`: 权限不足
- `500`: 系统错误

---

### 10. 退出频道

**请求**: `DELETE /api/channel/{channel_id}/members/me`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**限制说明**:
- 所有者不能退出，需要先转让所有权
- 管理员退出时会自动解除管理员职务

**成功响应**:
```json
{
  "status": "success",
  "message": "已退出频道"
}
```

**HTTP状态码**:
- `200`: 退出成功
- `400`: 参数错误 / 资源不存在 / 非成员
- `401`: 未登录或 Token 无效
- `403`: 所有者不可退出（`cannot_leave_owner`）
- `500`: 系统错误

---

### 11. 设置成员角色

**请求**: `PUT /api/channel/{channel_id}/members/{uid}/role`

**请求参数** (Body):
- `token` (string, 必需): 所有者Token
- `role` (int, 必需): 新角色（0-普通成员，1-管理员，2-所有者）
- `verification_code` (string/int, 可选): **当 `role=2`（转让所有权）时必需**，需先调用“发送频道所有权转让验证码”接口获取

**权限要求**: 仅所有者

**限制说明**:
- 只能设置频道内已加入的成员
- 被拉黑的用户不能被设置为管理员或所有者
- 只有所有者可以提升普通成员为管理员，最多10个管理员
- **所有者不能修改自己的角色**（含不能自降为普通成员），错误码 `cannot_change_own_role`
- 所有者可以设置除了自己以外的任意成员为所有者
- 当设置其他成员为所有者时，当前所有者会自动变为普通成员
- 当 `role=2` 时必须提供 `verification_code`，并且验证码会在转让成功后被删除（一次性）

**错误码补充**（当 `role=2` 时可能返回）:
- `missing_argument_verification_code`: 缺少验证码参数
- `error_verification_code`: 验证码错误或已失效
- `email_unexist`: 当前用户未绑定邮箱或邮箱为空
- `cannot_change_own_role`: 试图修改自己的角色

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "uid": 456,
    "old_role": 0,
    "new_role": 1,
    "message": "角色已更新"
  }
}
```

**HTTP状态码**:
- `200`: 设置成功
- `400`: 参数错误 / 资源不存在 / 角色与验证码相关错误
- `401`: 未登录或 Token 无效
- `403`: 权限不足
- `500`: 系统错误

---

### 12. 获取待审核申请列表

**请求**: `GET /api/channel/{channel_id}/members/pending`

**请求参数** (Query):
- `token` (string, 必需): 管理员Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**权限要求**: 管理员或所有者

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "applications": [
      {
        "uid": 456,
        "username": "张三",
        "avatar_url": "https://example.com/avatar.jpg",
        "status": 0,
        "applied_at": "2024-01-15 10:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

## 内容管理

### 13. 获取频道内容

**请求**: `GET /api/channel/{channel_id}/content`

**请求参数** (Query):
- `token` (string, 可选): 用户Token
- `type` (string, 可选): 内容类型（`video`-视频，`blog`-动态，`all`-全部），默认`all`
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100
- `sort` (string, 可选): 排序方式（`created_at`-创建时间，`view_count`-浏览量，`like_count`-点赞数），默认`created_at`（当`random=true`时此参数无效）
- `order` (string, 可选): 排序顺序（`asc`-升序，`desc`-降序），默认`desc`（当`random=true`时此参数无效）
- `channel_section_id` (int, 可选): 二级分区ID（筛选指定分区的内容，0表示筛选不属于任何二级分区的内容），不提供则返回所有分区的内容
- `random` (boolean, 可选): 是否随机推荐（`true`或`1`表示随机排序，不看任何权重），默认`false`

**可见性**:
- 非频道正式成员仅返回 `channel_only_visible=0` 的内容
- 频道正式成员可见该频道全部过审内容（含仅频道内可见）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "content": [
      {
        "type": "video",
        "vid": 789,
        "uid": 456,
        "title": "视频标题",
        "cover_url": "https://example.com/cover.jpg",
        "view_count": 1000,
        "like_count": 50,
        "created_at": "2024-01-15 12:00:00"
      },
      {
        "type": "blog",
        "bid": 101,
        "uid": 456,
        "title": "动态标题",
        "thumbnails": ["https://example.com/thumb.jpg"],
        "view_count": 500,
        "like_count": 20,
        "created_at": "2024-01-14 10:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`） / 无效分区（`invalid_section`）
- `500`: 系统错误

---

### 14. 添加内容到频道

**请求**: `POST /api/channel/{channel_id}/content`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `type` (string, 必需): 内容类型（`video`-视频，`blog`-动态）
- `content_id` (int, 必需): 内容ID（视频vid或动态bid）
- `channel_section_id` (int, 可选): 二级分区ID（必须是该频道下的有效分区，或0表示不属于任何二级分区），不提供则默认为0
- `channel_only_visible` (int, 可选): `0`=站外可见（默认），`1`=仅频道内可见

**权限要求**:
- 必须是频道成员
- 必须是内容的所有者
- 内容须已过审（`audit_status=1`）

**说明**:
- 可将内容从其他频道转入本频道（原频道置顶会自动取消）
- 内容**已在该频道**时，本接口用于更新 `channel_section_id` / `channel_only_visible`（返回 `200`）
- 未传 `channel_section_id` 时二级分区置 `0`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "channel_section_id": 1,
    "type": "video",
    "content_id": 789,
    "message": "内容已添加到频道"
  }
}
```

**HTTP状态码**:
- `200`: 内容已在该频道，二级分区/可见性更新成功
- `201`: 从其他频道转入或首次加入成功
- `400`: 参数错误 / 资源不存在 / 无效分区 / 内容未过审（`content_not_approved`）
- `401`: 未登录或 Token 无效
- `403`: 非成员 / 非内容所有者
- `500`: 系统错误

---

### 15. 从频道移除内容

**请求**: `DELETE /api/channel/{channel_id}/content/{type}/{content_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**权限要求**: 
- 内容的所有者
- 或频道管理员/所有者

**成功响应**:
```json
{
  "status": "success",
  "message": "内容已从频道移除"
}
```

**说明**: 移除后内容的 `channel_id`、`channel_section_id` 置 `0`，`channel_only_visible` 重置为 `0`（回归站外可见）；若该内容曾置顶，同步取消置顶。

**HTTP状态码**:
- `200`: 移除成功
- `400`: 参数错误 / 资源不存在 / 内容不在频道中
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

## 内容置顶

动态与视频均可置顶；**共用 `sort_order`**（`0` 最靠前）。

**权限**：设置、取消、调整排序仅**频道所有者或管理员**可操作。

**数量限制**：每个频道最多 **50** 条置顶（动态与视频合计）。

**可见性**：查询置顶列表时，非频道正式成员不可见 `channel_only_visible=1` 的内容（与 `content` / `timeline` 一致）；已过审但已删除的内容不会出现在列表中；内容已不在该频道时置顶记录会自动清理。

### 15.1 查询置顶内容

**请求**: `GET /api/channel/{channel_id}/pins`

**请求参数** (Query):
- `token` (string, 可选): 用户 Token
- `type` (string, 可选): `all`（默认）、`video`、`blog`
- `order` (string, 可选): `ASC`（默认，按 `sort_order` 从小到大）或 `DESC`
- `page` (int, 可选): 页码，默认 1
- `limit` (int, 可选): 每页数量，默认 50，最大 100（频道置顶总数最多 50 条）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "pins": [
      {
        "pin_id": 1,
        "sort_order": 0,
        "type": "video",
        "content_id": 789,
        "vid": 789,
        "uid": 456,
        "title": "视频标题",
        "cover_url": "https://example.com/cover.jpg",
        "view_count": 1000,
        "like_count": 50,
        "created_at": "2024-01-15 12:00:00"
      },
      {
        "pin_id": 2,
        "sort_order": 1,
        "type": "blog",
        "content_id": 101,
        "bid": 101,
        "uid": 456,
        "title": "动态标题",
        "thumbnails": ["https://example.com/thumb.jpg"],
        "view_count": 500,
        "like_count": 20,
        "created_at": "2024-01-14 10:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 频道不存在（`resource_not_found`）
- `500`: 系统错误

---

### 15.2 设置置顶

**请求**: `POST /api/channel/{channel_id}/pins`

**请求参数** (Body):
- `token` (string, 必需): 用户 Token
- `type` (string, 必需): `video` 或 `blog`
- `content_id` (int, 必需): 视频 `vid` 或动态 `bid`

**权限要求**: 频道**所有者或管理员**

**说明**:
- 内容须属于该频道、已过审且未删除
- 每个频道最多 50 条置顶（动态与视频合计），超出返回 `pin_limit_reached`
- 新置顶默认追加到队尾（当前最大 `sort_order + 1`）
- 同一内容不可重复置顶（`already_pinned`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "pin_id": 1,
    "channel_id": 123,
    "type": "video",
    "content_id": 789,
    "sort_order": 0,
    "updated_at": "2024-01-15 12:00:00"
  }
}
```

**HTTP状态码**:
- `201`: 设置成功
- `400`: 参数错误 / 内容不存在或不在频道内（`resource_not_found`）/ 已达上限（`pin_limit_reached`）
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `409`: 已置顶（`already_pinned`）
- `500`: 系统错误

---

### 15.3 取消置顶

**请求**: `DELETE /api/channel/{channel_id}/pins/{type}/{content_id}`

**路径参数**:
- `type` (string, 必需): `video` 或 `blog`
- `content_id` (int, 必需): 视频 `vid` 或动态 `bid`

**请求参数** (Body):
- `token` (string, 必需): 用户 Token

**权限要求**: 频道**所有者或管理员**

**说明**: 取消后其余置顶项按 `sort_order` 重新紧密编号（0,1,2,…）

**成功响应**:
```json
{
  "status": "success",
  "message": "置顶已取消"
}
```

**HTTP状态码**:
- `200`: 取消成功
- `400`: 未置顶（`pin_not_found`）/ 参数错误
- `401`: 未登录或 Token 无效
- `403`: 权限不足
- `500`: 系统错误

---

### 15.4 调整置顶排序

**请求**: `PUT /api/channel/{channel_id}/pins/{type}/{content_id}/sort`

**路径参数**:
- `type` (string, 必需): `video` 或 `blog`
- `content_id` (int, 必需): 视频 `vid` 或动态 `bid`

**请求参数** (Body):
- `token` (string, 必需): 用户 Token
- `sort_order` (int, 必需): 目标位置，从 `0` 开始；动态与视频共用排序

**权限要求**: 频道**所有者或管理员**

**说明**: 传入目标 `sort_order` 后，系统将该置顶项插入对应位置，并重排频道内全部置顶项为 0,1,2,…

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "pin_id": 2,
    "channel_id": 123,
    "type": "blog",
    "content_id": 101,
    "sort_order": 0,
    "updated_at": "2024-01-15 12:30:00"
  }
}
```

**HTTP状态码**:
- `200`: 调整成功
- `400`: 未置顶（`pin_not_found`）/ 缺少 `sort_order`
- `401`: 未登录或 Token 无效
- `403`: 权限不足
- `500`: 系统错误

---

## 关注管理

### 16. 关注频道

**请求**: `POST /api/channel/{channel_id}/follow`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "message": "已关注频道"
}
```

**HTTP状态码**:
- `201`: 关注成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录或 Token 无效
- `409`: 已关注（`already_following`）
- `500`: 系统错误

---

### 17. 取消关注频道

**请求**: `DELETE /api/channel/{channel_id}/follow`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "message": "已取消关注"
}
```

**HTTP状态码**:
- `200`: 取消关注成功
- `400`: 参数错误 / 资源不存在 / 未关注
- `401`: 未登录或 Token 无效
- `500`: 系统错误

---

### 18. 获取用户关注的频道列表

**请求**: `GET /api/channel/following`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channels": [
      {
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "cover_url": "https://example.com/cover.jpg",
        "member_count": 50,
        "follower_count": 200,
        "followed_at": "2024-01-10 12:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `401`: 未登录（`Token required`）或 Token 无效
- `500`: 系统错误

---

## 查询接口

### 19. 获取频道统计信息

**请求**: `GET /api/channel/{channel_id}/stats`

**请求参数** (Query):
- `token` (string, 可选): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "member_count": 50,
    "follower_count": 200,
    "video_count": 100,
    "blog_count": 50,
    "total_content_count": 150,
    "today_content_count": 5,
    "week_content_count": 20,
    "month_content_count": 50
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 20. 获取用户的操作历史

**请求**: `GET /api/channel/{channel_id}/history`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `uid` (int, 可选): 用户ID（管理员可查询其他用户，默认查询自己）
- `operation_type` (int, 可选): 操作类型筛选（0-申请加入，1-审批通过，2-审批拒绝，3-主动退出，4-被踢出，5-角色变更）
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**权限要求**: 只能查询自己的历史，管理员可查询频道内所有用户的历史

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "history": [
      {
        "log_id": 1,
        "operation_type": 0,
        "operation_name": "申请加入",
        "operator_uid": null,
        "operator_name": "自己",
        "old_status": null,
        "new_status": 0,
        "old_role": null,
        "new_role": 0,
        "reason": null,
        "created_at": "2024-01-01 12:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录（`Token required`）或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 21. 获取用户加入的频道列表

**请求**: `GET /api/channel/my/channels`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100
- `role` (int, 可选): 角色筛选（0-普通成员，1-管理员，2-所有者）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channels": [
      {
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "cover_url": "https://example.com/cover.jpg",
        "role": 0,
        "status": 1,
        "joined_at": "2024-01-01 13:00:00",
        "member_count": 50,
        "follower_count": 200
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `401`: 未登录（`Token required`）或 Token 无效
- `500`: 系统错误

---

### 22. 搜索频道

**请求**: `GET /api/channel/search`

**请求参数** (Query):

**必需参数**:
- `keyword` (string, 条件必需): 搜索关键词，将在频道名、频道标题、描述中搜索；当提供 `owner_uid` 或 `creator_uid` 时可省略，用于按用户精确列出频道

**分页参数** (二选一):
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 每页数量，默认20，最大100
- 或使用 `page` (int, 可选): 页码，默认1（会自动转换为offset）
- 或使用 `limit` (int, 可选): 每页数量，默认20，最大100（会自动转换为num）

**排序参数** (0或1，表示是否按该字段降序):
- `channel_id_desc` (int, 可选): 按频道ID降序（最新优先），默认0
- `member_count_desc` (int, 可选): 按成员数降序（热门优先），默认0
- `follower_count_desc` (int, 可选): 按关注数降序，默认0
- `created_at_desc` (int, 可选): 按创建时间降序，默认0

**筛选参数**:
- `creator_uid` (int, 可选): 按创建者用户ID筛选
- `owner_uid` (int, 可选): 按所有者用户ID筛选
- `join_permission` (int, 可选): 按加入权限筛选（0-任何人可加入，1-需要申请审核，2-不允许申请）
- `min_member_count` (int, 可选): 最小成员数
- `max_member_count` (int, 可选): 最大成员数
- `min_follower_count` (int, 可选): 最小关注数
- `max_follower_count` (int, 可选): 最大关注数

**其他参数**:
- `token` (string, 可选): 用户Token，如果提供，会在结果中返回用户与频道的关系（是否关注、是否是成员、角色等）

**排序逻辑说明**:
- 若省略 `keyword` 且仅按 `owner_uid` / `creator_uid` 筛选，默认按 `created_at` 降序
- 若只有一个排序参数为1，则按该字段排序
- 如果多个排序参数为1，则按优先级组合排序：成员数 > 关注数 > 创建时间 > 频道ID
- 如果所有排序参数都为0，则使用相似度排序（频道名匹配 > 频道标题匹配 > 描述匹配），相同相似度按关注数、成员数、频道ID排序

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channels": [
      {
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "description": "技术讨论和分享",
        "cover_url": "https://example.com/cover.jpg",
        "creator_uid": 456,
        "creator_username": "techmaster",
        "owner_uid": 456,
        "join_permission": 0,
        "member_count": 50,
        "follower_count": 200,
        "created_at": "2024-01-01 12:00:00",
        "is_following": false,
        "is_member": false,
        "user_role": null
      }
    ],
    "total_count": 10,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "total_pages": 1,
      "offset": 0
    }
  }
}
```

**HTTP状态码**:
- `200`: 搜索成功
- `400`: 参数错误（`missing_argument` / `error_type` / `too_big_num`）
- `500`: 系统错误

---

## 黑名单管理

### 23. 拉黑用户

**请求**: `POST /api/channel/{channel_id}/blacklist`

**请求参数** (Body):
- `token` (string, 必需): 管理员Token
- `uid` (int, 必需): 被拉黑的用户ID
- `reason` (string, 可选): 拉黑原因

**权限要求**: 管理员或所有者

**限制说明**:
- 只能对不在这个频道的用户或者频道内的普通成员使用
- 不能拉黑所有者
- 不能拉黑管理员，必须先通过"设置成员角色"接口将其角色改为普通成员后才能拉黑
- 如果拉黑的是频道内的普通成员，会自动移除其成员身份

**成功响应**:
```json
{
  "status": "success",
  "message": "用户已拉黑"
}
```

**HTTP状态码**:
- `201`: 拉黑成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录或 Token 无效
- `403`: 权限不足 / 不可拉黑所有者或管理员
- `409`: 已在黑名单（`already_blacklisted`）
- `500`: 系统错误

---

### 24. 解除拉黑

**请求**: `DELETE /api/channel/{channel_id}/blacklist/{uid}`

**请求参数** (Body):
- `token` (string, 必需): 管理员Token

**权限要求**: 管理员或所有者

**成功响应**:
```json
{
  "status": "success",
  "message": "已解除拉黑"
}
```

**HTTP状态码**:
- `200`: 解除成功
- `400`: 参数错误 / 资源不存在 / 不在黑名单
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 25. 获取黑名单列表

**请求**: `GET /api/channel/{channel_id}/blacklist`

**请求参数** (Query):
- `token` (string, 必需): 管理员Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**权限要求**: 管理员或所有者

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "blacklist": [
      {
        "uid": 999,
        "username": "违规用户",
        "avatar_url": "https://example.com/avatar.jpg",
        "reason": "发布违规内容",
        "operator_uid": 789,
        "operator_name": "管理员A",
        "blacklisted_at": "2024-01-10 10:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `401`: 未登录（`Token required`）或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

## 二级分区管理

### 26. 获取频道二级分区列表

**请求**: `GET /api/channel/{channel_id}/sections`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（如果提供且是频道所有者，可以查看已删除的分区）
- `include_deleted` (boolean, 可选): 是否包含已删除的分区（`true`或`1`），默认`false`（仅所有者可用）

**权限说明**:
- 任何人都可以查看未删除的分区列表
- 只有频道所有者可以查看已删除的分区（需要提供token且`include_deleted=true`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "sections": [
      {
        "channel_section_id": 1,
        "channel_id": 123,
        "section_name": "技术教程",
        "description": "技术相关的教程和指南",
        "icon_url": "https://example.com/icon.jpg",
        "sort_order": 1,
        "creator_uid": 456,
        "created_at": "2024-01-15 12:00:00",
        "updated_at": "2024-01-15 13:00:00",
        "is_deleted": 0,
        "content_count": {
          "video_count": 25,
          "blog_count": 10,
          "total_count": 35
        }
      }
    ],
    "total_count": 2
  }
}
```

**注意**:
- 分区按 `sort_order` 升序排序，相同 `sort_order` 按 `channel_section_id` 升序排序
- `content_count` 统计的是该分区下已审核通过且未删除的视频和动态数量

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 27. 获取二级分区详情

**请求**: `GET /api/channel/{channel_id}/sections/{section_id}`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（如果提供且是频道所有者，可以查看已删除的分区详情）

**权限说明**:
- 任何人都可以查看未删除的分区详情
- 只有频道所有者可以查看已删除的分区详情（需要提供token）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_section_id": 1,
    "channel_id": 123,
    "section_name": "技术教程",
    "description": "技术相关的教程和指南",
    "icon_url": "https://example.com/icon.jpg",
    "sort_order": 1,
    "creator_uid": 456,
    "created_at": "2024-01-15 12:00:00",
    "updated_at": "2024-01-15 13:00:00",
    "is_deleted": 0,
    "content_count": {
      "video_count": 25,
      "blog_count": 10,
      "total_count": 35
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 28. 获取二级分区内容统计

**请求**: `GET /api/channel/{channel_id}/sections/{section_id}/stats`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（如果提供且是所有者/管理员，可以查看待审核内容数量）

**权限说明**:
- 任何人都可以查看已审核通过的内容统计
- 只有频道所有者和管理员可以查看待审核内容数量（需要提供token）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_section_id": 1,
    "channel_id": 123,
    "section_name": "技术教程",
    "video": {
      "approved_count": 25,
      "pending_count": 3,
      "total_views": 15000,
      "total_likes": 500
    },
    "blog": {
      "approved_count": 10,
      "pending_count": 2,
      "total_views": 5000,
      "total_likes": 200
    },
    "total": {
      "approved_count": 35,
      "pending_count": 5,
      "total_views": 20000,
      "total_likes": 700
    }
  }
}
```

**字段说明**:
- `video.approved_count`: 已审核通过且未删除的视频数量
- `video.pending_count`: 待审核的视频数量（仅所有者/管理员可见，普通用户为0）
- `video.total_views`: 所有已审核通过视频的总浏览量
- `video.total_likes`: 所有已审核通过视频的总点赞数
- `blog.approved_count`: 已审核通过且未删除的动态数量
- `blog.pending_count`: 待审核的动态数量（仅所有者/管理员可见，普通用户为0）
- `blog.total_views`: 所有已审核通过动态的总浏览量
- `blog.total_likes`: 所有已审核通过动态的总点赞数
- `total.*`: 视频和动态的汇总统计

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

### 29. 创建二级分区

**请求**: `POST /api/channel/{channel_id}/sections`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `section_name` (string, 必需): 分区名称（1-50个字符，创建后不可修改）
- `description` (string, 可选): 分区描述（0-500字，可以为空）
- `icon_url` (string, 可选): 分区图标URL
- `sort_order` (int, 可选): **此参数将被忽略**，系统会自动计算排序值

**权限要求**: 仅频道所有者

**限制说明**:
- 同一频道内不能重复创建同名分区（不区分大小写）
- 一个频道最多50个二级分区
- 一周内不能创建超过50次（不管有没有被删掉）

**排序规则**:
- 所有分区的 `sort_order` 始终从 0 开始，紧密排列（0, 1, 2, 3...）
- 创建新分区时，`sort_order` 自动设置为当前最大 `sort_order + 1`（只统计未删除的分区）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_section_id": 1,
    "channel_id": 123,
    "section_name": "技术教程",
    "description": "技术相关的教程和指南",
    "icon_url": "https://example.com/icon.jpg",
    "sort_order": 1,
    "creator_uid": 456,
    "created_at": "2024-01-15 12:00:00"
  }
}
```

**HTTP状态码**:
- `200`: 创建成功
- `400`: 参数错误 / 资源不存在 / 名称长度等
- `401`: 未登录或 Token 无效
- `403`: 权限不足 / 分区数量超限
- `409`: 分区名已存在（`section_name_exists`）
- `500`: 系统错误

---

### 30. 修改二级分区信息

**请求**: `PUT /api/channel/{channel_id}/sections/{section_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `description` (string, 可选): 分区描述（0-500字，可以为空，传空字符串表示清空描述）
- `icon_url` (string, 可选): 分区图标URL（传空字符串表示清空图标）
- `sort_order` (int, 可选): 目标排序位置（0开始）

**权限要求**: 仅频道所有者

**限制说明**:
- `section_name` 不可修改（如果传入会被忽略）
- 只能修改 `description`、`icon_url` 和 `sort_order` 字段

**排序规则**:
- 所有分区的 `sort_order` 始终从 0 开始，紧密排列（0, 1, 2, 3...）
- `sort_order` 参数必须 >= 0，如果传入负数会自动设为 0
- 如果 `sort_order` > 当前最大 `sort_order`，则设置为最大 `sort_order + 1`
- 如果 `sort_order` <= 某个现有 `sort_order`，系统会重新排序所有未删除的分区，确保紧密排列

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_section_id": 1,
    "channel_id": 123,
    "section_name": "技术教程",
    "description": "更新后的描述",
    "icon_url": "https://example.com/new_icon.jpg",
    "sort_order": 2,
    "updated_at": "2024-01-15 13:00:00"
  }
}
```

**HTTP状态码**:
- `200`: 修改成功
- `400`: 参数错误 / 资源不存在 / 分区已删除
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 31. 删除二级分区

**请求**: `DELETE /api/channel/{channel_id}/sections/{section_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `transfer_to_section_id` (int, 可选): 将分区下的内容转移到指定的二级分区ID（必须是同一频道下的有效分区），如果不提供或为0，则内容回归无二级分区状态（channel_section_id=0）

**权限要求**: 仅频道所有者

**限制说明**:
- 删除后分区不可见，历史数据保留
- 如果指定 `transfer_to_section_id`，必须确保该分区存在且属于同一频道且未被删除
- 如果 `transfer_to_section_id=0` 或不提供，该分区下的所有内容的 `channel_section_id` 将被设置为0

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_section_id": 1,
    "channel_id": 123,
    "section_name": "技术教程",
    "transferred_content_count": 25,
    "transfer_to_section_id": 2,
    "message": "分区已删除，内容已转移"
  }
}
```

**HTTP状态码**:
- `200`: 删除成功
- `400`: 参数错误 / 资源不存在 / 无效转移分区
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 32. 更改内容所属的二级分区

**请求**: `PUT /api/channel/{channel_id}/content/{type}/{content_id}/section`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `channel_section_id` (int, 必需): 目标二级分区ID（必须是同一频道下的有效分区，或0表示不属于任何二级分区）

**权限要求**: 
- 内容的所有者
- 或频道管理员/所有者

**限制说明**:
- `type` 必须是 `video` 或 `blog`
- `content_id` 必须是有效的视频vid或动态bid
- 内容必须属于该频道
- `channel_section_id` 必须是0（无分区）或该频道下的有效二级分区ID

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "channel_id": 123,
    "type": "video",
    "content_id": 789,
    "old_section_id": 1,
    "new_section_id": 2,
    "message": "内容所属分区已更新"
  }
}
```

**HTTP状态码**:
- `200`: 更新成功
- `400`: 参数错误 / 资源不存在 / 内容不在频道 / 无效分区
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 33. 发送删除频道验证码

**请求**: `POST /api/channel/{channel_id}/delete_verification_code`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**权限要求**: 仅频道所有者

**行为说明**:
- 系统会向频道所有者绑定的邮箱发送 6 位数字验证码，用于后续执行删除频道等高风险操作时进行二次确认
- 验证码有时效，删除频道时需校验
- 具有发送频率限制

**限制说明**:
- 频道必须存在且未被删除，否则返回 `resource_not_found`
- 当前用户必须是频道所有者，否则返回 `permission_denied`
- 如果邮箱不存在或为空，返回 `email_unexist`
- 同一账号发送邮件频率过高时会返回 `too_many_requests`

**成功响应**:
```json
{
  "status": "success"
}
```

**HTTP状态码**:
- `200`: 发送成功
- `400`: 参数错误 / 资源不存在 / 邮箱未绑定
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `429`: 发送过于频繁（`too_many_requests`）
- `500`: 系统错误

---

### 34. 发送频道所有权转让验证码

**请求**: `POST /api/channel/{channel_id}/transfer_verification_code`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**权限要求**: 仅频道所有者

**行为说明**:
- 系统会向频道所有者绑定的邮箱发送 6 位数字验证码，用于后续执行频道所有权转让操作时进行二次确认
- 验证码有时效，设置所有者时需校验
- 具有发送频率限制

**限制说明**:
- 频道必须存在且未被删除，否则返回 `resource_not_found`
- 当前用户必须是频道所有者，否则返回 `permission_denied`
- 如果邮箱不存在或为空，返回 `email_unexist`
- 同一账号发送邮件频率过高时会返回 `too_many_requests`

**成功响应**:
```json
{
  "status": "success"
}
```

**HTTP状态码**:
- `200`: 发送成功
- `400`: 参数错误 / 资源不存在 / 邮箱未绑定
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `429`: 发送过于频繁（`too_many_requests`）
- `500`: 系统错误

---

### 35. 获取订阅频道内容时间线

**请求**: `GET /api/channel/following/timeline`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**说明**:
- 返回当前用户已关注（订阅）的所有频道内的视频和动态内容，按发布时间从新到旧混合排序
- 每条内容都包含所属频道的基础信息，方便前端在同一时间线中区分不同频道的来源
- 单条内容的数据结构与 `following_all_timeline` 接口保持一致，并额外附加频道信息字段
- 非对应频道正式成员时，各频道条目仅含 `channel_only_visible=0` 的内容；成员可见含仅频道内可见的全部过审内容

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "timeline": [
      {
        "content_type": "video",
        "vid": 789,
        "uid": 456,
        "title": "视频标题",
        "time": "2024-01-15 12:00:00",
        "like_count": 50,
        "favorite_count": 10,
        "view_count": 1000,
        "cover_url": "https://example.com/cover.jpg",
        "username": "作者昵称",
        "avatar_url": "https://example.com/avatar.jpg",
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "channel_description": "技术讨论和分享",
        "channel_cover_url": "https://example.com/channel_cover.jpg"
      },
      {
        "content_type": "blog",
        "bid": 101,
        "uid": 456,
        "title": "动态标题",
        "content": "动态内容",
        "time": "2024-01-14 10:00:00",
        "like_count": 20,
        "favorite_count": 5,
        "view_count": 500,
        "username": "作者昵称",
        "avatar_url": "https://example.com/avatar.jpg",
        "thumbnails": ["https://example.com/thumb.jpg"],
        "channel_id": 123,
        "channel_name": "techhub",
        "channel_title": "技术交流社区",
        "channel_description": "技术讨论和分享",
        "channel_cover_url": "https://example.com/channel_cover.jpg"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `401`: 未登录（`Token required`）或 Token 无效
- `500`: 系统错误

---

### 36. 获取单个频道内容时间线

**请求**: `GET /api/channel/{channel_id}/timeline`

**请求参数** (Query):
- `token` (string, 可选): 用户Token
- `page` (int, 可选): 页码，默认1
- `limit` (int, 可选): 每页数量，默认20，最大100

**说明**:
- 返回指定频道内的视频和动态内容，按发布时间从新到旧混合排序
- 单条内容的数据结构与 `following_user_timeline` 接口保持一致（不额外附带频道信息字段）
- 非频道正式成员仅见 `channel_only_visible=0` 的内容；成员可见含仅频道内可见的全部过审内容

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "timeline": [
      {
        "content_type": "video",
        "vid": 789,
        "uid": 456,
        "title": "视频标题",
        "time": "2024-01-15 12:00:00",
        "like_count": 50,
        "favorite_count": 10,
        "view_count": 1000,
        "cover_url": "https://example.com/cover.jpg",
        "username": "作者昵称",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      {
        "content_type": "blog",
        "bid": 101,
        "uid": 456,
        "title": "动态标题",
        "content": "动态内容",
        "time": "2024-01-14 10:00:00",
        "like_count": 20,
        "favorite_count": 5,
        "view_count": 500,
        "username": "作者昵称",
        "avatar_url": "https://example.com/avatar.jpg",
        "thumbnails": ["https://example.com/thumb.jpg"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

---

## 角色说明

- **普通成员** (role=0): 可以查看频道内容、发布内容到频道
- **管理员** (role=1): 拥有普通成员的所有权限，还可以审批申请、踢出成员、管理黑名单
- **所有者** (role=2): 拥有管理员的所有权限，还可以修改频道信息、删除频道、设置成员角色、管理二级分区

## 状态说明

- **成员状态**:
  - `status=0`: 待审核（已申请，等待管理员审批）
  - `status=1`: 已加入（正常成员状态）
  - `status=2`: 已拒绝（管理员拒绝了申请）

- **加入权限**:
  - `join_permission=0`: 任何人可加入（无需审批）
  - `join_permission=1`: 需要申请审核
  - `join_permission=2`: 不允许申请

- **免加入投稿** (`open_post`):
  - `open_post=0`: 投稿须为频道正式成员（`join_permission=0` 时投稿会自动加入并关注）
  - `open_post=1`: 登录用户无需加入即可投稿；加入/关注仍为可选；黑名单用户不可投稿；仅频道内可见内容的浏览规则不变

---

## 公告管理

### 37. 创建频道公告

**请求**: `POST /api/channel/{channel_id}/notices`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `title` (string, 可选): 公告标题（0-100字符，可以为空）
- `content` (string, 必需): 公告内容（1-2000字符）

**权限要求**: 仅频道所有者

**限制说明**:
- 每个频道每天最多创建 5 条公告（包括已经删除的公告也计入次数）
- 删除后公告不可见

**排序规则**:
- 公告的 `sort_order` 始终从 0 开始递增，表示从最早到最新
- 创建新公告时，`sort_order` 自动设置为当前频道下未删除公告的最大值 + 1

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "notice_id": 1,
    "channel_id": 123,
    "title": "维护公告",
    "content": "本频道将于今晚进行维护。",
    "sort_order": 3,
    "creator_uid": 456,
    "created_at": "2024-01-15 20:00:00"
  }
}
```

**错误码补充**:
- `too_many_notices_today`: 当天创建公告次数已达上限
- `title_too_long`: 标题长度超过限制
- `content_too_long`: 内容长度超过限制

**HTTP状态码**:
- `200`: 创建成功
- `400`: 参数错误 / 资源不存在 / 标题或内容超长 / 当日次数超限
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 38. 删除频道公告

**请求**: `DELETE /api/channel/{channel_id}/notices/{notice_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**权限要求**: 仅频道所有者

**行为说明**:
- 删除后公告不可见
- 删除后会对该频道下所有未删除公告的 `sort_order` 重新编号，保持从 0 开始紧密排列（0, 1, 2...）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "notice_id": 1,
    "channel_id": 123,
    "title": "维护公告",
    "message": "notice_deleted"
  }
}
```

**错误码补充**:
- `notice_deleted`: 公告已处于删除状态

**HTTP状态码**:
- `200`: 删除成功
- `400`: 参数错误 / 资源不存在 / 公告已删除
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 39. 调整公告排序

**请求**: `PUT /api/channel/{channel_id}/notices/{notice_id}/sort`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `sort_order` (int, 必需): 目标排序位置（从 0 开始）

**权限要求**: 仅频道所有者

**排序规则**:
- 目标 `sort_order` 小于 0 时会自动调整为 0
- 如果 `sort_order` 大于当前未删除公告数量，则会被调整到最后一个位置
- 系统会将该公告插入到目标位置，并对该频道下所有未删除公告的 `sort_order` 重新编号，保证从 0 开始紧密排列

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "notice_id": 1,
    "channel_id": 123,
    "sort_order": 0,
    "updated_at": "2024-01-15 21:00:00"
  }
}
```

**错误码补充**:
- `notice_deleted`: 公告已处于删除状态

**HTTP状态码**:
- `200`: 调整成功
- `400`: 参数错误 / 资源不存在 / 公告已删除
- `401`: 未登录或 Token 无效
- `403`: 权限不足（`permission_denied`）
- `500`: 系统错误

---

### 40. 获取频道公告列表

**请求**: `GET /api/channel/{channel_id}/notices`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（如果提供且是频道所有者，可以查看已删除的公告）
- `include_deleted` (boolean, 可选): 是否包含已删除的公告（`true` 或 `1`），默认 `false`（仅频道所有者可用）

**权限说明**:
- 任何人都可以查看频道未删除的公告列表
- 只有频道所有者在提供 `token` 且 `include_deleted=true` 时可以查看已删除公告

**排序说明**:
- 公告按 `sort_order` 升序排序（0 为最早，数值越大越新）
- 前端如果需要“最新在最前面”的效果，可以按 `sort_order` 倒序展示

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "notices": [
      {
        "notice_id": 1,
        "channel_id": 123,
        "title": "维护公告",
        "content": "本频道将于今晚进行维护。",
        "sort_order": 0,
        "creator_uid": 456,
        "created_at": "2024-01-10 20:00:00",
        "updated_at": "2024-01-10 20:00:00",
        "is_deleted": 0
      }
    ],
    "total_count": 1
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误 / 资源不存在（`resource_not_found`）
- `500`: 系统错误

