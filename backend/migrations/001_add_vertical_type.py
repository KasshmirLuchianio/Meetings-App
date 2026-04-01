"""
MongoDB Migration Script - Add vertical_type field to meetings
Idempotent - safe to run multiple times
"""
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "gal_meetings"


async def migrate_add_vertical_type():
    """Add vertical_type to existing meetings (idempotent)"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    meetings_col = db["meetings"]
    
    # Check if already migrated
    sample = await meetings_col.find_one({"vertical_type": {"$exists": True}})
    if sample:
        print("[Migration] ✓ vertical_type already exists, skipping...")
        return
    
    # Count documents to migrate
    count = await meetings_col.count_documents({"vertical_type": {"$exists": False}})
    print(f"[Migration] Found {count} meetings to migrate...")
    
    if count == 0:
        print("[Migration] ✓ No documents to migrate")
        return
    
    # Update all documents without vertical_type
    result = await meetings_col.update_many(
        {"vertical_type": {"$exists": False}},
        {
            "$set": {
                "vertical_type": "GAL",
                "vertical_config": {},
                "migrated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    print(f"[Migration] ✓ Updated {result.modified_count} meetings with vertical_type=GAL")
    
    # Create index
    await meetings_col.create_index("vertical_type")
    print("[Migration] ✓ Created index on vertical_type")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_add_vertical_type())
