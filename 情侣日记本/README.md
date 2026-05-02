# 情侣日记本

这是从 Base44 迁移出来的情侣日记 App，使用 Supabase 保存账号、日记、照片和共享日记本数据。

## 现在已有功能

- 邮箱注册和登录
- 双方共享同一个日记本
- 写日记、编辑日记、删除日记
- 可选择过去日期补写日记
- 心情、地点、照片
- 首页搜索
- 年份和月份折叠
- 日历图片预览
- 图片全屏查看和切换
- 记忆回溯：显示第 100 天、200 天、1 年纪念日这类特别日子
- 主题颜色
- PDF 导出
- Base44 旧数据迁移草稿和导入页面

## 本地预览

在这个文件夹里运行本地预览服务：

```bash
python3 -m http.server 5174
```

然后打开：

```txt
http://localhost:5174
```

如果页面没有更新，按 `Command + Shift + R` 强制刷新。

## 配置 Supabase

Supabase 配置在：

```txt
config.js
```

以后如果换 Supabase 项目，只需要改这里的：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

注意：这里使用的是 Supabase 的公开 anon key，不是 service role key。

## 数据迁移文件

这些文件是 Base44 旧数据迁移用的：

- `满满的日记-数据迁移.pdf`
- `migration-draft.json`
- `migration-notes.md`
- `migration-import.html`

旧数据已经测试导入成功。部署正式版本时可以保留作备份；如果不想让线上访问迁移页面，可以部署前删除 `migration-import.html`，或者部署后不要公开这个链接。

## 主要文件

- `index.html`：App 页面结构
- `styles.css`：界面样式
- `app.js`：App 功能逻辑
- `config.js`：Supabase 配置
- `design-samples.html`：早期 UI 样本，可保留或删除

