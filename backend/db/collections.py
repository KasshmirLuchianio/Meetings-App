"""
Shared Motor collection references.
Import these everywhere instead of re-creating clients.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

_client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
    return _client


def get_db():
    return get_client()[settings.DB_NAME]


# Collection accessors — call as functions so they always use the live client
def meetings_col():
    return get_db()["meetings"]

def users_col():
    return get_db()["users"]

def localities_col():
    return get_db()["localities"]

def tenants_col():
    return get_db()["tenants"]
