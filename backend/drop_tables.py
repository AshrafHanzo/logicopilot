import sqlite3
import os

try:
    if os.path.exists('logicopilot.db'):
        conn = sqlite3.connect('logicopilot.db')
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        for table_name in tables:
            table_name = table_name[0]
            if table_name != 'sqlite_sequence':
                cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
        conn.commit()
        conn.close()
        print("Dropped all tables successfully.")
except Exception as e:
    print(f"Error dropping tables: {e}")
