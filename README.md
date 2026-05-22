# MUHRA JEWELRY

متجر عرض تجريبي — Next.js 16 (App Router) + Tailwind v4. الحالة تُخزَّن محلياً في المتصفح (لا قاعدة بيانات حقيقية).

## تشغيل محلي

```bash
npm install
npm run dev
```

يفتح على [http://localhost:3000](http://localhost:3000).

## بناء الإنتاج

```bash
npm run lint
npm run build
```

## النشر على Netlify

1. ارفع هذا المجلد إلى GitHub/GitLab (أو اسحب المجلد في Netlify).
2. في Netlify: **Site settings → Build & deploy**
   - **Build command:** `npm run build` (يُقرأ من `netlify.toml` تلقائياً)
   - **Base directory:** اتركه فارغاً إن كان المشروع في جذر المستودع.
3. لا حاجة لمتغيرات بيئة إلزامية لهذا الديمو.

يُستخدم `@netlify/plugin-nextjs` و Node **22** (انظر `.nvmrc` و `netlify.toml`).

## Staff / إدارة

مسار لوحة الموظفين: `/staff/login` — بيانات الدخول الافتراضية مُعرّفة في التطبيق (ديمو فقط).

### Cloudflare / كتالوج

- بعد تعديل منتجات أو إعدادات الواجهة على الإنتاج: `npm run cf:purge` (أو `cf:purge:local` مع `.env.local`).
- منتجات فيها صور `data:` (base64) في Supabase: `GET /api/staff/catalog-embedded` (جلسة موظف) — أعد رفع الصور إلى R2 من لوحة المنتجات.
- ربط R2 واحد في `wrangler.jsonc`: `MUHRA_MEDIA` → bucket `muhra-media`.
