# Comment 评论模块 API 文档

## 概述

评论模块提供动态评论、视频评论、静画评论的查询、发表、删除、置顶等功能。

**基础信息**:
- **基础路径**: `/api/comment`
- **请求格式**: 查询参数（GET）或 JSON 请求体（POST / DELETE）
- **响应格式**: JSON
- **认证方式**: 列表接口 `token` 可选；发表、删除、置顶接口需登录
- **字符编码**: UTF-8

## 相关模块说明

以下接口请使用 moderation 模块，详见 `moderation_api.md`：

| 功能 | 新接口 |
|------|--------|
| 审核动态评论列表 | `GET /api/moderation/blog-comments` |
| 审核视频评论列表 | `GET /api/moderation/video-comments` |
| 通过/驳回动态评论 | `PUT /api/moderation/blog-comments/{bcid}/approve` / `reject` |
| 通过/驳回视频评论 | `PUT /api/moderation/video-comments/{vcid}/approve` / `reject` |
| 举报动态评论 | `POST /api/moderation/blog-comments/{bcid}/report` |
| 审核静画评论列表 | `GET /api/moderation/seiga-comments` |
| 通过/驳回静画评论 | `PUT /api/moderation/seiga-comments/{scid}/approve` / `reject` |
| 举报静画评论 | `POST /api/moderation/seiga-comments/{scid}/report` |
| 举报视频评论 | `POST /api/moderation/video-comments/{vcid}/report` |

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
- `error_bid`: 动态 ID 无效
- `error_vid`: 视频 ID 无效
- `error_sid`: 静画作品 ID 无效或不可见
- `error_bcid`: 动态评论 ID 无效
- `error_vcid`: 视频评论 ID 无效
- `error_parent_bcid`: 父动态评论无效
- `error_parent_vcid`: 父视频评论无效
- `error_scid`: 静画评论 ID 无效
- `error_parent_scid`: 父静画评论无效
- `error_parent`: 不支持楼中楼中楼（仅支持两级评论）
- `content_too_long`: 评论内容超过 459 字
- `content_too_short`: 评论内容为空
- `too_big_num`: 请求数量过大（列表最大 12）
- `too_many_requests`: 请求频率过高
- `warn`: 触发敏感词（评论进入审核）
- `blocked`: 存在拉黑关系
- `no_permission`: 无权限
- `already_pinned`: 该评论已置顶
- `pin_not_found`: 该评论未置顶
- `pin_limit_reached`: 置顶数量已达上限（同一动态/视频最多 10 条）
- `not_root_comment`: 仅允许置顶根评论
- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 请求成功 | — |
| `400` | 参数或业务校验错误 | `missing_argument`、`error_bid` 等 |
| `401` | 未登录或 Token 无效 | `error_token` |
| `403` | 无权限或拉黑 | `no_permission`、`blocked` |
| `404` | 接口路径不存在 | `Not found` |
| `405` | HTTP 方法不允许 | `Method not allowed` |
| `409` | 资源冲突 | `already_pinned` |
| `429` | 请求过于频繁 | `too_many_requests` |
| `500` | 服务器内部错误 | `system_error` |

---

## 父内容可见性

评论读写须先通过父内容的可见性校验：

- **动态 / 视频**：规则同 Blog/Video 详情（见各模块「仅频道内可见」）
- **静画**：父作品须已过审且未删除；`is_gore=1` 时须作者本人、审核员，或评论者已开启猎奇内容可见

通用规则：

- 父内容已删除，或父内容未过审且当前用户非作者：列表与发表均返回 `error_bid` / `error_vid` / `error_sid`
- 拉取子评论（`parent_bcid` / `parent_vcid` / `parent_scid` > 0）时，父评论须未删除且已过审（`audit_status=1`），否则 `error_parent_bcid` / `error_parent_vcid` / `error_parent_scid`

---

## 评论列表通用说明

动态 / 视频 / 静画评论均为**两级树**：`parent_* = 0` 为根评论，仅可回复根评论（不支持楼中楼中楼）。

动态 / 视频根评论支持置顶。根评论列表 `include_pinned` 参数：

- 不传或 `1`（默认）：返回全部评论，置顶项排在前面（`pin_order` 升序），其余按评论 ID 排序
- `0`：仅返回未置顶评论，按评论 ID 排序分页（用于避免置顶项参与普通分页）

**置顶权限与范围**：

- **谁可以操作**：仅动态/视频的**作者本人**（置顶、取消置顶、调整排序）
- **哪些评论可置顶**：仅**根评论**（`parent_* = 0`）；子评论不可置顶，列表中 `is_pinned` 恒为 `0`

静画评论暂不支持置顶。

**置顶排序规则**（与合集 `collection_sort_order` 一致）：

- 同一动态/视频下，已置顶评论的 `pin_order` 互斥、从 `0` 起紧密排列（`0,1,2,…`），不重复、不留空档
- 新置顶默认追加到队尾，随后系统全量重排
- 取消置顶或删除置顶评论后：该评论 `is_pinned=0`、`pin_order=0`（恢复默认），其余置顶项自动重排

**列表项字段**（三种类型 ID 字段名不同，其余对齐）：

| 字段 | 说明 |
|------|------|
| `bcid` / `vcid` / `scid` | 评论 ID |
| `parent_bcid` / `parent_vcid` / `parent_scid` | 父评论 ID；根评论为 `0` |
| `uid` | 评论者 UID |
| `content` | 评论正文 |
| `time` | 发表时间 |
| `is_pinned` | 是否置顶：`1` 是，`0` 否（子评论恒为 `0`） |
| `pin_order` | 置顶排序：`0` 最靠前。同一动态/视频下**已置顶**评论的 `pin_order` 互斥且从 `0` 起连续编号（`0,1,2,…`）；**未置顶**时固定为 `0` |
| `child_comment_num` | **直接回复数**：该条评论下已过审且未删的子评论数量；根评论列表中展示「回复数」用此字段；子评论列表中恒为 `0` |
| `if_my_comment` | 是否当前登录用户发表：`1` 是，`0` 否（未登录恒为 `0`） |
| `username` | 评论者昵称 |
| `honour` | 评论者荣誉 |
| `avatar_url` | 评论者头像 URL |

**静画列表额外字段**（`data` 层，视频/动态无）：

| 字段 | 说明 |
|------|------|
| `total_count` | 当前 `sid` + `parent_scid` 下已过审且未删的评论总数，用于分页 |

---

## 动态评论

### 1. 动态评论列表

**请求**: `GET /api/comment/blogs/{bid}?parent_bcid={parent_bcid}&offset={offset}&num={num}&cid_asc={cid_asc}&include_pinned={include_pinned}&token={token}`

**路径参数**:
- `bid` (int, 必需): 动态 ID

**请求参数** (Query):
- `parent_bcid` (int, 必需): 父评论 ID，顶级评论传 `0`
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 12
- `cid_asc` (int, 可选): 是否按评论 ID 升序，`1` 升序，`0` 或不传为降序；未置顶评论按此排序；置顶评论始终按 `pin_order` 升序排在前面
- `include_pinned` (int, 可选): 根评论（`parent_bcid=0`）时：`0` 仅返回未置顶评论；不传或 `1` 返回全部（置顶在前）。子评论列表忽略该字段
- `token` (string, 可选): 登录 token，用于判断 `if_my_comment`

**说明**:
- 须通过父动态可见性校验（见「父内容可见性」）；父动态不可见时返回 `error_bid`
- 需要分页加载普通评论且排除置顶时，传 `include_pinned=0`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "bcid": 1001,
        "parent_bcid": 0,
        "uid": 23,
        "content": "评论内容",
        "time": "2026-04-18 12:00:00",
        "is_pinned": 0,
        "pin_order": 0,
        "child_comment_num": 3,
        "if_my_comment": 1,
        "username": "昵称",
        "honour": "荣誉",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**响应字段说明**:
- `comment_list`：当前页评论列表；列表项字段见「评论列表通用说明」

**HTTP 状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `500`: 系统错误

---

### 2. 发表动态评论

**请求**: `POST /api/comment/blogs/{bid}`

**路径参数**:
- `bid` (int, 必需): 动态 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `parent_bcid` (int, 必需): 父评论 ID，回复动态传 `0`，回复评论传父 `bcid`
- `content` (string, 必需): 评论内容，1-459 字；`\n` 表示换行

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "if_get_experience": 1,
    "if_warn": 0
  }
}
```

**响应字段说明**:
- `if_get_experience`: 是否获得经验值（当日经验已达上限时为 `0`）
- `if_warn`: 是否因敏感词进入审核，`1` 表示进入审核队列

**说明**:
- 5 秒内仅可发表一次评论
- 须通过父动态可见性校验（见「父内容可见性」）；回复评论时父评论须未删且已过审

**HTTP 状态码**:
- `200`: 发表成功
- `400`: 参数或内容校验错误
- `401`: Token 无效
- `403`: 存在拉黑关系（`blocked`）
- `429`: 评论过于频繁（`too_many_requests`）
- `500`: 系统错误

---

### 3. 删除动态评论

**请求**: `DELETE /api/comment/blog-comments/{bcid}`

**路径参数**:
- `bcid` (int, 必需): 动态评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**说明**: 仅评论作者本人可删除。

**HTTP 状态码**:
- `200`: 删除成功
- `400`: 评论不存在（`error_bcid`）
- `401`: Token 无效
- `403`: 非本人评论（`no_permission`）
- `500`: 系统错误

---

### 3.1 置顶动态评论

**请求**: `POST /api/comment/blog-comments/{bcid}/pin`

**路径参数**:
- `bcid` (int, 必需): 动态评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**权限要求**: 仅**动态作者**可将该动态下的根评论置顶。

**说明**:
- 仅可置顶已过审、未删除的根评论（`parent_bcid=0`）
- 同一动态最多 **10** 条置顶，超出返回 `pin_limit_reached`
- 新置顶默认追加到队尾，系统随即全量重排为 `0,1,2,…`
- 同一评论不可重复置顶（`already_pinned`）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "bcid": 1001,
    "bid": 88,
    "is_pinned": 1,
    "pin_order": 0
  }
}
```

**HTTP 状态码**:
- `201`: 置顶成功
- `400`: 评论不存在 / 非根评论（`not_root_comment`）/ 已达上限（`pin_limit_reached`）
- `401`: Token 无效
- `403`: 非动态作者（`no_permission`）
- `409`: 已置顶（`already_pinned`）
- `500`: 系统错误

---

### 3.2 取消置顶动态评论

**请求**: `DELETE /api/comment/blog-comments/{bcid}/pin`

**路径参数**:
- `bcid` (int, 必需): 动态评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**权限要求**: 仅**动态作者**

**说明**: 取消后该评论 `pin_order` 恢复为 `0`，其余置顶项按 `0,1,2,…` 重新紧密编号

**成功响应**:
```json
{
  "status": "success",
  "message": "置顶已取消"
}
```

**HTTP 状态码**:
- `200`: 取消成功
- `400`: 未置顶（`pin_not_found`）/ 评论不存在
- `401`: Token 无效
- `403`: 非动态作者（`no_permission`）
- `500`: 系统错误

---

### 3.3 调整动态评论置顶排序

**请求**: `PUT /api/comment/blog-comments/{bcid}/pin/sort`

**路径参数**:
- `bcid` (int, 必需): 动态评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `pin_order` (int, 必需): 目标位置，从 `0` 开始

**权限要求**: 仅**动态作者**

**说明**: 传入目标 `pin_order` 后，系统将该置顶项插入对应位置，并重排该动态下全部置顶评论为 0,1,2,…

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "bcid": 1001,
    "bid": 88,
    "is_pinned": 1,
    "pin_order": 0
  }
}
```

**HTTP 状态码**:
- `200`: 调整成功
- `400`: 未置顶（`pin_not_found`）/ 缺少 `pin_order`
- `401`: Token 无效
- `403`: 非动态作者（`no_permission`）
- `500`: 系统错误

---

## 视频评论

### 4. 视频评论列表

**请求**: `GET /api/comment/videos/{vid}?parent_vcid={parent_vcid}&offset={offset}&num={num}&cid_asc={cid_asc}&include_pinned={include_pinned}&token={token}`

**路径参数**:
- `vid` (int, 必需): 视频 ID

**请求参数** (Query):
- `parent_vcid` (int, 必需): 父评论 ID，顶级评论传 `0`
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 12
- `cid_asc` (int, 可选): 是否按评论 ID 升序；未置顶评论按此排序；置顶评论始终按 `pin_order` 升序排在前面
- `include_pinned` (int, 可选): 根评论（`parent_vcid=0`）时：`0` 仅返回未置顶评论；不传或 `1` 返回全部（置顶在前）。子评论列表忽略该字段
- `token` (string, 可选): 登录 token

**说明**:
- 须通过父视频可见性校验（见「父内容可见性」）；父视频不可见时返回 `error_vid`
- 需要分页加载普通评论且排除置顶时，传 `include_pinned=0`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "vcid": 2001,
        "parent_vcid": 0,
        "uid": 23,
        "content": "评论内容",
        "time": "2026-04-18 12:00:00",
        "is_pinned": 0,
        "pin_order": 0,
        "child_comment_num": 2,
        "if_my_comment": 0,
        "username": "昵称",
        "honour": "荣誉",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**响应字段说明**:
- `comment_list`：当前页评论列表；列表项字段见「评论列表通用说明」

**HTTP 状态码**: 同动态评论列表

---

### 5. 发表视频评论

**请求**: `POST /api/comment/videos/{vid}`

**路径参数**:
- `vid` (int, 必需): 视频 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `parent_vcid` (int, 必需): 父评论 ID，回复视频传 `0`
- `content` (string, 必需): 评论内容，1-459 字

**成功响应**: 同「发表动态评论」

**说明**: 须通过父视频可见性校验（见「父内容可见性」）；回复评论时父评论须未删且已过审。

**HTTP 状态码**: 同「发表动态评论」（`error_vid`、`error_parent_vcid` 等）

---

### 6. 删除视频评论

**请求**: `DELETE /api/comment/video-comments/{vcid}`

**路径参数**:
- `vcid` (int, 必需): 视频评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**HTTP 状态码**:
- `200`: 删除成功
- `400`: 评论不存在（`error_vcid`）
- `401`: Token 无效
- `403`: 非本人评论（`no_permission`）
- `500`: 系统错误

---

### 6.1 置顶视频评论

**请求**: `POST /api/comment/video-comments/{vcid}/pin`

**路径参数**:
- `vcid` (int, 必需): 视频评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**权限要求**: 仅**视频作者**可将该视频下的根评论置顶。

**说明**: 规则同「置顶动态评论」（同一视频最多 10 条；仅根评论；追加到队尾）。

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "vcid": 2001,
    "vid": 99,
    "is_pinned": 1,
    "pin_order": 0
  }
}
```

**HTTP 状态码**: 同「置顶动态评论」（`error_vcid` / `error_vid`）

---

### 6.2 取消置顶视频评论

**请求**: `DELETE /api/comment/video-comments/{vcid}/pin`

**路径参数**:
- `vcid` (int, 必需): 视频评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**权限要求**: 仅**视频作者**

**成功响应**: 同「取消置顶动态评论」

**HTTP 状态码**: 同「取消置顶动态评论」

---

### 6.3 调整视频评论置顶排序

**请求**: `PUT /api/comment/video-comments/{vcid}/pin/sort`

**路径参数**:
- `vcid` (int, 必需): 视频评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `pin_order` (int, 必需): 目标位置，从 `0` 开始

**权限要求**: 仅**视频作者**

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "vcid": 2001,
    "vid": 99,
    "is_pinned": 1,
    "pin_order": 0
  }
}
```

**HTTP 状态码**: 同「调整动态评论置顶排序」

---

## 静画评论

父作品须已过审且对评论者可见（含 `is_gore` 护栏）；树形两级：`parent_scid=0` 为根，仅可回复根评论。

### 7. 静画评论列表

**请求**: `GET /api/comment/seigas/{sid}?parent_scid={parent_scid}&offset={offset}&num={num}&cid_asc={cid_asc}&token={token}`

**路径参数**:
- `sid` (int, 必需): 静画作品 ID

**请求参数** (Query):
- `parent_scid` (int, 必需): 父评论 ID，顶级评论传 `0`；拉取某条根评论的回复时传该根评论的 `scid`
- `offset` (int, 必需): 偏移量
- `num` (int, 必需): 返回数量，最大 12
- `cid_asc` (int, 可选): 是否按评论 ID 升序，`1` 升序，`0` 或不传为降序
- `token` (string, 可选): 登录 token，用于判断 `if_my_comment`

**说明**: 须通过父静画可见性校验（见「父内容可见性」）；父作品不可见时返回 `error_sid`。列表项字段与视频评论对齐，另在 `data` 层返回 `total_count` 供分页。

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "comment_list": [
      {
        "scid": 1,
        "parent_scid": 0,
        "uid": 42,
        "content": "...",
        "time": "2026-08-12 12:00:00",
        "child_comment_num": 3,
        "if_my_comment": 0,
        "username": "user",
        "honour": "",
        "avatar_url": "https://..."
      }
    ],
    "total_count": 56
  }
}
```

**响应字段说明**:
- `comment_list`：当前页评论；字段含义见「评论列表通用说明」
- `child_comment_num`：该条评论下已过审且未删的直接回复数（根评论列表用于展示回复数；子评论恒为 `0`）
- `total_count`：同一 `sid` + `parent_scid` 下已过审且未删的评论总数（根评论传 `parent_scid=0`，子评论传对应根 `scid`）

**HTTP 状态码**: 同动态评论列表

---

### 8. 发表静画评论

**请求**: `POST /api/comment/seigas/{sid}`

**路径参数**:
- `sid` (int, 必需): 静画作品 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌
- `parent_scid` (int, 必需): 父评论 ID，回复作品传 `0`，回复根评论传父 `scid`
- `content` (string, 必需): 评论内容，1–459 字

**成功响应**: 同「发表动态评论」

**说明**:
- 5 秒内仅可发表一次评论
- 须通过父静画可见性校验；回复评论时父评论须未删且已过审
- 敏感词命中时 `audit_status=0` 待审，仍返回成功（`if_warn=1`）

**HTTP 状态码**: 同「发表动态评论」（`error_sid`、`error_parent_scid` 等）

---

### 9. 删除静画评论

**请求**: `DELETE /api/comment/seiga-comments/{scid}`

**路径参数**:
- `scid` (int, 必需): 静画评论 ID

**请求参数** (Body, JSON):
- `token` (string, 必需): 用户认证令牌

**说明**: 仅评论作者本人可删除已过审评论。

**HTTP 状态码**:
- `200`: 删除成功
- `400`: 评论不存在（`error_scid`）
- `401`: Token 无效
- `403`: 非本人评论（`no_permission`）
- `500`: 系统错误
