import os
import sys

# Add the app directory to sys.path if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from alembic.config import Config
from alembic import command
import sqlite3
from app.db.session import SessionLocal
from app.models.tenant import Tenant
from app.models.user import User
from app.core.security import hash_password

db_path = "logicopilot.db"
if os.path.exists(db_path):
    print("Dropping existing tables...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    for table_name in tables:
        table_name = table_name[0]
        if table_name != 'sqlite_sequence':
            cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    conn.commit()
    conn.close()

print("Running Alembic migrations...")
alembic_cfg = Config("alembic.ini")
command.upgrade(alembic_cfg, "head")

print("Seeding database...")
db = SessionLocal()

# Create Tenants
tenant1 = Tenant(name="4S Logistics", is_active=True)
tenant2 = Tenant(name="Acme Freight", is_active=True)
db.add(tenant1)
db.add(tenant2)
db.commit()
db.refresh(tenant1)
db.refresh(tenant2)

# Create Users
users_data = [
    {
        "role": "super_admin",
        "email": "ashraf.ali@workboosterai.com",
        "password": "SuperSecret123",
        "tenant_id": None
    },
    {
        "role": "tenant_admin",
        "email": "admin-a@4slogistics.com",
        "password": "AdminPass123",
        "tenant_id": tenant1.id
    },
    {
        "role": "tenant_admin",
        "email": "admin-b@acme.com",
        "password": "AdminPass123",
        "tenant_id": tenant2.id
    },
    {
        "role": "operator",
        "email": "op-a@4slogistics.com",
        "password": "OpPass1234",
        "tenant_id": tenant1.id
    }
]

for ud in users_data:
    user = User(
        email=ud["email"],
        full_name=ud["email"].split('@')[0],
        hashed_password=hash_password(ud["password"]),
        role=ud["role"],
        tenant_id=ud["tenant_id"],
        is_active=True
    )
    db.add(user)

db.commit()
db.close()
print("Database seeded successfully!")
