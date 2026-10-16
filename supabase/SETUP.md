# Appointments database setup (one time)

Appointments are stored in Supabase. Supabase checks each user's Clerk login, and the
row-level security rules in `migrations/0001_appointments.sql` decide what each user can see and change.

## 1. Connect Clerk to Supabase

1. **Clerk Dashboard → Integrations → Supabase → Activate.** Copy the **Clerk domain** it shows.
2. **Supabase Dashboard → Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk.**
   Paste the Clerk domain and save.

## 2. Put the database role and staff role into the login token

**Clerk Dashboard → Sessions → Customize session token**, add:

```json
{
  "role": "authenticated",
  "metadata": "{{user.public_metadata}}"
}
```

`role` tells Supabase the user is signed in. Without it Supabase treats them as signed out
and every query fails with "permission denied for table appointments".

## 3. Create the table and rules

**Supabase Dashboard → SQL Editor → New query**, paste all of `migrations/0001_appointments.sql`, and run it once.
Then do the same with `migrations/0002_remove_bp_and_medicine_services.sql`, then `migrations/0003_admin.sql`, then `migrations/0004_rejected_status.sql`, then `migrations/0005_admin_manage.sql`,
then `migrations/0006_booking_contact_fields.sql`, then `migrations/0007_confirmation_emails.sql`, then `migrations/0008_status_emails.sql`.

## 4. Make a staff account

1. The staff member signs up on the site like a resident.
2. **Clerk Dashboard → Users →** pick them **→ Metadata → Public**, set:

   ```json
   {
     "role": "staff",
     "services": ["Prenatal & maternal care", "Family planning"]
   }
   ```

   `services` lists what they handle. Names must match exactly:
   `General consultation`, `Child immunization`, `Prenatal & maternal care`,
   `Family planning`.

3. They sign out and back in. **My dashboard → Staff dashboard** (or go to `/staff`).

Only use **Public** metadata. Users can edit their own *unsafe* metadata, so it is never trusted.

## 5. Make an admin account

Same as a staff account, but set the public metadata to:

```json
{ "role": "admin" }
```

They sign out and back in. **My dashboard → Admin dashboard** (or go to `/admin`).

## Who can do what

| | Residents | Staff | Admins |
|---|---|---|---|
| See appointments | Their own only | Only their assigned services | All |
| Create | For themselves, today or later | — | — |
| Change status | Cancel their own pending/confirmed | Mark due ones Completed or Missed | Confirm (today or later) or reject pending requests; set any status |
| See the audit log | No | No | Yes |
| Edit details | No | No | Yes |
| Archive / restore | No | No | Yes (archived appointments are hidden from residents and staff) |
| Delete permanently | No | No | Yes |

Every booking, status change, edit, archive and delete is written to `audit_log` by a database trigger, with who made it and when.
A deleted appointment's history stays in the log, with a snapshot of its details.

Staff can't undo a mark from the app. An admin can fix it with **Edit** on the admin dashboard.
