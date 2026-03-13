# Skill: Auth and Roles

## Goal

Implement secure authentication and role-aware access using Supabase Auth and database roles.

## Roles

- buyer
- seller
- admin

## Rules

- Never trust client-only role checks.
- Store role information in the database.
- Protect dashboard routes.
- Protect seller-only actions.
- Protect admin-only moderation pages.
