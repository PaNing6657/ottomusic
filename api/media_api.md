# Media 媒体模块 API 文档

## 概述

媒体模块提供媒体文件的管理、查询、审核等功能。

**基础信息**:
- **基础路径**: `/api/media`
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
- `too_big_num`: 参数值过大
- `error_media_id`: 媒体ID不存在或无效
- `not_reviewer`: 非审核员权限
- `no_permission`: 权限不足

---

## 媒体查询

### 1. 获取随机媒体列表

**请求**: `GET /api/media/random`

**请求参数** (Query):
- `num` (int, 可选): 返回媒体数量（默认20，最大24）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 1,
        "uid": 123,
        "extension": "jpg",
        "title": "示例图片",
        "tag": "风景,自然",
        "original_source": "网络",
        "media_type": "图片",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-01-01 12:00:00",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      ...
    ]
  }
}
```

**错误码**:
- `error_type`: 参数类型错误
- `too_big_num`: 参数值过大
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `500`: 系统错误

---

### 2. 获取最新媒体列表

**请求**: `GET /api/media/new`

**请求参数** (Query):
- `offset` (int, 可选): 偏移量（默认0）
- `num` (int, 可选): 返回媒体数量（默认20，最大24）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 100,
        "uid": 123,
        "extension": "jpg",
        "title": "最新图片",
        "tag": "风景,自然",
        "original_source": "网络",
        "media_type": "图片",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-01-01 12:00:00",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      ...
    ]
  }
}
```

**错误码**:
- `error_type`: 参数类型错误
- `too_big_num`: 参数值过大
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `500`: 系统错误

---

### 3. 获取审核媒体列表

**请求**: `GET /api/media/audit`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `offset` (int, 可选): 偏移量（默认0）
- `num` (int, 可选): 返回媒体数量（默认20，最大24）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 50,
        "uid": 123,
        "extension": "jpg",
        "title": "待审核图片",
        "tag": "风景,自然",
        "original_source": "网络",
        "media_type": "图片",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-01-01 12:00:00",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      ...
    ]
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `not_reviewer`: 非审核员权限
- `error_type`: 参数类型错误
- `too_big_num`: 参数值过大
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `403`: 权限不足
- `500`: 系统错误

---

### 4. 搜索媒体列表

**请求**: `GET /api/media/search`

**请求参数** (Query):
- `search_term` (string, 可选): 搜索关键词
- `offset` (int, 可选): 偏移量（默认0）
- `num` (int, 可选): 返回媒体数量（默认20，最大100）
- `media_id_desc` (int, 可选): 按媒体ID降序（1-启用）
- `media_id_asc` (int, 可选): 按媒体ID升序（1-启用）
- `file_size_desc` (int, 可选): 按文件大小降序（1-启用）
- `file_size_asc` (int, 可选): 按文件大小升序（1-启用）
- `uid` (int, 可选): 按用户ID筛选
- `extension` (string, 可选): 按扩展名筛选（多个用逗号分隔）
- `tag` (string, 可选): 按标签筛选（多个用井号分隔）
- `media_type` (string, 可选): 按媒体类型筛选
- `copyright_type` (int, 可选): 按版权类型筛选
- `min_file_size` (int, 可选): 最小文件大小（字节）
- `max_file_size` (int, 可选): 最大文件大小（字节）
- `object_key` (string, 可选): 按对象存储key筛选（精确匹配）
- `title` (string, 可选): 按标题筛选（精确匹配）
- `token` (string, 可选): 用户Token（用于获取收藏状态）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 25,
        "uid": 123,
        "extension": "jpg",
        "title": "搜索结果",
        "tag": "风景,自然",
        "original_source": "网络",
        "media_type": "图片",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-01-01 12:00:00",
        "file_url": "https://example.com/media/1.jpg",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg",
        "if_favorite": 0
      },
      ...
    ],
    "total_count": 100
  }
}
```

**错误码**:
- `error_type`: 参数类型错误
- `too_big_num`: 参数值过大
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `500`: 系统错误

---

### 5. 获取媒体详情

**请求**: `GET /api/media/{media_id}`

**请求参数** (Query):
- `token` (string, 可选): 用户Token（用于获取收藏状态）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 1,
        "uid": 123,
        "extension": "jpg",
        "title": "媒体标题",
        "intro": "媒体简介",
        "tag": "标签1,标签2",
        "original_source": "来源",
        "media_type": "图片",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-01-01 12:00:00",
        "file_url": "https://example.com/media/1.jpg",
        "favorite_count": 10,
        "archive_directory": "2024/01/01",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg",
        "if_favorite": 0
      }
    ]
  }
}
```

**错误码**:
- `error_type`: 参数类型错误
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `404`: 媒体不存在
- `500`: 系统错误

---

### 6. 获取收藏媒体列表

**请求**: `GET /api/media/favorite/{uid}`

**请求参数** (Query):
- `offset` (int, 可选): 偏移量（默认0）
- `num` (int, 可选): 返回媒体数量（默认20，最大24）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "favorite_media_count": 5,
    "media_list": [
      {
        "media_id": 1,
        "uid": 123,
        "title": "收藏的媒体",
        "tag": "标签1,标签2",
        "original_source": "来源",
        "media_type": "图片",
        "copyright_type": 1,
        "file_name": "example.jpg",
        "file_size": 1024000,
        "favorite_count": 10,
        "created_at": "2024-01-01 12:00:00",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      ...
    ]
  }
}
```

**错误码**:
- `error_type`: 参数类型错误
- `too_big_num`: 参数值过大
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 请求成功
- `400`: 参数错误
- `500`: 系统错误

---

## 媒体操作

### 7. 删除媒体

**请求**: `DELETE /api/media/{media_id}`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 删除成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 只有媒体作者可以删除自己的媒体
- 删除后媒体不可见

---

### 8. 申诉媒体

**请求**: `POST /api/media/{media_id}/appeal`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 申诉成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 只有媒体作者可以申诉自己的媒体
- 只有审核状态为拒绝（2）的媒体可以申诉
- 申诉后媒体状态变为待审核（0）

---

### 9. 举报媒体

**请求**: `POST /api/media/{media_id}/report`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_media_id`: 媒体ID不存在或无效
- `no_permission`: 权限不足（经验值不足500）
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 举报成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `403`: 权限不足
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 举报者需要至少500经验值
- 举报后媒体状态变为待审核（0）
- 系统会发送举报通知给管理员

---

### 10. 批准媒体

**请求**: `POST /api/media/{media_id}/approve`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `not_reviewer`: 非审核员权限
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 批准成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `403`: 权限不足
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 只有审核员可以批准媒体
- 只有审核状态为待审核（0）的媒体可以批准
- 批准后媒体状态变为通过（1）
- 系统会发送批准通知给媒体作者

---

### 11. 拒绝媒体

**请求**: `POST /api/media/{media_id}/reject`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `not_reviewer`: 非审核员权限
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 拒绝成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `403`: 权限不足
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 只有审核员可以拒绝媒体
- 只有审核状态为待审核（0）的媒体可以拒绝
- 拒绝后媒体状态变为拒绝（2）
- 系统会发送拒绝通知给媒体作者

---

### 12. 收藏媒体

**请求**: `POST /api/media/{media_id}/favorite`

**请求参数** (Body):
- `token` (string, 必需): 用户Token

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "if_favorite": 1,
    "favorite_count": 11
  }
}
```

**响应字段说明**:
- `if_favorite`: 是否收藏（1-已收藏，0-未收藏）
- `favorite_count`: 媒体收藏数

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 操作成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 此接口为切换收藏状态
- 如果已收藏，则取消收藏
- 如果未收藏，则添加收藏
- 收藏状态变更会更新媒体的 `favorite_count` 字段

---

### 13. 生成预签名URL

**请求**: `GET /api/media/presigned`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `extension` (string, 必需): 文件后缀（如jpg、png、mp4等）

**允许的文件后缀**:
- 图像类: jpg, jpeg, png, gif, bmp, webp, svg, ico, tiff
- 音频类: mp3, wav, ogg, flac, aac, wma, m4a, amr
- 视频类: mp4, avi, mov, wmv, flv, mkv, webm, mpeg, mpg
- 压缩包类: zip, rar, 7z, tar, gz, bz2, iso, rar5

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "url": "https://example.r2.cloudflarestorage.com/bucket/media/1234567890_1234_123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
    "file_name": "1234567890_1234_123.jpg",
    "max_file_size": 10485760
  }
}
```

**响应字段说明**:
- `url`: 预签名 URL，用于前端直接上传文件
- `file_name`: 服务端生成的文件名
- `max_file_size`: 最大文件大小限制（字节），根据文件后缀动态计算

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `invalid_file_extension`: 文件后缀无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 生成成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `500`: 系统错误

**注意**:
- 预签名URL有效期为1小时
- 上传路径为存储桶的 `media/` 目录
- 文件名由服务端生成，上传后请保存返回的 `file_name`
- 前端使用此URL进行PUT请求上传文件

---

### 13a. 生成分片预签名URL

**请求**: `GET /api/media/presigned_multipart`

**请求参数** (Query):
- `token` (string, 必需): 用户Token
- `extension` (string, 必需): 文件后缀（同 §13）
- `part_count` (int, 必需): 分片数量，范围 2–100

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "upload_id": "abc123uploadid",
    "file_name": "aBcDeFg...xyz.jpg",
    "max_file_size": 52428800,
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
- `file_name`: 服务端生成的文件名，规则同 §13
- `max_file_size`: 最大文件大小限制（字节）
- `part_count`: 分片数量
- `min_part_size`: 除最后一片外，每片最小 5MB（S3/R2 要求）
- `parts`: 各分片的预签名 PUT URL

**错误码**:
- `Missing extension parameter`: 缺少 extension
- `Missing part_count parameter`: 缺少 part_count
- `invalid_part_count`: 分片数不在 2–100 范围内
- `invalid_file_extension`: 文件后缀无效
- `error_token`: Token无效或已过期
- `system_error`: 系统错误

**注意**:
- 预签名 URL 有效期为 1 小时
- 小文件（如 ≤5MB 图片）建议使用 §13 单次上传，分片上传除最后一片外每片须 ≥5MB
- 各分片上传完成后，从响应头 `ETag` 收集每片的 etag，用于完成上传

---

### 13b. 完成分片上传

**请求**: `POST /api/media/multipart_complete`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `file_name` (string, 必需): §13a 返回的 file_name
- `upload_id` (string, 必需): §13a 返回的 upload_id
- `parts` (array, 必需): 分片信息，每项含 `part_number`（int）和 `etag`（string，来自 UploadPart 响应头）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "file_name": "aBcDeFg...xyz.jpg",
    "media_url": "https://oss.ottohub.cn/media/aBcDeFg...xyz.jpg"
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `invalid_file_name`: file_name 不属于当前用户
- `invalid_parts`: 分片信息无效
- `system_error`: 系统错误

**注意**:
- 完成后可继续调用 §14 上传媒体元数据，`media_url` 使用返回的地址即可

---

### 14. 上传媒体元数据

**请求**: `POST /api/media/upload`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `title` (string, 必需): 媒体标题（最大50字符）
- `intro` (string, 必需): 媒体简介（最大500字符）
- `tag` (string, 必需): 媒体标签（最大200字符，多个标签用#分隔，最多10个）
- `original_source` (string, 条件必需): 原始来源（最大500字符）。`copyright_type=1`（原创/自制）时可省略或传空字符串，缺省记为 `"-"`；转载/其他时必填
- `media_type` (string, 必需): 媒体类型（最大15字符）
- `copyright_type` (int, 必需): 版权类型（1-原创，2-转载，3-其他）
- `media_url` (string, 必需): 媒体文件URL（前端通过预签名URL上传后得到）
- `archive_directory` (string, 必需): 归档目录（前端生成）
- `file_size` (int, 必需): 文件大小（字节，前端生成）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 100,
    "media_url": "https://file.ottohub.cn/media/1234567890_1234_123.jpg"
  }
}
```

**响应字段说明**:
- `media_id`: 新创建的媒体ID
- `media_url`: 媒体文件URL

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `warn`: 包含敏感词
- `title_too_long`: 标题过长
- `intro_too_long`: 简介过长
- `tag_too_long`: 标签过长
- `original_source_too_long`: 原始来源过长
- `media_type_too_long`: 媒体类型过长
- `error_type`: 参数类型错误
- `original_source_too_short`: 原始来源过短
- `error_tag`: 标签格式错误
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 上传成功
- `400`: 参数错误或验证失败
- `401`: Token无效或未提供
- `500`: 系统错误

**注意**:
- 此接口仅上传媒体元数据，文件本身已通过预签名URL上传
- `extension` 和 `file_name` 会从 `media_url` 中自动提取
- 标签会自动处理，最多保留前10个有效标签
- 媒体默认审核状态为通过（1）
- 自制素材（`copyright_type=1`）可不填 `original_source`，缺省或空字符串时记为 `"-"`

---

### 15. 更新媒体元数据

**请求**: `POST /api/media/{media_id}/update`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `title` (string, 可选): 媒体标题（最大50字符）
- `intro` (string, 可选): 媒体简介（最大1000字符）
- `tag` (string, 可选): 媒体标签（最大200字符，多个标签用#分隔，最多10个）

**成功响应**:
```json
{
  "status": "success"
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_media_id`: 媒体ID不存在或无效
- `media_not_owned`: 媒体不属于当前用户
- `warn`: 包含敏感词
- `title_too_long`: 标题过长
- `intro_too_long`: 简介过长
- `tag_too_long`: 标签过长
- `error_tag`: 标签格式错误
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 更新成功
- `400`: 参数错误或验证失败
- `401`: Token无效或未提供
- `403`: 媒体不属于当前用户
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- 此接口仅更新媒体元数据，不修改文件本身
- 只有媒体作者可以更新自己的媒体
- 可以只更新部分参数，不需要提供所有参数
- 更新后媒体状态会变为待审核（1）
- 标签会自动处理，最多保留前10个有效标签

---

### 16. 设置对象存储key

**请求**: `POST /api/media/{media_id}/set_object_key`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `type` (string, 必需): 类型（"media"-发布的媒体，"favorite"-收藏的媒体）
- `object_key` (string, 必需): 对象存储key（空字符串表示根目录）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_id": 1,
    "object_key": "media/2024/03/image.jpg"
  }
}
```

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_type`: 参数类型错误
- `invalid_object_key`: object_key 格式无效
- `error_media_id`: 媒体ID不存在或无效
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 设置成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `404`: 媒体不存在
- `500`: 系统错误

**注意**:
- `type` 为 "media" 时，设置本人发布的媒体目录
- `type` 为 "favorite" 时，设置本人收藏的媒体目录
- 空字符串 `""` 表示根目录
- `object_key` 格式规范：
  - 总长度最多 500 字
  - 最多 10 级目录层级
  - 单节目录名称长度最多 50 字
  - 不以 `/` 开头
  - 不以 `/` 结尾
  - 不包含连续的 `//`
  - 支持汉字、英文、日语、韩语等可见字符
  - 示例：`媒体/2024年3月`、`folder/subfolder`、`root`、`画像/春`
- 只有媒体作者或收藏者可以设置对应的 `object_key`

---

### 17. 获取目录列表

**请求**: `POST /api/media/directory_list`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `type` (string, 必需): 类型（"media"-发布的媒体，"favorite"-收藏的媒体）
- `object_key` (string, 必需): 对象存储key（空字符串表示根目录）

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "object_key": "媒体/2024年3月",
    "directories": [
      {
        "name": "图片",
        "type": "directory"
      },
      {
        "name": "视频",
        "type": "directory"
      }
    ],
    "files": [
      {
        "media_id": 1,
        "name": "示例图片",
        "extension": "jpg",
        "file_size": 1024000,
        "created_at": "2024-03-07 12:00:00",
        "audit_status": 1,
        "type": "file"
      }
    ]
  }
}
```

**响应字段说明**:
- `object_key`: 当前目录的 object_key
- `directories`: 子目录列表
  - `name`: 目录名称
  - `type`: 类型（固定为 "directory"）
- `files`: 当前目录下的文件列表
  - `media_id`: 媒体ID
  - `name`: 媒体标题
  - `extension`: 文件扩展名
  - `file_size`: 文件大小（字节）
  - `created_at`: 创建时间
  - `audit_status`: 审核状态（0-待审核，1-已通过，2-已拒绝）
  - `type`: 类型（固定为 "file"）

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_type`: 参数类型错误
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `500`: 系统错误

**注意**:
- `type` 为 "media" 时，返回本人发布的媒体目录结构，不限制审核状态
- `type` 为 "favorite" 时，返回本人收藏的媒体目录结构，只包含已审核通过的内容
- 空字符串 `""` 表示根目录
- 返回当前目录下的直接子目录和文件
- 不包含更深层的嵌套内容

---

### 18. 获取自己发送的内容列表

**请求**: `POST /api/media/manage`

**请求参数** (Body):
- `token` (string, 必需): 用户Token
- `offset` (int, 可选): 偏移量，默认0
- `num` (int, 可选): 返回数量，默认20，最大100
- `search_term` (string, 可选): 搜索关键词，支持模糊匹配标题、简介、标签
- `media_id_desc` (int, 可选): 按媒体ID降序排序（最新优先），1-启用，0-不启用，默认0
- `media_id_asc` (int, 可选): 按媒体ID升序排序（最旧优先），1-启用，0-不启用，默认0

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "media_list": [
      {
        "media_id": 1,
        "uid": 123,
        "extension": "jpg",
        "title": "示例图片",
        "tag": "风景#旅游",
        "original_source": "https://example.com/source.jpg",
        "media_type": "image",
        "copyright_type": 1,
        "file_size": 1024000,
        "created_at": "2024-03-07 12:00:00",
        "audit_status": 1,
        "object_key": "媒体/2024年3月",
        "file_url": "https://example.com/media/1.jpg",
        "username": "user123",
        "avatar_url": "https://example.com/avatar.jpg",
        "if_favorite": 0
      }
    ],
    "total_count": 50
  }
}
```

**响应字段说明**:
- `media_list`: 媒体列表
  - `media_id`: 媒体ID
  - `uid`: 用户ID
  - `extension`: 文件扩展名
  - `title`: 标题
  - `tag`: 标签
  - `original_source`: 原始来源
  - `media_type`: 媒体类型
  - `copyright_type`: 版权类型
  - `file_size`: 文件大小（字节）
  - `created_at`: 创建时间
  - `audit_status`: 审核状态（0-待审核，1-已通过，2-已拒绝）
  - `object_key`: 对象存储key
  - `file_url`: 文件URL
  - `username`: 用户名
  - `avatar_url`: 头像URL
  - `if_favorite`: 是否已收藏（0-未收藏，1-已收藏）
- `total_count`: 总数量

**错误码**:
- `missing_argument`: 缺少必需参数
- `error_token`: Token无效或已过期
- `error_type`: 参数类型错误
- `too_big_num`: num超过100
- `system_error`: 系统错误

**HTTP状态码**:
- `200`: 获取成功
- `400`: 参数错误
- `401`: Token无效或未提供
- `500`: 系统错误

**注意**:
- 只返回自己发送的内容
- `is_deleted != 1` 的内容都会返回（包括已删除但未彻底删除的）
- 不限制审核状态，可以看到待审核、已通过、已拒绝的所有内容
- 相比 search 功能，多了一个 `audit_status` 返回值
- `media_id_desc` 和 `media_id_asc` 同时传入时，按默认排序（media_id DESC）
- 有 `search_term` 时，默认按相似度排序（标题匹配 > 标签匹配 > 简介匹配）

---

## 接口使用流程示例

### 搜索媒体流程

1. **搜索媒体**
   ```
   GET /api/media/search?search_term=风景&num=10
   ```

2. **获取搜索结果**

### 收藏媒体流程

1. **收藏媒体**
   ```
   POST /api/media/1/favorite
   Body: { "token": "abc123def456..." }
   ```

2. **获取收藏状态**

### 审核媒体流程

1. **获取待审核媒体列表**
   ```
   GET /api/media/audit?token=abc123def456...&num=10
   ```

2. **批准媒体**
   ```
   POST /api/media/1/approve
   Body: { "token": "abc123def456..." }
   ```

3. **或拒绝媒体**
   ```
   POST /api/media/1/reject
   Body: { "token": "abc123def456..." }
   ```

---

### 完整媒体上传流程

1. **获取预签名URL**
   ```
   GET /api/media/presigned?token=abc123def456...&extension=jpg
   ```
   响应：
   ```json
   {
     "status": "success",
     "data": {
       "url": "https://example.r2.cloudflarestorage.com/bucket/media/1234567890_1234_123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
       "file_name": "1234567890_1234_123.jpg"
     }
   }
   ```

2. **前端上传文件**
   使用返回的预签名URL进行PUT请求上传文件
   ```
   PUT https://example.r2.cloudflarestorage.com/bucket/media/1234567890_1234_123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
   Body: [文件二进制数据]
   ```

3. **上传媒体元数据**
   ```
   POST /api/media/upload
   Body: {
     "token": "abc123def456...",
     "title": "示例图片",
     "intro": "这是一张示例图片",
     "tag": "#示例#图片",
     "original_source": "网络",
     "media_type": "图片",
     "copyright_type": 1,
     "media_url": "https://file.ottohub.cn/media/1234567890_1234_123.jpg",
     "archive_directory": "{\"file_list\":[{\"filename\":\"djgun.jpg\",\"file_size\":5194442,\"compressed_size\":5144596,\"is_directory\":false}]}",
     "file_size": 1024000
   }
   ```
   响应：
   ```json
   {
     "status": "success",
     "data": {
       "media_id": 100,
       "media_url": "https://file.ottohub.cn/media/1234567890_1234_123.jpg"
     }
   }
   ```

---

### 分片媒体上传流程（大文件加速）

1. **获取分片预签名 URL**
   ```
   GET /api/media/presigned_multipart?token=abc123...&extension=mp4&part_count=4
   ```

2. **并行上传各分片**
   按 `parts` 数组，对每个 `url` 发 PUT，Body 为对应文件字节区间；记录响应头 `ETag`

3. **完成分片合并**
   ```
   POST /api/media/multipart_complete
   Body: {
     "token": "abc123...",
     "file_name": "aBcDeFg...xyz.mp4",
     "upload_id": "abc123uploadid",
     "parts": [
       { "part_number": 1, "etag": "\"etag1\"" },
       { "part_number": 2, "etag": "\"etag2\"" }
     ]
   }
   ```

4. **上传媒体元数据**（同 §14，`media_url` 使用上一步返回的地址）

---

## 安全说明

1. **权限控制**:
   - 媒体删除：仅媒体作者可操作
   - 媒体申诉：仅媒体作者可操作
   - 媒体审核：仅审核员可操作
   - 媒体举报：需要500经验值

2. **Token安全**:
   - Token用于身份认证
   - 敏感操作需要提供有效的token
   - Token应妥善保管，不要泄露

3. **参数验证**:
   - 所有输入参数都会进行类型验证
   - 对数值参数有合理的范围限制

---

## 常见问题

**Q: 为什么无法删除媒体？**
A: 只有媒体作者可以删除自己的媒体，且媒体必须存在且未被删除。

**Q: 为什么无法申诉媒体？**
A: 只有媒体作者可以申诉自己的媒体，且媒体必须处于拒绝状态。

**Q: 为什么无法举报媒体？**
A: 举报媒体需要至少500经验值，且媒体必须存在且处于通过状态。

**Q: 为什么无法审核媒体？**
A: 只有审核员可以审核媒体，且媒体必须处于待审核状态。

**Q: 收藏功能如何工作？**
A: 收藏接口为切换状态，调用一次收藏，再调用一次取消收藏。收藏状态变更会更新媒体的收藏数。