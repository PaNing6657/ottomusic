# Collection 合集模块 API 文档

## 概述

合集模块提供视频合集、动态合集、静画合集的设置、查询、排序、解散等功能。

**基础信息**:
- **基础路径**: `/api/collection`
- **请求格式**: JSON（POST/PUT/DELETE）或 Query参数（GET）
- **响应格式**: JSON
- **认证方式**: 部分接口通过 `token` 参数传递（GET请求）或请求体（POST/PUT/DELETE请求）
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
- `error_type`: 错误的数值类型
- `system_error`: 系统错误
- `no_permission`: 没有权限
- `warn`: 触发敏感词
- `error_collection`: 错误的合集名
- `text_too_long`: 文本过长
- `no_collection`: 不存在该合集
- `error_vid`: 错误的视频ID
- `error_bid`: 错误的动态ID
- `video_not_in_collection`: 视频未加入合集
- `blog_not_in_collection`: 动态未加入合集
- `error_sid`: 错误的静画ID
- `seiga_not_in_collection`: 静画未加入合集

---

## 仅频道内可见

未传 `channel_id` 时，合集列表与合集内条目查询**排除** `channel_only_visible=1` 的内容；传 `channel_id` 时在上述结果中按频道进一步筛选。详见 Blog/Video 模块「仅频道内可见」。

---

## 视频合集

### 1. 设置视频所属合集

**请求**: `POST /api/collection/videos/{vid}/collection`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `collection` (string, 必需): 合集名称，允许传空字符串表示移出合集

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `error_type`
- `error_collection`
- `text_too_long`
- `warn`
- `no_permission`
- `system_error`

---

### 2. 获取视频所属合集详情

**请求**: `GET /api/collection/videos/{vid}/collection`

**请求参数** (Query):
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "collection": "我的合集",
  "video_list": [
    {
      "vid": 1,
      "uid": 2,
      "title": "标题",
      "time": "2026-01-01 00:00:00",
      "like_count": 0,
      "favorite_count": 0,
      "view_count": 0,
      "cover_url": "https://example.com/cover.jpg",
      "username": "用户名",
      "avatar_url": "https://example.com/avatar.jpg",
      "collection_sort_order": 0
    }
  ]
}
```

**错误码**:
- `error_type`
- `video_not_in_collection`
- `system_error`

---

### 3. 获取用户的视频合集列表

**请求**: `GET /api/collection/videos/collections?uid={uid}`

**请求参数** (Query):
- `uid` (int, 必需): 用户UID
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "collection_list": ["合集A", "合集B"]
}
```

**错误码**:
- `missing_argument`
- `error_type`
- `system_error`

---

### 4. 获取视频合集中的视频列表

**请求**: `GET /api/collection/videos/collections/items?uid={uid}&collection={collection}`

**请求参数** (Query):
- `uid` (int, 必需): 用户UID
- `collection` (string, 必需): 合集名称
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "video_list": [
    {
      "vid": 1,
      "uid": 2,
      "title": "标题",
      "time": "2026-01-01 00:00:00",
      "like_count": 0,
      "favorite_count": 0,
      "view_count": 0,
      "cover_url": "https://example.com/cover.jpg",
      "username": "用户名",
      "avatar_url": "https://example.com/avatar.jpg",
      "collection_sort_order": 0
    }
  ]
}
```

**错误码**:
- `missing_argument`
- `error_type`
- `error_collection`
- `system_error`

---

### 5. 设置视频合集排序值

**请求**: `PUT /api/collection/videos/{vid}/collection-sort-order`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `collection_sort_order` (int, 必需): 新的排序值

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `error_type`
- `error_vid`
- `no_collection`
- `system_error`

---

### 6. 解散视频合集

**请求**: `DELETE /api/collection/videos/collections`

**请求参数** (Body 或 Query):
- `token` (string, 必需): 用户Token
- `collection` (string, 必需): 合集名称

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `no_collection`
- `system_error`

---

## 动态合集

### 1. 设置动态所属合集

**请求**: `POST /api/collection/blogs/{bid}/collection`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `collection` (string, 必需): 合集名称，允许传空字符串表示移出合集

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `error_type`
- `error_collection`
- `text_too_long`
- `warn`
- `no_permission`
- `system_error`

---

### 2. 获取动态所属合集详情

**请求**: `GET /api/collection/blogs/{bid}/collection`

**请求参数** (Query):
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "collection": "我的合集",
  "blog_list": [
    {
      "bid": 1,
      "uid": 2,
      "title": "标题",
      "content": "内容",
      "time": "2026-01-01 00:00:00",
      "like_count": 0,
      "favorite_count": 0,
      "view_count": 0,
      "avatar_url": "https://example.com/avatar.jpg",
      "username": "用户名",
      "thumbnails": [],
      "collection_sort_order": 0,
      "attached_vid": 0,
      "blog_type": 0
    }
  ]
}
```

**错误码**:
- `error_type`
- `blog_not_in_collection`
- `system_error`

---

### 3. 获取用户的动态合集列表

**请求**: `GET /api/collection/blogs/collections?uid={uid}`

**请求参数** (Query):
- `uid` (int, 必需): 用户UID
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "collection_list": ["合集A", "合集B"]
}
```

**错误码**:
- `missing_argument`
- `error_type`
- `system_error`

---

### 4. 获取动态合集中的动态列表

**请求**: `GET /api/collection/blogs/collections/items?uid={uid}&collection={collection}`

**请求参数** (Query):
- `uid` (int, 必需): 用户UID
- `collection` (string, 必需): 合集名称
- `channel_id` (int, 可选): 频道号；在站外可见合集中筛选该频道；不传则不过滤频道（且排除仅频道内可见内容，见「仅频道内可见」）

**成功响应**:
```json
{
  "status": "success",
  "blog_list": [
    {
      "bid": 1,
      "uid": 2,
      "title": "标题",
      "content": "内容",
      "time": "2026-01-01 00:00:00",
      "like_count": 0,
      "favorite_count": 0,
      "view_count": 0,
      "avatar_url": "https://example.com/avatar.jpg",
      "username": "用户名",
      "thumbnails": [],
      "collection_sort_order": 0,
      "attached_vid": 0,
      "blog_type": 0
    }
  ]
}
```

**错误码**:
- `missing_argument`
- `error_type`
- `error_collection`
- `system_error`

---

### 5. 设置动态合集排序值

**请求**: `PUT /api/collection/blogs/{bid}/collection-sort-order`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `collection_sort_order` (int, 必需): 新的排序值

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `error_type`
- `error_bid`
- `no_collection`
- `system_error`

---

### 6. 解散动态合集

**请求**: `DELETE /api/collection/blogs/collections`

**请求参数** (Body 或 Query):
- `token` (string, 必需): 用户Token
- `collection` (string, 必需): 合集名称

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`
- `error_token`
- `no_collection`
- `system_error`

---

## 静画合集

静画无 `channel_id`，合集接口不含频道筛选。仅作者本人可设置/排序；查询仅返回过审且未删作品。

### 1. 设置静画所属合集

**请求**: `POST /api/collection/seigas/{sid}/collection`

**Body**: `token`、`collection`（空字符串移出合集）

---

### 2. 获取静画所在合集的全部作品

**请求**: `GET /api/collection/seigas/{sid}/collection`

**成功响应**: `collection`、`seiga_list`

**错误码**: `seiga_not_in_collection`

---

### 3. 获取用户静画合集名列表

**请求**: `GET /api/collection/seigas/collections?uid={uid}`

---

### 4. 获取用户某静画合集作品列表

**请求**: `GET /api/collection/seigas/collections/items?uid={uid}&collection={name}`

---

### 5. 设置静画合集排序

**请求**: `PUT /api/collection/seigas/{sid}/collection-sort-order`

**Body**: `token`、`collection_sort_order`

**错误码**: `error_sid`、`no_collection`

---

### 6. 解散静画合集

**请求**: `DELETE /api/collection/seigas/collections`

**Body/Query**: `token`、`collection`
