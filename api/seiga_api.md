# Seiga 静画区 API 文档

> 面向前端：本文档按「先懂规则 → 再查接口 → 再查字段」组织。

---

## 1. 基础信息

| 项 | 值 |
|----|-----|
| 基础路径 | `/api/seiga` |
| 编码 | UTF-8 |
| 响应 | JSON `{ "status": "success"\|"error", "data"?: ..., "message"?: "错误码" }` |
| GET 认证 | Query `token=...`（可选） |
| POST/PUT/PATCH/DELETE | Body JSON `{ "token": "..." }`；`multipart` 投稿用表单字段 `token` |
| PUT / PATCH | 等价，均可使用 |

**与 Blog/Video 的差异**：
- 无点赞；收藏唯一机制为 **Clip 收藏夹**（`favorite_count` = 按 UID 去重的收藏人数）
- 无 `channel_id`；不接入 Channel
- **不**接入全局 `GET /api/following/timeline`；静画专用 `GET /api/seiga/following/timeline`
- 投稿唯一入口：`POST /api/seiga/publish`（multipart）
- `is_gore` 由 `profile.show_seiga_gore` 控制可见与检索

**关联模块**（本文档不展开，见对应 md）：
- 评论 → `comment_api.md`（`GET /api/comment/seigas/{sid}`；列表项含 `child_comment_num` 回复数，与视频评论字段对齐；另返回 `total_count`）
- 审核/举报/申诉 → `moderation_api.md`
- 作者合集 → `collection_api.md`（`/api/collection/seigas/...`）

---

## 2. 前端速查：全部路由

| 方法 | 路径 | 登录 | 说明 |
|------|------|------|------|
| GET | `/new` | 可选 | 最新列表 |
| GET | `/popular` | 可选 | 热门（收藏+播放） |
| GET | `/ranking` | 可选 | 时间窗排行榜 |
| GET | `/random` | 可选 | 随机（无 offset） |
| GET | `/search` | 可选 | 关键词+标签搜索 |
| POST | `/query` | 可选 | 结构化检索 DSL |
| GET | `/user/{uid}` | 可选 | 某用户公开作品 |
| GET | `/related/{sid}` | 可选 | 标签相关推荐 |
| GET | `/hall` | 可选 | 殿堂作品列表 |
| GET | `/following/timeline` | **必须** | 关注的人发的静画 |
| GET | `/{sid}` | 可选 | 作品详情 |
| GET | `/{sid}/tags` | 可选 | 标签列表 |
| POST | `/publish` | **必须** | 投稿 |
| PUT/PATCH | `/{sid}` | **必须** | 改标题/简介（作者） |
| DELETE | `/{sid}` | **必须** | 删除（作者） |
| POST | `/{sid}/tags` | **必须** | 添加标签 |
| PUT/PATCH | `/{sid}/tags/{tag_id}` | **必须** | 作者锁定/解锁标签 |
| DELETE | `/{sid}/tags/{tag_id}` | **必须** | 删除标签 |
| GET | `/tags/popular` | 否 | 全站标签热门榜 |
| POST | `/view-history` | 可选 | 记录浏览 |
| GET | `/history-list` | **必须** | 浏览历史列表 |
| GET | `/manage-list` | **必须** | 作者作品管理列表 |
| GET | `/clips` | **必须** | 我的收藏夹 |
| GET | `/clips/default` | **必须** | 默认收藏夹 |
| GET | `/clips/public` | 可选 | 公开收藏夹广场 |
| GET | `/clips/{clip_id}` | 可选 | 收藏夹详情+作品 |
| POST | `/clips` | **必须** | 创建收藏夹 |
| PUT/PATCH | `/clips/{clip_id}` | **必须** | 更新收藏夹 |
| DELETE | `/clips/{clip_id}` | **必须** | 删除收藏夹 |
| POST | `/clips/default/items` | **必须** | 收藏到默认夹 |
| POST | `/clips/{clip_id}/items` | **必须** | 添加作品到收藏夹 |
| DELETE | `/clips/{clip_id}/items/{sid}` | **必须** | 从收藏夹移除 |
| POST | `/hall/{sid}` | 管理员 | 提名殿堂 |
| DELETE | `/hall/{sid}` | 管理员 | 取消殿堂 |

---

## 3. 数值与上限（常量）

| 常量 | 值 | 说明 |
|------|-----|------|
| 列表 `num` 默认 / 最大 | 20 / **50** | `/random` 仅 `num` |
| Query `limit` 最大 | **100** | `POST /query` |
| 历史列表 `num` 默认 | **30** | 最大仍 50 |
| 单作品标签总数 | **10** | 投稿+发布后合计 |
| 单作品锁定标签 | **5** | 投稿或作者 PUT 锁定 |
| 单次添加标签 | **1–3** | `POST /{sid}/tags` |
| 标签操作冷却 | **2 秒** | 同一用户对同一作品：增/删/锁/解锁共享 |
| 标签名长度 | **30** 字 | UTF-8 |
| 投稿图片数 | **1–30** | |
| 单张原图大小 | **10 MB** | |
| 标题 / 简介 | **1–100** / **≤500** 字 | |
| 用户收藏夹数 | **50**（含默认夹） | |
| 收藏夹标题 / 描述 | **≤50** / **≤200** 字 | |

**允许的图片 MIME**：`image/jpeg`、`image/png`、`image/gif`、`image/webp`、`image/apng`（及常见别名如 `image/pjpeg`）。

---

## 4. HTTP 状态码

| 码 | 典型 message |
|----|----------------|
| 200 | 成功 |
| 400 | `error_type`、`missing_argument`、`error_tag`、`too_many_tags` 等 |
| 401 | `error_token` |
| 403 | `no_permission`、`gore_not_allowed`、`tag_locked`、`query_field_forbidden`、`admin_required` |
| 404 | `error_sid`、`clip_not_found` |
| 409 | `tag_already_exists` |
| 429 | `too_fast` |
| 500 | `system_error` |

---

## 5. 错误码（完整）

| message | HTTP | 说明 |
|---------|------|------|
| `error_token` | 401 | Token 无效或未传 |
| `error_uid` | 400 | 用户不存在 |
| `error_sid` | 404 | 作品不存在或当前用户不可见 |
| `error_type` | 400 | 参数类型非法 |
| `missing_argument` | 400 | 缺少必需字段 |
| `field_forbidden` | 400 | 传了不允许的字段 |
| `too_big_num` | 400 | `num`/`limit` 超限 |
| `gore_not_allowed` | 403 | 未开 `show_seiga_gore` 却请求 gore |
| `no_permission` | 403 | 无权限（如非作者锁标签） |
| `admin_required` | 403 | 需管理员（殿堂） |
| `system_error` | 500 | 服务器错误 |
| `hall_not_eligible` | 400 | 作品未过审或已删，不可提名殿堂 |
| `error_tag` | 400 | 标签格式/数量/名称/`lock_sort` 非法 |
| `too_many_tags` | 400 | 作品标签 >10 |
| `too_many_locked_tags` | 400 | 锁定标签 >5 |
| `tag_locked` | 403 | 非作者删锁定标签 |
| `tag_already_exists` | 409 | 重复添加同一标签 |
| `error_sensitive_tag` | 400 | 发布后 ADD 标签名敏感词 |
| `too_fast` | 429 | 标签操作 2 秒冷却 |
| `error_span` | 400 | 排行榜 `span` 非法 |
| `error_title` | 400 | 标题空或超长 |
| `error_pages` | 400 | 未上传图片 |
| `too_many_pages` | 400 | 图片 >30 |
| `file_too_large` | 400 | 单张 >10MB |
| `invalid_image_format` | 400 | MIME/格式不在白名单 |
| `upload_failed` | 400 | 上传失败 |
| `query_field_forbidden` | 403 | Query 字段无权限 |
| `query_op_forbidden` | 403 | Query 运算符不允许 |
| `query_too_complex` | 400 | 嵌套过深或 or 过多 |
| `too_many_clips` | 400 | 收藏夹 >50 |
| `default_clip_undeletable` | 400 | 默认夹不可删 |
| `clip_not_found` | 404 | 收藏夹不存在或非本人 |

---

## 6. 作品可见性（前端必读）

`audit_status`：`0` 待审 · `1` 通过 · `2` 驳回。

| 场景 | 谁能看到 |
|------|----------|
| 公共列表 / 搜索 / Query P0 | 仅已过审且未删除；不传 `is_gore` 时 0/1 都可出（无权看 gore 的由护栏剔除） |
| 详情 `GET /{sid}` | 过审作品；**作者/审核员**可见自己的待审/驳回/已删除作品 |
| `is_gore=1` | 作者、审核员、或 `show_seiga_gore=1` 的登录用户 |
| 拉黑 | 有效 `token` 时列表排除**我拉黑的人**；访问被拉黑作者详情 → `error_sid` |
| 标签增删 | 作品未删除即可，**不限**审核状态与 gore（比详情更宽） |
| 收藏 | 仅已过审且未删除 |
| 殿堂公共列表 | `is_hall=1` 且过审未删 |

---

## 7. 公共列表

### 7.1 Query 参数

适用于：`/new`、`/popular`、`/ranking`、`/search`、`/user/{uid}`、`/hall`、`/following/timeline`、`/related/{sid}`、`/clips/{clip_id}` 内嵌列表等。

| 参数 | 默认 | 说明 |
|------|------|------|
| `offset` | 0 | 偏移（`/random` **不支持**） |
| `num` | 20 | 1–50 |
| `token` | — | 可选；拉黑过滤 |
| `is_gore` | — | 不传=不过滤（0/1 都返回）；`0`=仅全年龄；`1`=仅猎奇（须登录且 `show_seiga_gore=1`） |
| `is_fanwork` | — | 0/1 筛选同人 |
| `is_hall` | — | 0/1 筛选殿堂 |

### 7.2 敏感词与条数

所有主要列表会在分页前做敏感词、gore 权限、拉黑等过滤；极端情况下返回条数可能略少于请求的 `num`。

### 7.3 列表卡片 `seiga_list[]`

| 字段 | 说明 |
|------|------|
| `sid` / `uid` | 作品 / 作者 |
| `title` / `description` | 标题 / 简介 |
| `cover_url` / `cover_preview_url` | 封面原图 / 预览；**投稿后 5 分钟内**预览图未就绪时 `cover_preview_url` 回退为 `cover_url` 原图 |
| `page_count` / `width` / `height` | 页数 / 封面尺寸 |
| `is_fanwork` / `is_ai` / `is_gore` / `is_hall` | 标志 |
| `hall_at` | 殿堂时间（可 null） |
| `time` | 发布时间 |
| `favorite_count` / `view_count` | 收藏人数（UID 去重）/ 播放量 |
| `collection` / `collection_sort_order` | 作者合集 |
| `author` | `{ uid, username, avatar_url }` |
| `comment_count` | 已过审评论总数（含回复） |

排行榜额外：`delta_favorite_count`、`delta_view_count`。相关推荐额外：`tag_overlap`、`weighted_overlap`、`similarity_score`。

---

## 8. 浏览与详情

### 8.1 作品详情

`GET /api/seiga/{sid}?token={token}`

**成功 `data` 主要字段**：

| 字段 | 说明 |
|------|------|
| `pages[]` | `{ page_no, original_url, preview_url, ... }`；投稿 **5 分钟内** `preview_url` 回退 `original_url` |
| `tags[]` | `{ tag_id, tag_name, is_locked, lock_sort, added_by_uid }` |
| `tag_names_display[]` | 展示顺序：锁定按 `lock_sort` → 未锁定按 `created_at` |
| `author` | 作者信息，见下表 |
| `view_count` | 播放量（登录看过审作品后按日去重已 +1，返回最新值） |
| `comment_count` | 已过审且未删评论总数（含回复，实时 COUNT） |
| `saved_clip_ids[]` / `is_in_default_clip` | 登录用户收藏状态 |
| `audit_status` | 作者/审核员可见非过审状态 |

**`author` 字段**（详情专用，列表卡片仍为简版）：

| 字段 | 说明 |
|------|------|
| `uid` | 作者 UID |
| `nickname` | 用户名（`user.username`） |
| `avatar_url` | 头像 |
| `intro` | 作者简介（`user.intro`） |
| `follow_status` | 当前浏览者与作者的关系；无 token 为 `-1` |

`follow_status` 取值（与 `is_following()` 一致）：

| 值 | 含义 |
|----|------|
| `-1` | 未登录 |
| `0` | 浏览者即作者本人 |
| `1` | 互不关注 |
| `2` | 我关注了作者 |
| `3` | 作者关注了我 |
| `4` | 互相关注 |

**播放量与历史**：登录用户查看已过审作品（`audit_status=1`）时，**一律**写入/刷新浏览历史，并按日去重 +1 `view_count`。无 `no_history` 参数。
### 8.2 记录浏览

`POST /api/seiga/view-history` — `{ "token", "sid" }`  
匿名成功但不写入；登录写入历史并计播放。

### 8.3 浏览历史

`GET /api/seiga/history-list?token=...&offset=0&num=30`  
返回 `seiga_list[]`（标准卡片 + `updated_at` 历史时间），仅含仍过审未删作品。

### 8.4 相关推荐

`GET /api/seiga/related/{sid}?offset=0&num=20`

- 参考作品不可见 → 空列表（200，非 404）
- 参考作品无标签 → 空列表
- Jaccard 相似度 + 锁定标签加权 1.5；强制 `is_gore=0`

### 8.5 简易搜索

`GET /api/seiga/search?q=&tag=&locked_tag=&uid=&...`

- `q` 最多 100 字；有 `q` 时标题匹配优先
- `uid` 筛作者
- `tag` / `locked_tag` 格式见 §10.4

### 8.6 排行榜

`GET /api/seiga/ranking?span=hourly|daily|weekly|monthly|total&offset=0&num=20`

- 默认 `span=daily`
- 非 `total`：时间窗内收藏增量优先、浏览增量次要
- `total`：全时段 `favorite_count DESC`

### 8.7 随机

`GET /api/seiga/random?num=20` — 无 `offset`，随机返回。

### 8.8 用户作品

`GET /api/seiga/user/{uid}` — 若 viewer 已拉黑该 uid，返回空列表（200）。

### 8.9 作者管理列表

`GET /api/seiga/manage-list?token=...&offset=0&num=20`

返回作者**全部未删除**作品（含待审/驳回/通过），列表字段与 §7.3 卡片一致（含 `width` / `height` 封面尺寸），另含 `audit_status`、`comment_count`；`manage_seiga_count` 为总数。

---

## 9. 结构化检索 Query

`POST /api/seiga/query` — Content-Type: `application/json`

```json
{
  "token": "可选",
  "filter": { "and": [ { "field": "title", "op": "contains", "value": "猫" } ] },
  "sort": [{ "field": "view_count", "order": "desc" }],
  "select": ["sid", "title", "tags"],
  "offset": 0,
  "limit": 50
}
```

**filter 叶子**：`{ "field", "op", "value" }`；支持嵌套 `and` / `or`（深度 ≤3，单 `or` 分支 ≤10）。

**常用 field**：`sid`, `uid`, `title`, `description`, `is_fanwork`, `is_hall`, `is_ai`, `is_gore`, `time`, `favorite_count`, `view_count`, `tag`, `locked_tag`, `unlocked_tag`, …

**运算符**：`eq` `ne` `in` `not_in` `gt` `gte` `lt` `lte` `between` `contains` `not_contains` `starts_with` `ends_with` `has` `has_any` `has_all` `is_null` `is_not_null`

**权限档位**：

| 档位 | 条件 | 能力 |
|------|------|------|
| P0 | 无 token | 强制过审+未删；未筛 gore 时强制 `is_gore=0` |
| P1 | 有效 token | P0；已开 `show_seiga_gore` 时未筛 gore 可出 0/1；可显式筛 `is_gore=1` |
| P2 | filter 目标 uid=本人 | 可查自己待审/驳回；可不强制 gore=0 |
| P4 | 审核员 | 无 audit/is_deleted/gore 限制 |

未授权字段 → `403 query_field_forbidden`（整单拒绝）。

**响应**：`{ tier, total, total_unfiltered, items[], applied_guard }`  
敏感词生效时 `total=null`，`total_unfiltered` 为未过滤前的总数。

---

## 10. 标签系统（重点）

### 10.1 设计概览

```
投稿时：作者一次性写入 1–10 个标签，可选锁定 ≤5 个（带 lock_sort 1–5）
发布后：
  · 任何登录用户 → 添加未锁定标签、删除未锁定标签
  · 作者额外 → 锁定/解锁任意已有标签、删除含锁定在内的任意标签
  · 锁定标签 → 非作者不可删（tag_locked）
  · 作品未删除即可操作（不限审核状态）；标签可删至 0 个（仅投稿时要求 ≥1）
```

### 10.2 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/{sid}/tags` | 标签列表 |
| POST | `/{sid}/tags` | 添加 1–3 个未锁定标签 |
| PUT/PATCH | `/{sid}/tags/{tag_id}` | 作者锁定/解锁 |
| DELETE | `/{sid}/tags/{tag_id}` | 删标签 |
| GET | `/tags/popular` | 全站标签榜 |

**GET `/{sid}/tags` 可见性**：登录用户同社区规则（未删即可）；匿名仅看过审且可见的作品。

### 10.3 投稿 tags（multipart）

字段 `tags` = **JSON 数组字符串**：

```json
[
  { "name": "原创", "locked": true, "lock_sort": 1 },
  { "name": "风景", "locked": false }
]
```

| 字段 | 说明 |
|------|------|
| `name` | 必填，trim 非空，≤30 字 |
| `locked` | 可选，默认 false |
| `lock_sort` | `locked=true` 时必填，1–5 且不重复 |

`locked=false` 时忽略 `lock_sort`。重复 `name` 静默去重。

### 10.4 发布后添加

`POST /api/seiga/{sid}/tags`

```json
{ "token": "...", "tag": "MMD" }
```
或
```json
{ "token": "...", "tags": ["MMD", "厚涂"] }
```

- 纯字符串名，**不是** `{ name, locked }` 对象
- 新标签均为 `is_locked=0`；敏感词 → `error_sensitive_tag`（不写日志）
- 并发安全：服务端事务内校验总数 ≤10

### 10.5 作者锁定/解锁

`PUT /api/seiga/{sid}/tags/{tag_id}`

锁定：
```json
{ "token": "...", "locked": true, "lock_sort": 2 }
```
解锁：
```json
{ "token": "...", "locked": false }
```

| 规则 | 说明 |
|------|------|
| 权限 | 仅作者；否则 `no_permission` |
| 前置 | 作品未删除即可（**不限**审核状态，待审/驳回也可 lock/unlock） |
| `lock_sort` | 可选；省略则自动分配最小可用 1–5 |
| 幂等 | 已锁定且 `lock_sort` 不变（或未传且序号有效）→ 成功，**不写日志、不占 2 秒冷却** |
| 冷却 | 增/删/锁/解锁成功操作共享 2 秒（幂等锁定除外） |
| 并发 | 事务 + 行锁，锁定总数严格 ≤5 |

**成功响应**（增/删/锁共用）：

```json
{
  "status": "success",
  "data": {
    "sid": 10001,
    "tags": [
      { "tag_id": 1, "tag_name": "原创", "is_locked": true, "lock_sort": 1, "added_by_uid": 42 },
      { "tag_id": 12, "tag_name": "MMD", "is_locked": false, "lock_sort": null, "added_by_uid": 99 }
    ],
    "tag_names_display": ["原创", "MMD"]
  }
}
```

### 10.6 删除标签

`DELETE /api/seiga/{sid}/tags/{tag_id}` — Body: `{ "token" }`  
响应格式同 §10.5。非作者删锁定 → `tag_locked`。允许删至 **0** 个标签（无发布后下限）。

### 10.7 搜索/tag 参数格式

`tag` / `locked_tag` 支持：
- `tag=风景`
- `tag=风景,少女`
- `tag=["风景","少女"]`

最多 10 个名；`locked_tag` 仅匹配**当前** `is_locked=1` 的标签。

### 10.8 标签热门

`GET /api/seiga/tags/popular?offset=0&num=20` → `tag_list[]`: `{ tag_id, tag_name, use_count }`

---

## 11. 投稿与编辑

### 11.1 发布

`POST /api/seiga/publish` — `multipart/form-data`

| 字段 | 必需 | 说明 |
|------|------|------|
| `token` | 是 | |
| `title` | 是 | 1–100 字 |
| `description` | 否 | ≤500 字 |
| `tags` | 是 | JSON 字符串，§10.3 |
| `files[]` | 是 | 1–30 张图片 |
| `is_fanwork` / `is_ai` / `is_gore` | 否 | 0/1，默认 0 |
| `cover_page_no` | 否 | 默认 1 |

**禁止**：`is_hall`、`sid`、`pages` 等 → `field_forbidden`

**成功**：

```json
{
  "status": "success",
  "data": {
    "sid": 10001,
    "title": "...",
    "page_count": 2,
    "cover_page_no": 1,
    "audit_status": 1,
    "if_warn": 0
  }
}
```

- 标题/简介/投稿 tags 命中敏感词 → 仍成功，`audit_status=0`，`if_warn=1`，不进公共列表
- 经验 +50 与审核结果无关

### 11.2 更新

`PUT /api/seiga/{sid}` — `{ "token", "title"?, "description"? }`（至少一项）

- 仅 `title` / `description`
- 敏感词 → `audit_status=0`；未命中 → 审核状态不变

### 11.3 删除

`DELETE /api/seiga/{sid}` — `{ "token" }` → `{ "status": "success" }`（无 data）；删除后作品不可见。

---

## 12. 收藏夹 Clip

### 12.1 概念

- 每用户首次访问 clips 自动创建**默认收藏夹**（`is_default=1`，不可删）
- `favorite_count`：按**用户 UID** 去重；同一用户收藏多个夹仍计 1；从**全部**收藏夹移除后才 −1
- 仅过审未删作品可收藏

### 12.2 收藏夹卡片 `clip`

`{ clip_id, uid, title, description, is_default, is_public, sort_order, item_count, created_at, updated_at }`

### 12.3 创建

`POST /api/seiga/clips`

```json
{ "token", "title", "description"?, "is_public"?: 0|1, "sort_order"?: 0 }
```

标题必填 ≤50 字；不可传 `is_default` / `clip_id`。

### 12.4 更新

`PUT /api/seiga/clips/{clip_id}` — 可改 `title`、`description`、`is_public`、`sort_order`。

### 12.5 删除

`DELETE /api/seiga/clips/{clip_id}` — 默认夹 → `default_clip_undeletable`；删除时按 UID 重算各作品 `favorite_count`。

### 12.6 添加作品

`POST /api/seiga/clips/{clip_id}/items` 或 `POST /api/seiga/clips/default/items`

```json
{ "token", "sid": 10001 }
```

**成功**：

```json
{ "status": "success", "data": { "clip_id": 1, "sid": 10001, "favorite_count": 42 } }
```

重复添加同一夹 → 幂等成功。

### 12.7 移除作品

`DELETE /api/seiga/clips/{clip_id}/items/{sid}` — Body: `{ "token" }`  
返回更新后的 `favorite_count`。

### 12.8 详情

`GET /api/seiga/clips/{clip_id}?token=...&offset=0&num=20`

```json
{
  "status": "success",
  "data": {
    "clip": { "...": "..." },
    "seiga_list": [ /* 标准卡片 */ ]
  }
}
```

非公开夹：仅主人可查看；他人 → `clip_not_found`。

### 12.9 公开广场

`GET /api/seiga/clips/public?sort=updated|item_count|favorite&offset=0&num=20`

---

## 13. 殿堂

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/hall` | `is_hall=1` 列表，按 `hall_at DESC` |
| POST | `/hall/{sid}` | 管理员提名（须过审）→ 非管理员 `403 admin_required` |
| DELETE | `/hall/{sid}` | 管理员取消 |

公共 API **不返回** `hall_by_uid`。驳回不自动清殿堂元数据，但公共列表不展示直至重新过审。

---

## 14. 静画关注流

`GET /api/seiga/following/timeline?token=...&offset=0&num=20` — **须登录**

```json
{
  "status": "success",
  "data": {
    "timeline_list": [
      {
        "content_type": "seiga",
        "sid": 10001,
        "uid": 42,
        "title": "标题",
        "cover_preview_url": "https://...",
        "width": 1920,
        "height": 1080,
        "is_hall": 1,
        "time": "2026-08-10 12:00:00"
      }
    ]
  }
}
```

无关注或关注者无作品 → 空数组。不写入全局 `/api/following/timeline`。

---

## 15. Profile 扩展

`show_seiga_gore`（0/1，默认 0）：Profile 更新接口设置。为 `1` 时登录用户可在列表不传 `is_gore` 时同时看到猎奇，以及显式传 `is_gore=1` 仅看猎奇。

---

## 16. 前端集成建议

### 16.1 详情页

1. `GET /{sid}?token` 拉详情 + 收藏状态（登录看过审作品会记播放与历史）
2. 标签 UI：区分 `is_locked` 样式；作者显示锁/解锁；所有人可编辑未锁定
3. 标签编辑流见下节

### 16.2 标签编辑流

```
添加：POST /{sid}/tags { tags: ["新标签"] }
删除：DELETE /{sid}/tags/{tag_id}
作者锁定：PUT /{sid}/tags/{tag_id} { locked: true, lock_sort?: n }
作者解锁：PUT /{sid}/tags/{tag_id} { locked: false }
操作成功后用返回的 data.tags 刷新 UI
注意 2 秒冷却；重复锁定同一状态可立即再请求
```

### 16.3 收藏

1. `GET /clips` 拿列表（含默认夹）  
2. 一键收藏 → `POST /clips/default/items`  
3. 详情 `saved_clip_ids` / `is_in_default_clip` 显示状态

### 16.4 待审作品

- 公共接口不可见 → 用 `manage-list` 或 `GET /{sid}`（作者身份）  
- 编辑标题简介 → `PUT /{sid}`  
- 标签仍可由社区/作者维护（即使待审）
