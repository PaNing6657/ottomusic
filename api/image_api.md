# Image 图片模块 API 文档

## 概述

图片模块提供通用图片上传能力，用于动态正文插图等场景。原 creator 模块的 `submit_image` 已迁移至本模块。

**基础信息**:
- **基础路径**: `/api/image`
- **请求格式**: `multipart/form-data`（POST）
- **响应格式**: JSON
- **认证方式**: 需登录，通过 `token` 传递
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
- `error_token`: Token 无效或已过期
- `file_not_found`: 未上传文件或上传失败
- `error_file`: 文件格式不支持
- `error_file_name`: 文件名格式非法
- `too_big_file`: 文件超过大小限制
- `no_permission`: 无权删除该图片
- `system_error`: 系统错误
- `Not found`: 接口路径不存在
- `Method not allowed`: HTTP 方法不允许

## 通用 HTTP 状态码

| HTTP 状态码 | 说明 | 常见 `message` |
|-------------|------|----------------|
| `200` | 上传成功 | — |
| `400` | 参数或文件错误 | `file_not_found`、`error_file`、`too_big_file` |
| `401` | 未登录或 Token 无效 | `error_token` |
| `403` | 无权操作 | `no_permission` |
| `404` | 接口路径不存在 | `Not found` |
| `405` | HTTP 方法不允许 | `Method not allowed` |
| `500` | 服务器内部错误 | `system_error` |

---

## 图片上传

### 1. 上传图片

**请求**: `POST /api/image/upload`

**请求参数** (Form Data):
- `token` (string, 必需): 用户认证令牌
- `file_img` (file, 必需): 图片文件

**支持格式**: `jpg`、`png`、`gif`、`webp`（按文件 MIME 类型校验）

**大小限制**: 最大 10 MB

**说明**:
- 不压缩，直接上传原图
- 返回的 `image_url` 可用于动态正文 Markdown/HTML 引用

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "image_url": "https://img.ottohub.cn/image/1710000000_1234_56.jpg",
    "file_name": "1710000000_1234_56.jpg",
    "file_size": 204800
  }
}
```

**响应字段说明**:
- `image_url`: 图片访问 URL
- `file_name`: 图片文件名
- `file_size`: 文件大小（字节）

**错误码**:
- `error_token`: Token 无效
- `file_not_found`: 未上传文件
- `error_file`: 格式不支持或不是有效图片
- `too_big_file`: 超过 10 MB
- `system_error`: 上传失败

**HTTP 状态码**:
- `200`: 上传成功
- `400`: 参数或文件错误
- `401`: Token 无效
- `500`: 系统错误

---

## 图片删除

### 2. 删除图片

**请求**: `DELETE /api/image/{file_name}`

**路径参数**:
- `file_name` (string, 必需): 上传时返回的文件名，如 `1710000000_1234_56.jpg`

**查询参数**:
- `token` (string, 必需): 用户认证令牌（也可放在 DELETE 请求体 JSON 中）

**说明**:
- 仅允许删除本人上传的图片
- 删除对象存储中的对应图片
- 也支持传入完整 URL，服务端会自动提取文件名

**成功响应**:
```json
{
  "status": "success",
  "data": {
    "file_name": "1710000000_1234_56.jpg"
  }
}
```

**错误码**:
- `error_token`: Token 无效
- `missing_argument`: 未提供文件名
- `error_file_name`: 文件名不符合命名规则
- `no_permission`: 文件名中的 uid 与当前用户不一致
- `system_error`: 删除失败

**HTTP 状态码**:
- `200`: 删除成功
- `400`: 参数错误
- `401`: Token 无效
- `403`: 无权删除
- `500`: 系统错误

---

## 与头像/封面的区别

| 模块 | 接口 | 用途 |
|------|------|------|
| **image** | `POST /api/image/upload` | 动态/正文等通用插图 |
| **image** | `DELETE /api/image/{file_name}` | 删除本人上传的通用插图 |
| **profile** | `POST /api/profile/avatar` | 用户头像（需审核） |
| **profile** | `POST /api/profile/cover` | 用户封面（需审核） |
