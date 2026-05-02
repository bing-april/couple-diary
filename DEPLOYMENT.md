# 部署说明

这个 App 是纯静态网页，可以部署到 Netlify、Vercel、Cloudflare Pages 或任何静态网站服务。

## 推荐部署前检查

1. 在本地确认可以登录。
2. 写一篇测试日记，刷新后还在。
3. 确认双方账号都能看到同一个日记本。
4. 确认图片上传正常。
5. 确认旧数据迁移结果正常。
6. 确认 `config.js` 使用的是正确的 Supabase 项目。

## Netlify 部署

1. 登录 Netlify。
2. 选择添加新站点。
3. 选择手动上传文件夹，或连接 GitHub 仓库。
4. 如果手动上传，把整个 `情侣日记本` 文件夹上传。
5. 发布后打开 Netlify 给的网址测试。

## Vercel 部署

1. 登录 Vercel。
2. 新建项目。
3. 导入这个文件夹所在的 GitHub 仓库。
4. Framework Preset 选择 `Other`。
5. Build Command 留空。
6. Output Directory 留空或填写 `.`。
7. 部署后打开网址测试。

## Supabase Auth 设置

部署后，如果使用邮箱确认链接，需要在 Supabase 里加线上网址：

1. 进入 Supabase 项目。
2. 打开 Authentication。
3. 打开 URL Configuration。
4. Site URL 填线上网址。
5. Redirect URLs 里也加入线上网址。

本地开发时保留：

```txt
http://localhost:5174
```

线上部署后加入类似：

```txt
https://你的站点.netlify.app
```

## 迁移页面处理

`migration-import.html` 是一次性迁移工具。正式上线后建议：

- 已完成迁移：可以删除这个文件再部署。
- 想保留备份能力：可以保留，但不要把链接发给别人。

导入函数本身有权限检查，只有日记本成员登录后才能导入到自己的日记本。

