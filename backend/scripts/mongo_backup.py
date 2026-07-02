#!/usr/bin/env python3
"""
Meetings.ro — Daily MongoDB backup to S3.

Runs as a supervisord program (see entrypoint.sh). Every BACKUP_INTERVAL_HOURS
(default 24) it does a `mongodump --archive --gzip` of DB_NAME and uploads it
to s3://S3_BACKUP_BUCKET/mongo-backups/. Old backups beyond
BACKUP_RETENTION_DAYS (default 30) are deleted from the bucket.

Works against both the local mongod and an external cluster (MongoDB Atlas) —
Atlas M0 (free tier) has NO automatic backups, so this is the safety net.

Required env: MONGO_URL, DB_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
S3_BACKUP_BUCKET. Optional: AWS_REGION (default eu-central-1),
BACKUP_INTERVAL_HOURS, BACKUP_RETENTION_DAYS.

Restore procedure (from any machine with mongodb-database-tools):
    aws s3 cp s3://<bucket>/mongo-backups/<file>.archive.gz .
    mongorestore --uri "<MONGO_URL>" --archive=<file>.archive.gz --gzip --drop
"""

import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta

import boto3

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gal_meetings")
BUCKET = os.environ.get("S3_BACKUP_BUCKET", "")
REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "eu-central-1"))
INTERVAL_HOURS = float(os.environ.get("BACKUP_INTERVAL_HOURS", "24"))
RETENTION_DAYS = int(os.environ.get("BACKUP_RETENTION_DAYS", "30"))
PREFIX = "mongo-backups/"

def log(msg: str) -> None:
    print(f"[Backup] {msg}", flush=True)


def run_backup(s3) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    archive = f"/tmp/{DB_NAME}-{stamp}.archive.gz"
    key = f"{PREFIX}{DB_NAME}-{stamp}.archive.gz"

    cmd = [
        "mongodump",
        f"--uri={MONGO_URL}",
        f"--db={DB_NAME}",
        f"--archive={archive}",
        "--gzip",
    ]
    log(f"mongodump {DB_NAME} → {archive}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f"mongodump failed (rc={result.returncode}): {result.stderr[-2000:]}")

    size_mb = os.path.getsize(archive) / 1048576
    s3.upload_file(archive, BUCKET, key)
    log(f"uploaded s3://{BUCKET}/{key} ({size_mb:.1f} MB)")
    os.remove(archive)


def prune_old_backups(s3) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX)
    for obj in resp.get("Contents", []):
        if obj["LastModified"] < cutoff:
            s3.delete_object(Bucket=BUCKET, Key=obj["Key"])
            log(f"pruned old backup {obj['Key']}")


def main() -> None:
    if not BUCKET:
        log("S3_BACKUP_BUCKET not set — exiting")
        sys.exit(0)

    s3 = boto3.client("s3", region_name=REGION)
    log(f"started — every {INTERVAL_HOURS}h, retention {RETENTION_DAYS}d, bucket {BUCKET}")

    # Give mongod/network a moment on cold start, then back up immediately —
    # on the free plan the service can spin down at any time, so an early
    # backup beats a scheduled one.
    time.sleep(60)

    while True:
        try:
            run_backup(s3)
            prune_old_backups(s3)
        except Exception as e:
            log(f"ERROR: {e}")
        time.sleep(INTERVAL_HOURS * 3600)


if __name__ == "__main__":
    main()
