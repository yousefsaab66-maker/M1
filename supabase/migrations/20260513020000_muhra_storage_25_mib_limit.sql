-- MUHRA: رفع حد رفع صور المتجر إلى 25 ميغابايت (يطابق التطبيق على Cloudflare Workers)
-- ينفَّذ مرة واحدة بعد الـ migrations السابقة لـ bucket `muhra-products`.
update storage.buckets
set file_size_limit = 26214400 -- 25 MiB
where id = 'muhra-products';
