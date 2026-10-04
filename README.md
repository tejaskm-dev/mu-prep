# µPrep — Notes Hub

A free notes hub for every branch, semester and subject, built by µLearn. Next.js 16 (Cache Components), Supabase and UploadThing.

## Setup

1. **Supabase**: create a project, open **SQL Editor**, paste all of `supabase/setup.sql` and run it. This creates the schema, RLS, the search functions and the starter departments and subjects.
2. **UploadThing**: create an app and copy its `UPLOADTHING_TOKEN`.
3. **Environment**: `cp .env.example .env.local`, then fill in the Supabase URL, the anon key, the service-role key and the UploadThing token.
4. **First admin**:
   ```bash
   npm install
   npm run create-admin -- you@example.com 'a-strong-password'
   ```
5. Run `npm run dev`, then open `/` for the site and `/admin` for the panel. Until everything is configured, the admin login page shows a setup checklist.

On Vercel, set the same environment variables. Content changes in the admin show up on the site straight away, through cache tags.

## Where things live

- `supabase/migrations`: the schema (after editing it, rebuild `setup.sql` with `npm run db:bundle`)
- `src/lib/data.ts`: cached public queries. `src/lib/actions/*`: server actions
- `src/components/admin/uploader`: the smart bulk uploader. It reads file names and first pages to fill in subject, module, type and exam session.
- `src/lib/compress`: client-side compression (Web Worker). **Built, but not yet connected to the uploaders.**
