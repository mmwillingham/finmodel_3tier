import pg8000.dbapi
import os

try:
    conn = pg8000.dbapi.connect(
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD"),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME")
    )
    print("Direct pg8000 connection successful!")
    conn.close()
except Exception as e:
    print(f"Direct pg8000 connection failed: {e}")

