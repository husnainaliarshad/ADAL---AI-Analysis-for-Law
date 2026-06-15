"""
Supabase user insert test (manual, not auto-run).

Usage:
  python scripts/supabase_insert_user_test.py "testuser@example.com" "First" "Last" "password_hash_here"

Notes:
- Requires SUPABASE_DATABASE_URL in your environment.
- Inserts into Supabase public.users (UUID PK). Adjust columns if your schema differs.
- Does NOT hash the password; pass an already-hashed value (e.g., bcrypt) if needed.
"""
import os
import sys
import uuid
from sqlalchemy import create_engine, text

# Prevent pytest from collecting this as an automated test module.
__test__ = False


def main() -> int:
    if len(sys.argv) < 5:
        print("Usage: python scripts/supabase_insert_user_test.py <email> <first_name> <last_name> <password_hash>")
        return 1

    email, first_name, last_name, password_hash = sys.argv[1:5]
    url = os.getenv("SUPABASE_DATABASE_URL")
    if not url:
        print("SUPABASE_DATABASE_URL not set")
        return 1

    engine = create_engine(url, connect_args={"sslmode": "require"})
    user_id = str(uuid.uuid4())

    stmt = text(
        """
        INSERT INTO public.users
            (id, email, password_hash, first_name, last_name, role, is_active, is_verified)
        VALUES
            (:id, :email, :password_hash, :first_name, :last_name, 'user', true, false)
        RETURNING id;
        """
    )

    with engine.begin() as conn:
        res = conn.execute(
            stmt,
            {
                "id": user_id,
                "email": email,
                "password_hash": password_hash,
                "first_name": first_name,
                "last_name": last_name,
            },
        )
        new_id = res.scalar()
        print(f"Inserted Supabase user with id={new_id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
