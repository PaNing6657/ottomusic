# Video 视频模块 API 文档

## 概述

视频模块提供视频的获取、搜索、收藏、点赞、删除、草稿投稿与 R2 更新等功能。旧轨表单投稿/修改（`submit`、`update`）已下线。大文件视频可走 R2 分片直传（与素材库 `presigned_multipart` 相同流程）。

**基础信息**:
- **基础路径**: `/api/video`
- **请求格式**: JSON（POST）或查询参数（GET）
- **响应格式**: JSON
- **认证方式**: 部分接口通过 `token` 参数传递（GET请求）或请求体（POST请求）
- **字符编码**: UTF-8

## 通用响应格式

**成功响应**:
```json
{
  "status": "success",
  "data": { ... }
}
```

**列表类接口**：视频列表统一使用嵌套格式，`data` 内包含 `video_list` 数组；若接口带总数或分页信息，则同时包含 `total_count`、`favorite_video_count`、`manage_video_count` 等字段。

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
- `system_error`: 系统错误
- `error_type`: 参数类型错误
- `error_uid`: 用户ID无效
- `error_vid`: 视频ID无效

## 列表与拉黑过滤

以下列表接口支持可选 Query 参数 `token`。传入**有效** token 时，响应中不会包含当前用户**已拉黑**作者发布的内容（单向过滤：仅「我拉黑的人」，不含「拉黑我的人」；与评论/私信中的双向拉黑校验不同）。

- 不传 `token` 或 token 无效：行为与旧版一致，仅应用全局既有过滤规则；**除本节列出的、本就要求登录的接口外**，无效 token 不会返回 `401`，视同未登录浏览。
- 拉黑关系来自 Block 模块。

**适用接口**：

| 接口 | 说明 |
|------|------|
| `GET /api/video/random` | 排除已拉黑作者的视频 |
| `GET /api/video/new` | 同上 |
| `GET /api/video/popular` | 同上 |
| `GET /api/video/recommend` | **须**有效 token；基于观看历史个性化推荐 |
| `GET /api/video/category/{category}` | 同上 |
| `GET /api/video/search` | 同上 |
| `GET /api/video/user/{uid}` | 若当前用户已拉黑该 `uid`，返回空 `video_list`（HTTP 200） |
| `GET /api/video/related/{vid}` | 排除已拉黑作者的视频 |
| `GET /api/video/favorite-list` | 已要求 token；收藏列表中亦排除已拉黑作者的视频 |
| `GET /api/video/history-list` | 已要求 token；历史列表中亦排除已拉黑作者的视频 |

**建议**：客户端在已登录状态下调用上述公开列表时附带 `token`，以获得个性化拉黑过滤。

---

## 仅频道内可见（channel_only_visible）

内容字段 `channel_only_visible`：`0`=站外可见（默认），`1`=仅频道内可见。

**写入**：视频草稿、发布、 `update-r2`、频道添加内容等接口可传 `channel_only_visible`；`channel_id=0` 时强制为 `0`；设为 `1` 时须为对应频道正式成员（自由加入频道投稿时可自动加入并关注）。

**公共列表**（random、new、popular、recommend、category、search、user、related、history-list 等）：**始终**仅返回 `channel_only_visible=0` 的内容；可选 `channel_id` 仅在此基础上筛选频道，不会因携带 `channel_id` 而展示仅频道内可见内容。

**详情**（`GET /api/video/{vid}`）：除作者本人外，仅频道内可见视频须浏览者为该频道正式成员，否则 `error_vid`。

**频道内列表**（Channel 模块 `content`、`timeline`、`following/timeline`）：非成员仅见站外可见内容；成员可见该频道全部过审内容（含仅频道内可见）。

**用户主页**（`GET /api/video/user/{uid}`）：未传 `channel_id` 时不展示仅频道内可见视频；**作者本人**查看自己主页时可看到全部视频。

**收藏/历史/合集**：未传 `channel_id` 时排除仅频道内可见内容；传 `channel_id` 时在个人列表中按频道进一步筛选。

**评论 / 弹幕**：Comment 模块须通过父视频可见性校验（规则同详情）；Danmaku 模块见 `danmaku_api.md`。

---

## 视频获取

### 1. 随机视频列表

**请求**: `GET /api/video/random?num={num}`

**请求参数** (Query):
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**请求**: `GET /api/video/new?offset={offset}&num={num}&type={type}`

**请求参数** (Query):
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `type` (string, 可选): 视频类型，默认all
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

### 3. 热门视频列表

**请求**: `GET /api/video/popular?time_limit={time_limit}&time_start={time_start}&offset={offset}&num={num}`

**请求参数** (Query):
- `time_limit` (int, 可选): 截止时间范围（天数，往前推），默认 7；只统计最近 `time_limit` 天内的内容
- `time_start` (int, 可选): 起始时间范围（天数，往前推），默认 0；`>0` 时排除最近 `time_start` 天，形成 `[time_limit, time_start]` 天前的时间窗
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**时间窗说明**:
- 不携带 `time_start`（或为0）：与旧版一致，在「现在 → `time_limit` 天前」内筛选
- 例如 `time_limit=30&time_start=7`：只筛 7～30 天前发布的视频
- 旧客户端不传 `time_start` 时行为不变

**排序说明**（对齐热门动态 `GET /api/blog/popular`，并计入弹幕互动）:
- 在时间窗内、审核通过且未删除的视频中排序
- 热度分 = `0.4 * 归一化(独立评论人数) + 0.1 * 归一化(独立弹幕人数) + 0.3 * 归一化(点赞数) + 0.1 * 归一化(浏览量)`
- 独立评论人数：同一用户对同一视频多次评论只计 1
- 独立弹幕人数：同一用户对同一视频多次发弹幕只计 1
- 归一化固定上限：评论 30 / 弹幕 30 / 点赞 200 / 浏览 5000
- 同分时按 `vid` 降序

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg",
        "duration": 120,
        "comment_count": 8
      }
    ]
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

### 3.1 个性化推荐视频列表

**请求**: `GET /api/video/recommend?offset={offset}&num={num}&token={token}`

**说明**: 须登录。根据当前用户最近浏览记录与关注关系生成个性化推荐；并混入关注作者近期发布的内容。**不使用点赞数/播放量参与排序**。会应用全局屏蔽、拉黑与敏感词过滤。

**请求参数** (Query):
- `offset` (int, 可选): 偏移量，默认 0
- `num` (int, 可选): 返回数量，默认 20，最大 24
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道
- `token` (string, **必需**): 用户 token

**排序说明**:
- 兴趣分 = 标签匹配（权重 0.4）+ 标题关键词（0.35）+ 简介关键词（0.25）；历史越近权重越高
- 关注作者新内容额外 +0.22
- 已看过（历史中的 vid）不会重复推荐
- 同分时按 `vid` 降序
- 无有效兴趣画像时，关联度为 0，按候选池时间顺序参与排序

**成功响应**: 与「最新视频列表」相同，`data.video_list`

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误（`error_type`、`too_big_num`）
- `401`: `error_token`
- `500`: `system_error`

---

### 4. 分类视频列表

**请求**: `GET /api/video/category/{category}?num={num}`

**请求参数** (Path):
- `category` (string, 必需): 视频分类

**请求参数** (Query):
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

### 5. 搜索视频列表

**请求**: `GET /api/video/search?search_term={search_term}&offset={offset}&num={num}&...`

**请求参数** (Query):
- `search_term` (string, 可选): 搜索关键词
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `vid_desc` (int, 可选): 按视频ID降序排序，默认0
- `view_count_desc` (int, 可选): 按观看次数降序排序，默认0
- `like_count_desc` (int, 可选): 按点赞次数降序排序，默认0
- `favorite_count_desc` (int, 可选): 按收藏次数降序排序，默认0
- `uid` (int, 可选): 用户ID
- `type` (string, 可选): 视频类型
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg",
        "intro": "简介",
        "tags": ["滚木", "搞笑"],
        "tag": "#滚木#搞笑",
        "collection": "合集",
        "type": 1,
        "category": "分类",
        "duration": 120
      }
    ],
    "total_count": 100
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

### 6. 获取视频详情

**请求**: `GET /api/video/{vid}?token={token}&no_history={no_history}`

**请求参数** (Path):
- `vid` (int, 必需): 视频ID

**请求参数** (Query):
- `token` (string, 可选): 用户Token
- `no_history` (int, 可选): 是否不计入历史记录，0-计入（默认），1-不计入

**可见性**:
- 默认仅返回已过审且未删除的视频
- 若 `token` 为作者本人，可查看未删除但未过审（`audit_status≠1`）的自己的视频
- `channel_only_visible=1` 时，除作者本人外须为对应频道正式成员，否则 `error_vid`（详见「仅频道内可见」）
- 已删除视频仍不可见

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "vid": 1,
    "uid": 123,
    "title": "视频标题",
    "time": "2023-01-01 00:00:00",
    "like_count": 100,
    "favorite_count": 50,
    "view_count": 1000,
    "is_deleted": 0,
    "audit_status": 1,
    "cover_url": "https://example.com/cover.jpg",
    "username": "用户名",
    "avatar_url": "https://example.com/avatar.jpg",
    "if_like": 0,
    "if_favorite": 0
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `500`: 系统错误

**注意**:
- `no_history` 为 1 时，视频播放量正常计算，但不会计入用户的历史记录
- 适用于后台播放、预览等场景
- 默认仅返回已通过审核（`audit_status=1`）的视频；作者携带本人 `token` 时可查看自己的待审核视频（`audit_status=0`），方便提交后在待审期间编辑；待审核自审预览不计入历史记录与播放量
- `comment_count`: 可见评论总数（含回复；父评不可见时其子评不计）
- `parent_comment_count`: 直属视频的顶级评论数（`parent_vcid=0`，已过审且未删除）

---

### 7. 用户视频列表

**请求**: `GET /api/video/user/{uid}?offset={offset}&num={num}`

**请求参数** (Path):
- `uid` (int, 必需): 用户ID

**请求参数** (Query):
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时若当前用户已拉黑路径中的 `uid`，返回空 `video_list`（详见「列表与拉黑过滤」）

**说明**: 未传 `channel_id` 时不展示仅频道内可见视频；作者本人（有效 `token` 且为路径 `uid`）查看自己主页时可看到全部视频。

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `500`: 系统错误

---

### 8. 相关视频列表

**请求**: `GET /api/video/related/{vid}?num={num}&offset={offset}`

**请求参数** (Path):
- `vid` (int, 必需): 视频ID

**请求参数** (Query):
- `num` (int, 可选): 视频数量，默认20
- `offset` (int, 可选): 偏移量，默认0
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 可选): 用户 token；有效时过滤已拉黑作者的内容（详见「列表与拉黑过滤」）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ]
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `500`: 系统错误

---

### 9. 收藏视频列表

**请求**: `GET /api/video/favorite-list?offset={offset}&num={num}`

**请求参数** (Query):
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 必需): 用户Token

**说明**:
- 列表不含当前用户已拉黑作者发布的视频（详见「列表与拉黑过滤」）
- 未传 `channel_id` 时排除仅频道内可见收藏；携带 `channel_id` 时，列表与 `favorite_video_count` 均在该频道内统计

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    ],
    "favorite_video_count": 10
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `401`: Token无效或未提供
- `500`: 系统错误

---

### 10. 管理视频列表

**请求**: `GET /api/video/manage-list?offset={offset}&num={num}`

**请求参数** (Query):
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 视频数量，默认20
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "is_deleted": 0,
        "audit_status": 1,
        "cover_url": "https://example.com/cover.jpg",
        "collection": "合集名称",
        "collection_sort_order": 0,
        "channel_id": 1,
        "channel_detail": {
          "channel_id": 1,
          "channel_name": "频道名称",
          "channel_title": "频道标题",
          "description": "频道描述",
          "cover_url": "https://example.com/channel_cover.jpg"
        }
      }
    ],
    "manage_video_count": 20
  }
}
```

**HTTP状态码**:
- `200`: 获取成功
- `401`: Token无效或未提供
- `500`: 系统错误

---

### 11. 历史视频列表

**请求**: `GET /api/video/history-list`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `offset` (int, 可选): 偏移量，默认 `0`（旧客户端不传亦可）
- `num` (int, 可选): 返回数量，默认 `30`，最大 `30`（旧客户端不传亦可）
- `search_term` (string, 可选): 按视频**标题**模糊搜索；不传或空字符串则不过滤（与搜索接口的关键词用法类似，历史场景仅匹配标题）
- `time_start` (int|string, 可选): 打开时间下界；按 `last_opened_at` 筛选。支持 Unix 秒（也兼容毫秒）、`Y-m-d`、`Y-m-d H:i:s`
- `time_end` (int|string, 可选): 打开时间上界；格式同上。仅传 `Y-m-d` 时：`time_start` 取当天 `00:00:00`，`time_end` 取当天 `23:59:59`
- `channel_id` (int, 可选): 频道号；在站外可见视频中筛选该频道（见「仅频道内可见」）；不传则不过滤频道

**说明**:
- 列表不含当前用户已拉黑作者发布的视频（详见「列表与拉黑过滤」）
- 时间区间针对**最近打开历史时间**（`last_opened_at`），不是视频发布时间
- 上述筛选参数均可不携带；旧客户端行为不变
- 筛选在分页前生效，不会因过滤导致当页条数异常偏少（拉黑排除仍可能略少）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "video_list": [
      {
        "vid": 1,
        "uid": 123,
        "title": "视频标题",
        "time": "2023-01-01 00:00:00",
        "like_count": 100,
        "favorite_count": 50,
        "view_count": 1000,
        "cover_url": "https://example.com/cover.jpg",
        "username": "用户名",
        "avatar_url": "https://example.com/avatar.jpg",
        "duration": 120,
        "last_watch_second": 65,
        "last_opened_at": "2026-07-18 20:00:00"
      }
    ]
  }
}
```

**响应字段说明**:
- `duration`: 视频总时长（秒），可与 `last_watch_second` 计算观看进度
- `last_watch_second`: 最后观看到的秒数；**-1 表示已看完**，0 表示从头，正整数为进度秒数
- `last_opened_at`: 最近一次打开该视频详情的时间（列表按此字段倒序）

**HTTP状态码**:
- `200`: 获取成功
- `401`: Token无效或未提供
- `400`: `error_type` / `too_big_num`
- `500`: 系统错误

---

## 视频操作

### 12. 保存视频观看历史

**请求**: `POST /api/video/watch-history`

**请求参数** (Body，JSON 或 form)：
- `token` (string, 必需): 用户 Token
- `vid` (int, 必需): 视频 ID（VID）
- `last_watch_second` (int, 必需): 最后观看到的秒数；**-1 表示已看完**，0 表示从头开始，正整数表示当前播放到的秒数

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`: 缺少 vid 或 last_watch_second 或 token
- `error_token`: Token 无效或已过期
- `error_type`: vid / last_watch_second 非数字
- `error_vid`: 视频不存在

**HTTP状态码**:
- `200`: 保存成功
- `400`: 参数错误（缺少参数、类型错误、视频不存在）
- `401`: Token 无效或未提供
- `500`: 系统错误

---

### 13. 收藏/取消收藏视频

**请求**: `POST /api/video/favorite/{vid}`

**请求参数** (Path):
- `vid` (int, 必需): 视频ID

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "if_favorite": 1,
    "favorite_count": 51
  }
}
```

**HTTP状态码**:
- `200`: 操作成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `500`: 系统错误

---

### 14. 点赞/取消点赞视频

**请求**: `POST /api/video/like/{vid}`

**请求参数** (Path):
- `vid` (int, 必需): 视频ID

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "if_like": 1,
    "like_count": 101
  }
}
```

**HTTP状态码**:
- `200`: 操作成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `500`: 系统错误

---

### 15. 删除视频

**请求**: `DELETE /api/video/{vid}`

**请求参数** (Path):
- `vid` (int, 必需): 视频ID

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success"
}
```

**HTTP状态码**:
- `200`: 删除成功
- `401`: Token无效或未提供
- `403`: 无权限删除该视频
- `500`: 系统错误

---

### 16. 获取视频预上传地址

**请求**: `GET /api/video/video-presigned?token={token}&extension={extension}`

**请求参数** (Query):
- `token` (string, 必需): 用户 Token
- `extension` (string, 必需): 文件后缀，支持 `mp4`、`mov`、`m4v`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "url": "https://example.r2.cloudflarestorage.com/bucket/video/video_video/aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "file_name": "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "path": "/video/video_video/aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "video_index": 5,
    "max_file_size": 419430400
  }
}
```

**响应字段说明**:
- `url`: 预签名上传地址
- `file_name`: 服务端生成的文件名
- `path`: 无域名路径，写入草稿 `video_url` 时使用
- `video_index`: 本次使用的投稿序号
- `max_file_size`: 最大文件大小限制（字节）

**错误码**:
- `missing_argument`: 缺少参数
- `error_token`: Token 无效或已过期
- `invalid_file_extension`: 文件格式不支持（仅支持 mp4 / mov / m4v）
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token 无效或未提供
- `500`: 系统错误

**注意**: 小文件建议使用本接口单次 PUT；超过约 5MB 的视频建议改用 §16a 分片上传。

---

### 16a. 获取视频分片预上传地址

**请求**: `GET /api/video/video-presigned-multipart?token={token}&extension={extension}&part_count={part_count}`

**请求参数** (Query):
- `token` (string, 必需): 用户 Token
- `extension` (string, 必需): 文件后缀，支持 `mp4`、`mov`、`m4v`
- `part_count` (int, 必需): 分片数量，范围 2–100

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "upload_id": "abc123uploadid",
    "file_name": "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "path": "/video/video_video/aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "video_index": 5,
    "max_file_size": 419430400,
    "part_count": 4,
    "min_part_size": 5242880,
    "parts": [
      { "part_number": 1, "url": "https://example.r2.cloudflarestorage.com/...&partNumber=1&uploadId=..." },
      { "part_number": 2, "url": "https://example.r2.cloudflarestorage.com/...&partNumber=2&uploadId=..." }
    ]
  }
}
```

**响应字段说明**:
- `upload_id`: 分片上传会话 ID，完成上传时需要回传
- `file_name`: 服务端生成的文件名，规则同 §16
- `path`: 无域名路径，完成分片后写入草稿 `video_url` 时使用
- `video_index`: 本次使用的投稿序号
- `max_file_size`: 最大文件大小限制（字节，400MB）
- `part_count`: 分片数量
- `min_part_size`: 除最后一片外，每片最小 5MB（S3/R2 要求）
- `parts`: 各分片的预签名 PUT URL

**错误码**:
- `Missing extension parameter`: 缺少 extension
- `Missing part_count parameter`: 缺少 part_count
- `invalid_part_count`: 分片数不在 2–100 范围内
- `invalid_file_extension`: 文件格式不支持
- `error_token`: Token 无效或已过期
- `system_error`: 系统错误

**注意**:
- 预签名 URL 有效期为 1 小时
- 各分片上传完成后，从响应头 `ETag` 收集每片的 etag，再调用 §16b 完成合并
- 小文件（如 ≤5MB）请使用 §16 单次上传

---

### 16b. 完成视频分片上传

**请求**: `POST /api/video/multipart-complete`

**请求参数** (Body):
- `token` (string, 必需): 用户 Token
- `file_name` (string, 必需): §16a 或 §23a 返回的 `file_name`
- `upload_id` (string, 必需): §16a 或 §23a 返回的 `upload_id`
- `parts` (array, 必需): 分片信息，每项含 `part_number`（int）和 `etag`（string，来自 UploadPart 响应头）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "file_name": "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "path": "/video/video_video/aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2"
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token 无效或已过期
- `invalid_file_name`: file_name 不属于当前用户
- `invalid_parts`: 分片信息无效
- `system_error`: 系统错误

**注意**:
- 投稿：完成后将 `path` 写入草稿 `video_url`
- 换源：完成后将 `path` 作为 `video_url` 传给 `update-r2`

---

### 17. 获取封面预上传地址

**请求**: `GET /api/video/cover-presigned?token={token}&extension={extension}`

**请求参数** (Query):
- `token` (string, 必需): 用户 Token
- `extension` (string, 必需): 文件后缀，支持 `jpg`, `jpeg`, `png`, `gif`, `webp`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "url": "https://example.r2.cloudflarestorage.com/bucket/video/video_cover/XyZ7wV6uT5sR4qP3oN2mM1lK0jI9hG8f?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "file_name": "XyZ7wV6uT5sR4qP3oN2mM1lK0jI9hG8f",
    "path": "/video/video_cover/XyZ7wV6uT5sR4qP3oN2mM1lK0jI9hG8f",
    "video_index": 5,
    "max_file_size": 3145728
  }
}
```

**响应字段说明**:
- `url`: 预签名上传地址
- `file_name`: 服务端生成的文件名
- `path`: 无域名路径，写入草稿 `cover_url` 时使用
- `video_index`: 本次使用的投稿序号
- `max_file_size`: 最大文件大小限制（字节）

**错误码**:
- `missing_argument`: 缺少参数
- `error_token`: Token 无效或已过期
- `invalid_file_extension`: 文件格式不支持
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token 无效或未提供
- `500`: 系统错误

---

## 视频草稿（R2 直传配套）

每用户仅允许一条草稿。`video_url` / `cover_url` 仅接受**无域名的路径**（如 `/video/video_video/xxx`），且须来自预签名接口返回的 `path`。发布时若投稿序号冲突，返回 `index_conflict`，需重新获取预签名并上传。

`duration`：前端本地探测的视频时长（秒，整数）。草稿阶段可与 `video_url` 一并写入（允许暂为 0）；**发布时必须为 1–28800**，否则 `error_duration`。清空 `video_url` 时服务端会将 `duration` 置 0。

### 18. 获取视频草稿

**请求**: `GET /api/video/draft?token={token}`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "draft_id": 1,
    "uid": 123,
    "title": "标题",
    "intro": "简介",
    "type": 1,
    "category": 0,
    "tags": ["滚木"],
    "tag": "#滚木",
    "channel_id": 0,
    "channel_section_id": 0,
    "channel_only_visible": 0,
    "video_url": "/video/video_video/xxxx",
    "cover_url": "/video/video_cover/yyyy",
    "video_preview_url": "https://file.ottohub.org/video/video_video/xxxx?t=1720000000",
    "cover_preview_url": "https://file.ottohub.org/video/video_cover/yyyy?t=1720000000",
    "video_index": 5,
    "duration": 125,
    "created_at": "2026-07-13 12:00:00",
    "updated_at": "2026-07-13 12:00:00"
  }
}
```

**错误码**: `error_token`、`draft_not_found`、`system_error`

**HTTP状态码**: `200` / `400` / `401` / `500`

---

### 19. 保存视频草稿

**请求**: `POST /api/video/draft`

**请求参数** (Body, JSON，字段均可选；有值则校验):
- `token` (string, 必需)
- `title`、`intro`、`type`、`category`（int，可选，0–7；不传 / null / 空则 `0` 表示无分区；`2` 归一为 `1`）、`tags`（JSON 字符串数组，最多 10 项；空则 `[]`）
- `tag` (string, 可选): legacy `#hash` 格式，与 `tags` 二选一；旧客户端可继续传此字段
- `channel_id` (int, 可选): 目标频道 ID，`0` 表示不投稿到频道（同时将 `channel_section_id`、`channel_only_visible` 置 `0`）
- `channel_section_id` (int, 可选): 目标频道二级分区 ID；须属于 `channel_id` 对应频道
- `channel_only_visible` (int, 可选): `0`=站外可见（默认），`1`=仅频道内可见；`channel_id=0` 时强制为 `0`
- `video_url`、`cover_url`：无域名路径；非空时须为有效预签名路径
- `duration` (int, 可选): 视频时长（秒）；有 `video_url` 时建议一并写入；合法范围 0–28800（0 表示尚未探测）

**说明**:
- `channel_id>0` 时校验频道存在、二级分区归属；用户须为正式成员，若频道 `open_post=1` 则登录用户无需加入即可投稿；否则若 `join_permission=0`（允许自由加入）则自动加入并关注

**成功响应**:
```json
{
  "status": "success",
  "data": { "draft_id": 1 }
}
```

**错误码**:
- `draft_exists`: 已有草稿，请先修改或删除
- `error_video_url` / `error_cover_url`: 路径不合法或无效
- `error_duration`: 时长非法
- `title_too_long` / `intro_too_long` / `error_type` / `error_category` / `tag_too_many` / `error_tag`
- `channel_not_found` / `not_channel_member` / `channel_section_not_found` / `channel_section_not_belong_to_channel`
- `error_token` / `system_error`

**HTTP状态码**: `200` / `400` / `401` / `500`

---

### 20. 修改视频草稿

**请求**: `PUT /api/video/draft`（亦支持 `PATCH`）

**说明**: 必须已有草稿；未传入的字段保持原值；传入的 `video_url` / `cover_url` 仍做路径校验。

**成功响应**:
```json
{ "status": "success" }
```

**错误码**: `draft_not_found`，其余同保存草稿

**HTTP状态码**: `200` / `400` / `401` / `500`

---

### 21. 删除视频草稿

**请求**: `DELETE /api/video/draft`

**请求参数**: Body 或 Query 中的 `token`

**成功响应**:
```json
{ "status": "success" }
```

**错误码**: `error_token`、`draft_not_found`、`system_error`

**HTTP状态码**: `200` / `400` / `401` / `500`

---

### 22. 发布视频草稿

**请求**: `POST /api/video/draft/publish`

**说明**:
- 发布草稿为正式视频并分配 `vid`
- 发布时 `video_url`、`cover_url` 必填且须为有效预签名路径
- 发布时草稿 `duration` 必须为 **1–28800**（前端上传前探测并写入草稿），否则 `error_duration`
- `type` 须为 1/2/3；标题/简介/标签为空时使用与旧投稿相同的默认文案
- `category` 未填或为 `0` 表示无分区，发布时允许
- 成功后删除该用户草稿（旧轨 `submit` 已下线，投稿请走本接口）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "vid": 123,
    "if_add_experience": 1
  }
}
```

**错误码**: `draft_not_found`、`error_video_url`、`error_cover_url`、`error_duration`、`error_type`、`index_conflict` 等，以及 `error_token`、`system_error`

**说明（index_conflict）**: 草稿关联的投稿序号已失效（例如草稿期间又发布了其他视频）。处理：PUT 草稿将 `video_url`/`cover_url` 置空，重新取预签名并上传后再 publish。

**HTTP状态码**: `200` / `400` / `401` / `500`

---

## 视频信息更新（R2）

旧轨 `POST /api/video/update/{vid}`（multipart）已下线。文字规则相同；换封面/视频时先拿对应预签名直传，再把返回的无域名 `path` 写入本接口。

预签名按「该视频是此用户第几次投稿」计算序号。每次预签名可能得到新对象名，更新后以新路径为准。

### 23. 修改用视频预上传地址

**请求**: `GET /api/video/update-video-presigned?token={token}&vid={vid}&extension={extension}`

**请求参数** (Query):
- `token` (string, 必需)
- `vid` (int, 必需): 要修改的视频 ID（须本人所有）
- `extension` (string, 必需): `mp4` / `mov` / `m4v`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "url": "https://....r2.cloudflarestorage.com/...?X-Amz-Algorithm=...",
    "file_name": "aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "path": "/video/video_video/aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2",
    "video_index": 5,
    "max_file_size": 419430400
  }
}
```

**说明**: 客户端 `PUT` 到 `url` 上传完成后，将 `path` 作为 `video_url` 传给 `update-r2`。大文件请改用 §23a。

**错误码**: `error_vid`、`error_token`、`video_not_found_or_not_owned`、`invalid_file_extension`、`system_error`

**HTTP状态码**: `200` / `400` / `401` / `403` / `500`

---

### 23a. 修改用视频分片预上传地址

**请求**: `GET /api/video/update-video-presigned-multipart?token={token}&vid={vid}&extension={extension}&part_count={part_count}`

**请求参数** (Query):
- `token` (string, 必需)
- `vid` (int, 必需): 要修改的视频 ID（须本人所有）
- `extension` (string, 必需): `mp4` / `mov` / `m4v`
- `part_count` (int, 必需): 分片数量，范围 2–100

**成功响应**: 字段同 §16a（含 `upload_id`、`path`、`parts` 等）。对象名规则与 §23 一致。

**说明**: 各分片 PUT 完成后调用 `POST /api/video/multipart-complete`，再将返回的 `path` 作为 `video_url` 传给 `update-r2`。

**错误码**: 同 §23，另有 `invalid_part_count`、`Missing part_count parameter`

**HTTP状态码**: `200` / `400` / `401` / `403` / `500`

---

### 24. 修改用封面预上传地址

**请求**: `GET /api/video/update-cover-presigned?token={token}&vid={vid}&extension={extension}`

**请求参数** (Query):
- `token` (string, 必需)
- `vid` (int, 必需)
- `extension` (string, 必需): `jpg` / `jpeg` / `png` / `gif` / `webp`

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "url": "https://....r2.cloudflarestorage.com/...?X-Amz-Algorithm=...",
    "file_name": "XyZ7wV6uT5sR4qP3oN2mM1lK0jI9hG8f",
    "path": "/video/video_cover/XyZ7wV6uT5sR4qP3oN2mM1lK0jI9hG8f",
    "video_index": 5,
    "max_file_size": 3145728
  }
}
```

**说明**: 上传完成后将 `path` 作为 `cover_url` 传给 `update-r2`。

**错误码**: 同修改用视频预上传

**HTTP状态码**: `200` / `400` / `401` / `403` / `500`

---

### 25. 视频信息更新（R2）

**请求**: `POST /api/video/update-r2/{vid}`

**请求参数** (Body, JSON；字段均可选，传入则更新):
- `token` (string, 必需)
- `title` (string, 可选): 最长 100；空则默认「点击输入标题」
- `intro` (string, 可选): 最长 2000；空则默认「这个人写了一条滚木。」
- `tags` (array, 可选): JSON 字符串数组，最多 10 项；空则默认 `["滚木"]`
- `tag` (string, 可选): legacy `#hash` 格式，与 `tags` 二选一；旧客户端可继续传此字段
- `category` (int, 可选): 0–7（`2` 会归一为 `1`）；不传 / null / 空则 `0`（无分区）
- `copyright_type` (int, 可选): 版权性质，仅允许 `1` / `2` / `3`；**不传则不修改**（兼容旧客户端）
- `channel_id` (int, 可选): 目标频道 ID；`0` 表示不投稿到频道（同时将 `channel_section_id`、`channel_only_visible` 置 `0`）
- `channel_section_id` (int, 可选): 目标频道二级分区 ID；须属于 `channel_id` 对应频道
- `channel_only_visible` (int, 可选): `0`=站外可见（默认），`1`=仅频道内可见；`channel_id=0` 时强制为 `0`
- `cover_url` (string, 可选): 无域名路径，须来自 `update-cover-presigned` 的 `path`
- `video_url` (string, 可选): 无域名路径，须来自 `update-video-presigned` 或 `multipart-complete` 的 `path`
- `duration` (int, **换源时必需**): 新视频时长（秒，1–28800）；仅在传 `video_url` 时使用，禁止单独改时长

**成功响应**:
```json
{
  "status": "success"
}
```

**说明**:
- 仅作者可更新
- 写入 `cover_url` / `video_url` 时 `cover_version` / `video_version` 自增；换 `video_url` 时同步更新 `duration`
- 修改标题/简介/标签/版权性质/封面/视频后进入待审核（`audit_status=0`）；**仅改分区或频道字段不触发重新审核**

**错误码**:
- `error_token` / `error_vid` / `video_not_found_or_not_owned`
- `title_too_long` / `intro_too_long` / `tag_too_many` / `error_tag` / `error_category` / `error_type`
- `error_cover_url` / `error_video_url` / `error_duration`
- `channel_not_found` / `not_channel_member` / `channel_section_not_found` / `channel_section_not_belong_to_channel`
- `system_error`

**HTTP状态码**: `200` / `400` / `401` / `403` / `500`

---

## 接口使用流程示例

### 获取视频列表流程

1. **获取最新视频**（已登录建议附带 token 以过滤已拉黑作者）
   ```
   GET /api/video/new?offset=0&num=20&token=abc123def456...
   ```

2. **获取热门视频**
   ```
   GET /api/video/popular?time_limit=7&offset=0&num=20&token=abc123def456...
   ```

3. **搜索视频**
   ```
   GET /api/video/search?search_term=关键词&offset=0&num=20&like_count_desc=1&token=abc123def456...
   ```

### 视频交互流程

1. **获取视频详情**
   ```
   GET /api/video/123?token=abc123def456...
   ```

2. **点赞视频**
   ```
   POST /api/video/like/123
   Body: { "token": "abc123def456..." }
   ```

3. **收藏视频**
   ```
   POST /api/video/favorite/123
   Body: { "token": "abc123def456..." }
   ```

4. **保存观看历史**
   ```
   POST /api/video/watch-history
   Body: { "token": "abc123def456...", "vid": 123, "last_watch_second": 65 }
   ```
   （`last_watch_second` 为 -1 表示已看完）

### 视频投稿与更新流程

1. **投稿视频**（R2 直传 + 草稿）
   ```
   GET /api/video/video-presigned?token=...&extension=mp4
   → PUT 到返回的 url 上传视频
   GET /api/video/cover-presigned?token=...&extension=jpg
   → PUT 到返回的 url 上传封面
   POST /api/video/draft  （或 PUT /api/video/draft 更新）
   POST /api/video/draft/publish
   ```

   大文件分片投稿：
   ```
   GET /api/video/video-presigned-multipart?token=...&extension=mp4&part_count=4
   → 对各 parts[].url 发 PUT，记录响应头 ETag
   POST /api/video/multipart-complete
   Body: { "token": "...", "file_name": "...", "upload_id": "...", "parts": [{ "part_number": 1, "etag": "\"...\"" }] }
   → 将返回的 path 写入草稿 video_url
   ```

2. **更新视频信息或封面/视频文件**（R2 直传）
   ```
   GET /api/video/update-cover-presigned?token=...&vid=123&extension=jpg
   → PUT 到返回的 url 上传封面
   GET /api/video/update-video-presigned?token=...&vid=123&extension=mp4
   → PUT 到返回的 url 上传视频（可选）
   POST /api/video/update-r2/123
   Body: { "token": "...", "title": "...", "cover_url": "/video/video_cover/xxx", "video_url": "/video/video_video/yyy", "duration": 120 }
   ```
   （仅改正文时可直接调 `update-r2`，不必先拿预签名）

   大文件换源：先调 `update-video-presigned-multipart`，再 `multipart-complete`，最后把 `path` 传给 `update-r2`。

### 视频管理流程

1. **获取管理视频列表**
   ```
   GET /api/video/manage-list?offset=0&num=20&token=abc123def456...
   ```

2. **删除视频**
   ```
   DELETE /api/video/123
   Body: { "token": "abc123def456..." }
   ```

3. **获取收藏视频列表**
   ```
   GET /api/video/favorite-list?offset=0&num=20&token=abc123def456...
   ```

4. **获取历史视频列表**
   ```
   GET /api/video/history-list?token=abc123def456...
   ```

---

## 安全说明

1. **认证安全**:
   - 部分接口需要提供有效的 `token` 进行身份认证
   - Token应妥善保管，不要泄露
   - Token失效后需要重新登录获取

2. **权限控制**:
   - 删除视频操作只能删除自己的视频

3. **参数验证**:
   - 所有接口都会对输入参数进行验证
   - 无效参数会返回相应的错误信息

4. **速率限制**:
   - 部分接口可能有请求频率限制
   - 超过限制会返回相应的错误信息

---

## 常见问题

**Q: 为什么获取视频详情时需要提供token？**
A: 提供token可以获取用户对该视频的点赞和收藏状态。

**Q: 为什么删除视频失败？**
A: 可能的原因包括：
   - Token无效或未提供
   - 视频不存在或已被删除
   - 无权限删除该视频（只能删除自己的视频）

**Q: 为什么收藏/点赞视频失败？**
A: 可能的原因包括：
   - Token无效或未提供
   - 视频不存在或已被删除
   - 系统错误

**Q: 如何获取更多视频？**
A: 使用 `offset` 和 `num` 参数进行分页查询。

**Q: 如何排序搜索结果？**
A: 使用 `vid_desc`、`view_count_desc`、`like_count_desc`、`favorite_count_desc` 参数进行排序。

**Q: 登录后列表仍能看到已拉黑用户的内容？**
A: 公开列表接口的 `token` 为可选参数。客户端需在请求 Query 中附带有效 token，服务端才会按「列表与拉黑过滤」一节排除已拉黑作者的内容。
