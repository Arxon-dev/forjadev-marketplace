# Skill: Supabase DB

## Goal

Design a normalized schema with strong RLS and migration-first workflow.

## Rules

- Create SQL migrations for every schema change.
- Enable RLS on user-owned tables.
- Write policies explicitly.
- Prefer append-only audit logs for critical actions.
- Separate public product visibility from private seller/admin data.
