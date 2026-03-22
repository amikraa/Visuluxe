RULES FOR SUPABASE MIGRATIONS

1. Never edit files inside:
   supabase/migrations/

2. Migrations are immutable once created.

3. To modify database schema:
   - Use `supabase db diff -f <name>`
   - Then run `supabase db push`

4. Only append new migration files.

5. Never delete migration history.

6. Never modify schema_migrations table