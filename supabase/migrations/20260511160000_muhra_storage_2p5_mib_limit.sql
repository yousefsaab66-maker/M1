-- MUHRA: حد رفع صور المتجر 2.5 ميغابايت (يطابق التطبيق)
update storage.buckets
set file_size_limit = 2621440 -- 2.5 MiB
where id = 'muhra-products';
