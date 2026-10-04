// Creates (or promotes) an admin account.
//   npm run create-admin -- you@example.com 'a-strong-password' [owner|editor]
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { createClient } from "@supabase/supabase-js";

const [email, password, role = "owner"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: npm run create-admin -- you@example.com 'a-strong-password' [owner|editor]");
  process.exit(1);
}
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).");
  process.exit(1);
}
if (!["owner", "editor"].includes(role)) {
  console.error("Role must be 'owner' or 'editor'.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(target) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUser(email);
if (!user) {
  if (!password || password.length < 8) {
    console.error("No user with that email yet — pass a password (8+ characters) to create one.");
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("Couldn't create the user:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`Created login for ${email}`);
} else if (password) {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) console.warn("User exists; couldn't update password:", error.message);
  else console.log(`Updated password for ${email}`);
}

const { error } = await supabase.from("admins").upsert({ user_id: user.id, email: email.toLowerCase(), role });
if (error) {
  console.error("Couldn't add the admin row — did you run supabase/setup.sql?", error.message);
  process.exit(1);
}
console.log(`✓ ${email} is now an ${role}. Sign in at /admin/login`);
