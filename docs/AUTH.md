# Authentication & Role-Based Access Control (RBAC)

This document describes the authentication flow, role-based access control (RBAC) architecture, Supabase Auth hook integration, and administrative bootstrap procedures for the academic journal platform.

---

## 1. Role Architecture & Claim Contract

### Platform Roles
The platform defines four distinct roles in `public.user_role`:
- **`author`**: Default role assigned to all newly registered users. Can submit manuscripts, track their own submissions, view reviews on their own manuscripts, and upload revisions.
- **`reviewer`**: Can accept review invitations, download anonymized manuscripts, and submit peer review evaluations.
- **`editor`**: Can manage the editorial workflow, assign reviewers, view deanonymized manuscripts, trigger AI metadata extraction, and issue editorial decisions.
- **`admin`**: Full platform administration, issue publishing, and user role management via `public.admin_set_user_role`.

### The Authoritative Source of Truth
The authoritative user role **always** resides in the database table:
```sql
public.user_profiles(id, role, ...)
```
Raw user metadata (`auth.users.raw_user_meta_data`) is untrusted and must never be used for authorization decisions. When a user registers, the database trigger `private.handle_new_user()` enforces that every profile is created with `role = 'author'`, regardless of any values provided in the signup payload.

### The JWT Claim Contract
When users authenticate, Supabase Auth signs JSON Web Tokens (JWTs) using asymmetric cryptography (ECC P-256). The platform injects the user's role into the token claims via a Supabase Auth Access Token Hook.

| Claim | Type | Possible Values | Description |
|---|---|---|---|
| `user_role` | `string \| null` | `"author"`, `"reviewer"`, `"editor"`, `"admin"`, `null` | The custom claim representing the user's platform role in `public.user_profiles`. Evaluates to `null` if no profile exists or an error occurs. |
| `role` | `string` | `"authenticated"` | **Standard Supabase claim.** Reserved by PostgreSQL and PostgREST to map database connection roles. **Must always remain `"authenticated"`**. |
| `sub` | `string (UUID)` | User UUID | Standard JWT subject claim matching `auth.users.id` and `public.user_profiles.id`. |

> [!CAUTION]
> **NEVER rename or overwrite the `role` claim.**
> PostgREST relies on `claims.role` to set the PostgreSQL session role (`SET ROLE authenticated;`). Overwriting `role` with an application role like `"editor"` will cause PostgREST database queries to fail with permission errors. Application-level RBAC claims must always use `user_role`.

---

## 2. How the Access Token Hook Works

The custom hook function is implemented in PostgreSQL:
```sql
public.custom_access_token_hook(event jsonb) returns jsonb
```

### Execution Lifecycle
1. A client initiates authentication (email/password login, OAuth, magic link, or token refresh).
2. Supabase Auth generates the base JWT payload (containing `sub`, `aud`, `email`, `role: "authenticated"`, etc.).
3. Supabase Auth invokes `public.custom_access_token_hook` as the internal `supabase_auth_admin` role, passing an `event` JSONB object:
   ```json
   {
     "user_id": "00000000-0000-0000-0000-000000000000",
     "claims": {
       "sub": "00000000-0000-0000-0000-000000000000",
       "role": "authenticated",
       "email": "user@example.com"
     }
   }
   ```
4. The hook reads `(event->>'user_id')::uuid` and queries `public.user_profiles.role`.
5. The hook updates `event.claims.user_role` to the found role (or JSON `null` if not found), while preserving all existing claims.
6. The updated `event` is returned to Supabase Auth, which signs the final JWT and issues it to the client.

### Fault Tolerance & Security Hardening
- **Never blocks authentication**: A failing hook would prevent all users from signing in. The function is wrapped in an `exception when others` block that intercepts any database error (or invalid UUID) and safely returns the event with `user_role = null`.
- **`SECURITY DEFINER` with `set search_path = ''`**: Prevents search-path hijacking attacks. All schema, table, and type references are fully qualified.
- **REST API Protection**: Execution is granted strictly to `supabase_auth_admin` and revoked from `public`, `anon`, and `authenticated`. It cannot be called over PostgREST HTTP endpoints (`/rpc/custom_access_token_hook`).

---

## 3. Important Caveat: Token Expiration & Role Refresh

JWTs are stateless, self-contained credentials signed with asymmetric keys (ECC P-256). Once issued:
- The claims inside a JWT are **immutable** for the duration of that token's lifespan (typically 1 hour).
- If an administrator updates a user's role in `public.user_profiles`, **the user's existing JWT will still contain their previous `user_role` claim** until the token expires and is refreshed, or until the user explicitly signs out and signs back in.

### Client-Side Best Practice
When a user's role is updated or permissions change during an active session:
```typescript
// Force immediate token refresh to obtain updated claims
const { data, error } = await supabase.auth.refreshSession();
```

---

## 4. Enabling the Hook in the Supabase Dashboard

The database migration creates and permissions the function, but Supabase Auth requires wiring up the hook in the Supabase Dashboard:

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the left navigation sidebar, navigate to **Authentication** > **Hooks**.
4. Scroll to **Customize Access Token (JWT) Claims**.
5. Select **Postgres function** as the hook type.
6. Configure the function target:
   - **Schema**: `public`
   - **Function**: `custom_access_token_hook`
7. Click **Save** to enable the hook.

After saving, all newly issued access tokens and refreshed tokens will include the `user_role` top-level claim.

---

## 5. Bootstrapping the First Administrator

Because all user registrations are automatically assigned the `'author'` role by the signup trigger, the first administrator must be promoted directly in the database.

### Step 1: Register the Account
Sign up the initial user account using the web application or the Supabase Auth API. Confirm the email address if email confirmations are enabled.

### Step 2: Promote via SQL
Open the Supabase Dashboard **SQL Editor** and execute the following bootstrap script (replace `'your-email@example.com'` with the real admin email):

```sql
-- 1. Promote initial user to administrator
update public.user_profiles
   set role = 'admin'
 where id = (
   select id
   from auth.users
   where email = 'your-email@example.com'
 );

-- 2. Verify promotion
select
  u.id,
  u.email,
  p.role,
  p.full_name,
  p.created_at,
  p.updated_at
from auth.users u
join public.user_profiles p on p.id = u.id
where u.email = 'your-email@example.com';
```

### Step 3: Refresh Session
Have the newly promoted administrator sign out and sign back in (or refresh their session) so their access token reflects `"user_role": "admin"`.

---

## 6. Ongoing Role Management

Direct SQL updates must **never** be used for regular role changes after initial bootstrap.

Instead, administrators manage roles using the dedicated RPC function:
```sql
public.admin_set_user_role(target_id uuid, new_role public.user_role)
```

### Authorization Rules
- The function checks `private.is_admin()` against `auth.uid()`.
- Non-admin callers receive an `insufficient_privilege` error (SQLSTATE `42501`).
- The function executes as `SECURITY DEFINER` with `set search_path = ''` to safely update `public.user_profiles` while bypassing table-level RLS restrictions.

### Example Invocation (Frontend/API)
```typescript
const { data, error } = await supabase.rpc('admin_set_user_role', {
  target_id: 'target-user-uuid',
  new_role: 'editor'
});
```

---

## 7. Security Notes & Best Practices

1. **Defense in Depth**:
   - Client applications use `user_role` claims for fast UI routing and conditionally displaying controls (e.g. editor dashboards).
   - Backend APIs verify the JWT signature against the project JWKS endpoint (`SUPABASE_JWKS_URL`) and check `user_role`.
   - The database enforces Row Level Security (RLS) on all base tables (`submissions`, `reviews`, `issues`, etc.) using helper functions (`private.is_editor_or_admin()`, `private.is_admin()`, `private.current_user_role()`).
2. **Asymmetric Key Verification**:
   - Access tokens are signed using ECC P-256 (`ES256`).
   - Microservices and FastAPI backend verify incoming tokens against Supabase JWKS without needing the database connection or shared secrets.
3. **Auditability**:
   - The `user_profiles` table maintains `updated_at` timestamps via the `trg_user_profiles_updated_at` trigger.
   - Status changes and editorial decisions are logged in `submission_status_history`.
