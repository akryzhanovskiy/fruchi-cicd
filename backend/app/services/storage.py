from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings

if TYPE_CHECKING:  # type stubs are a dev-only dependency
    from mypy_boto3_s3 import S3Client

logger = logging.getLogger(__name__)


def s3_client() -> S3Client:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.minio_endpoint,
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        region_name="us-east-1",
    )


def public_read_policy(bucket: str) -> str:
    return json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
    )


def init_bucket(retries: int = 30, delay: float = 2.0) -> None:
    """Create the media bucket (idempotent) and allow anonymous reads of its objects.

    Retries while MinIO is still starting, so it can run as a one-shot
    container / Kubernetes Job right after the storage comes up.
    """
    bucket = get_settings().minio_bucket
    client = s3_client()
    for attempt in range(1, retries + 1):
        try:
            existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
            if bucket not in existing:
                client.create_bucket(Bucket=bucket)
                logger.info("Created bucket %s", bucket)
            client.put_bucket_policy(Bucket=bucket, Policy=public_read_policy(bucket))
            logger.info("Bucket %s is ready (public read)", bucket)
            return
        except (BotoCoreError, ClientError) as exc:
            if attempt == retries:
                raise
            logger.warning("Storage not ready (attempt %d/%d): %s", attempt, retries, exc)
            time.sleep(delay)
