"""S3-compatible storage service for game logs.

Uses boto3 for S3 API compatibility. Works with:
- Real AWS S3
- MinIO (local development)
- Any S3-compatible storage (R2, GCS with interop, etc.)
"""

import json
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings


def get_s3_client():
    """Get an S3 client configured from settings."""
    settings = get_settings()

    client_kwargs = {
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
        "region_name": settings.s3_region,
    }

    # If endpoint URL is set, use it (for MinIO or other S3-compatible services)
    if settings.s3_endpoint_url:
        client_kwargs["endpoint_url"] = settings.s3_endpoint_url

    return boto3.client("s3", **client_kwargs)


def ensure_bucket_exists(client=None, bucket_name: str | None = None) -> bool:
    """
    Ensure the storage bucket exists, creating it if necessary.

    Returns True if bucket exists or was created, False on error.
    """
    if client is None:
        client = get_s3_client()

    settings = get_settings()
    bucket = bucket_name or settings.s3_bucket_name

    try:
        client.head_bucket(Bucket=bucket)
        return True
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "404" or error_code == "NoSuchBucket":
            # Bucket doesn't exist, create it
            try:
                client.create_bucket(Bucket=bucket)
                return True
            except ClientError:
                return False
        return False


def upload_game_logs(
    game_id: str,
    summary: dict[str, Any],
    agent_logs: list[dict[str, Any]],
    client=None,
) -> tuple[str, str]:
    """
    Upload game logs to S3.

    Args:
        game_id: Unique game identifier
        summary: Game summary JSON (structured data)
        agent_logs: List of agent interaction logs (unstructured)
        client: Optional S3 client (for testing)

    Returns:
        Tuple of (bucket_name, object_key) for the uploaded logs
    """
    if client is None:
        client = get_s3_client()

    settings = get_settings()
    bucket = settings.s3_bucket_name

    # Ensure bucket exists
    ensure_bucket_exists(client, bucket)

    # Create a combined log object
    timestamp = datetime.now(timezone.utc).isoformat()
    log_data = {
        "game_id": game_id,
        "uploaded_at": timestamp,
        "summary": summary,
        "agent_logs": agent_logs,
    }

    # Generate key with date prefix for organization
    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    key = f"games/{date_prefix}/{game_id}.json"

    # Upload as JSON
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(log_data, indent=2),
        ContentType="application/json",
    )

    return bucket, key


def get_game_logs(bucket: str, key: str, client=None) -> dict[str, Any] | None:
    """
    Retrieve game logs from S3.

    Args:
        bucket: S3 bucket name
        key: Object key
        client: Optional S3 client (for testing)

    Returns:
        Parsed JSON log data, or None if not found
    """
    if client is None:
        client = get_s3_client()

    try:
        response = client.get_object(Bucket=bucket, Key=key)
        body = response["Body"].read().decode("utf-8")
        return json.loads(body)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "NoSuchKey":
            return None
        raise


def generate_presigned_url(bucket: str, key: str, expiration: int = 3600, client=None) -> str | None:
    """
    Generate a presigned URL for downloading game logs.

    Args:
        bucket: S3 bucket name
        key: Object key
        expiration: URL expiration time in seconds (default 1 hour)
        client: Optional S3 client (for testing)

    Returns:
        Presigned URL string, or None on error
    """
    if client is None:
        client = get_s3_client()

    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiration,
        )
        return url
    except ClientError:
        return None


def delete_game_logs(bucket: str, key: str, client=None) -> bool:
    """
    Delete game logs from S3.

    Args:
        bucket: S3 bucket name
        key: Object key
        client: Optional S3 client (for testing)

    Returns:
        True if deleted successfully, False otherwise
    """
    if client is None:
        client = get_s3_client()

    try:
        client.delete_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False
