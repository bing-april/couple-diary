# Supabase 已使用的主要数据库对象

这个文件记录项目已经依赖的 Supabase 对象，方便以后维护。

## 表

- `profiles`
- `diary_books`
- `diary_book_members`
- `diary_entries`

## Storage

- bucket：`diary-photos`

## 函数

- `public.is_diary_book_member(target_book_id uuid, target_user_id uuid)`
- `public.shares_diary_book_with(target_user_id uuid, current_user_id uuid)`
- `public.get_or_create_my_diary_book()`
- `public.import_legacy_entries(target_book_id uuid, entries jsonb)`

## 重要字段

`diary_entries`：

- `title`
- `content`
- `location`
- `mood`
- `photos`
- `entry_date`

`diary_books`：

- `name`
- `anniversary_date`

`profiles`：

- `email`
- `display_name`
- `diary_color`
- `theme_name`

