# OSS 标定文件自动更新：一次性配置

网页已改为直接调用 OSS ListObjectsV2，读取 `fulai_sensing_glove/calibration/` 内的 JSON 文件。默认读取子目录，忽略 ZIP 和其他扩展名，自动处理分页。

## 1. 允许读取指定目录

打开阿里云 OSS → `fulai-sensing` → 权限控制 → Bucket 授权策略。

使用同目录下 `calibration-public-read-policy.json` 的两条 Statement：

- 第一条仅允许以 `fulai_sensing_glove/calibration/` 为前缀列出文件名称、大小等信息。
- 第二条允许读取该目录里的文件，包括以后新上传、默认继承 Bucket 权限的文件。
- 不授予上传或删除权限；无需把整个 Bucket 改成公共读。

如果已有 Bucket Policy，把这两条加入原来的 Statement 数组，不要覆盖其他规则。Bucket 和账号的“阻止公共访问”不得阻止这两条规则；已有显式 Deny 仍会优先。

这会向网站访客公开该目录的文件名和内容。因此此目录只放用于公开下载的标定文件。

## 2. 配置跨域

OSS → 数据安全 → 跨域设置 → 创建规则：

- 来源：实际文档网站的 origin（协议、域名、可选端口），不含路径。例如网站部署在 `https://fulai-sensing.github.io/glove/`，这里填写 `https://fulai-sensing.github.io`。如有自定义文档域名，也要加入。
- 允许 Methods：GET、HEAD。
- 允许 Headers、暴露 Headers：当前实现不需要，可留空。
- 不需要前端访问密钥、签名或上传权限。

如果通过 CDN 代理 OSS，目录列表查询必须转发全部查询参数，包括 `list-type`、`prefix`、`encoding-type`、`max-keys`、`continuation-token`；不要缓存目录列表响应。文件同名覆盖后如有 CDN 缓存，还需刷新对应缓存。当前网页请求使用 no-store，不能代替服务端 CDN 缓存配置。

## 3. 发布和验证

提交并部署这次网页改动一次。打开网页版“源文档”或“标定与归零”，确认显示实时文件数而非权限错误。

上传一份新的 JSON 到上述目录 → 点击“刷新列表” → 确认新文件出现 → 单选下载 → 与另一文件一起勾选下载 ZIP。下载全部也会根据实时列表重新打包，不再使用历史 `calibration.zip`。

## 以后怎么更新

让有上传权限的同事把原始 JSON 上传到 `fulai_sensing_glove/calibration/`，保留清晰的手套 ID 与 Left/Right 文件名即可。不需要修改网站代码、维护文件清单、生成 ZIP 或再次部署。新文件继承上述目录读取策略即可。

网页打开时会加载最新目录；在这两个下载页面停留时每 60 秒刷新，回到浏览器标签页或进入下载章节也会刷新，并提供手动刷新按钮。删除或覆盖文件后，列表刷新会同步变化，被删除或替换的文件会取消旧勾选。列表刷新失败会明确提示并暂停打包，避免把旧列表当成最新列表。

列表按文件名判断左右手并显示 OSS 返回的大小，不推断硬件版本。实际导入仍应以 JSON 内的版本信息为准。下载时会验证 JSON 语法并保持原始字节；文件在列出后被删除时下载会报错，不输出不完整 ZIP。

这次没有代替管理员修改 OSS 权限。实际配置完成并验证前，自动更新还不能在生产环境生效。

参考官方文档：
- https://www.alibabacloud.com/help/zh/oss/developer-reference/listobjectsv2
- https://help.aliyun.com/zh/oss/user-guide/oss-bucket-policy/
- https://help.aliyun.com/zh/oss/user-guide/configure-cross-origin-resource-sharing
