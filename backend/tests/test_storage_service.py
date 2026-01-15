"""Tests for the S3-compatible storage service."""

import json
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from app.services.storage_service import (
    ensure_bucket_exists,
    upload_game_logs,
    get_game_logs,
    generate_presigned_url,
    delete_game_logs,
)


@pytest.fixture
def mock_s3_client():
    """Create a mock S3 client."""
    return MagicMock()


class TestEnsureBucketExists:
    """Tests for ensure_bucket_exists function."""

    def test_returns_true_if_bucket_exists(self, mock_s3_client):
        """Should return True if bucket already exists."""
        mock_s3_client.head_bucket.return_value = {}

        result = ensure_bucket_exists(mock_s3_client, "test-bucket")

        assert result is True
        mock_s3_client.head_bucket.assert_called_once_with(Bucket="test-bucket")
        mock_s3_client.create_bucket.assert_not_called()

    def test_creates_bucket_if_not_exists(self, mock_s3_client):
        """Should create bucket if it doesn't exist."""
        error_response = {"Error": {"Code": "404"}}
        mock_s3_client.head_bucket.side_effect = ClientError(error_response, "HeadBucket")
        mock_s3_client.create_bucket.return_value = {}

        result = ensure_bucket_exists(mock_s3_client, "test-bucket")

        assert result is True
        mock_s3_client.create_bucket.assert_called_once_with(Bucket="test-bucket")

    def test_returns_false_on_create_error(self, mock_s3_client):
        """Should return False if bucket creation fails."""
        head_error = {"Error": {"Code": "NoSuchBucket"}}
        create_error = {"Error": {"Code": "AccessDenied"}}
        mock_s3_client.head_bucket.side_effect = ClientError(head_error, "HeadBucket")
        mock_s3_client.create_bucket.side_effect = ClientError(create_error, "CreateBucket")

        result = ensure_bucket_exists(mock_s3_client, "test-bucket")

        assert result is False


class TestUploadGameLogs:
    """Tests for upload_game_logs function."""

    def test_uploads_logs_with_correct_structure(self, mock_s3_client):
        """Should upload logs with correct JSON structure."""
        mock_s3_client.head_bucket.return_value = {}

        summary = {"winner": 1, "players": ["a", "b"]}
        agent_logs = [{"step": 1, "action": "move"}]

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            bucket, key = upload_game_logs(
                game_id="game-123",
                summary=summary,
                agent_logs=agent_logs,
                client=mock_s3_client,
            )

        assert bucket == "test-bucket"
        assert "game-123.json" in key
        assert key.startswith("games/")

        # Verify put_object was called
        mock_s3_client.put_object.assert_called_once()
        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs["Bucket"] == "test-bucket"
        assert call_kwargs["ContentType"] == "application/json"

        # Verify the body contains expected data
        body = json.loads(call_kwargs["Body"])
        assert body["game_id"] == "game-123"
        assert body["summary"] == summary
        assert body["agent_logs"] == agent_logs
        assert "uploaded_at" in body

    def test_key_includes_date_prefix(self, mock_s3_client):
        """Should organize logs by date in the key."""
        mock_s3_client.head_bucket.return_value = {}

        with patch("app.services.storage_service.get_settings") as mock_settings:
            mock_settings.return_value.s3_bucket_name = "test-bucket"

            bucket, key = upload_game_logs(
                game_id="game-456",
                summary={},
                agent_logs=[],
                client=mock_s3_client,
            )

        # Key should be like "games/2024/01/15/game-456.json"
        parts = key.split("/")
        assert parts[0] == "games"
        assert len(parts[1]) == 4  # Year
        assert len(parts[2]) == 2  # Month
        assert len(parts[3]) == 2  # Day
        assert parts[4] == "game-456.json"


class TestGetGameLogs:
    """Tests for get_game_logs function."""

    def test_returns_parsed_json(self, mock_s3_client):
        """Should return parsed JSON from S3."""
        log_data = {"game_id": "123", "summary": {"winner": 1}}
        mock_s3_client.get_object.return_value = {
            "Body": MagicMock(read=lambda: json.dumps(log_data).encode())
        }

        result = get_game_logs("bucket", "key", mock_s3_client)

        assert result == log_data

    def test_returns_none_if_not_found(self, mock_s3_client):
        """Should return None if object doesn't exist."""
        error_response = {"Error": {"Code": "NoSuchKey"}}
        mock_s3_client.get_object.side_effect = ClientError(error_response, "GetObject")

        result = get_game_logs("bucket", "missing-key", mock_s3_client)

        assert result is None

    def test_raises_on_other_errors(self, mock_s3_client):
        """Should raise on non-404 errors."""
        error_response = {"Error": {"Code": "AccessDenied"}}
        mock_s3_client.get_object.side_effect = ClientError(error_response, "GetObject")

        with pytest.raises(ClientError):
            get_game_logs("bucket", "key", mock_s3_client)


class TestGeneratePresignedUrl:
    """Tests for generate_presigned_url function."""

    def test_generates_url(self, mock_s3_client):
        """Should generate a presigned URL."""
        mock_s3_client.generate_presigned_url.return_value = "https://example.com/signed"

        result = generate_presigned_url("bucket", "key", client=mock_s3_client)

        assert result == "https://example.com/signed"
        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "bucket", "Key": "key"},
            ExpiresIn=3600,
        )

    def test_custom_expiration(self, mock_s3_client):
        """Should use custom expiration time."""
        mock_s3_client.generate_presigned_url.return_value = "https://example.com/signed"

        generate_presigned_url("bucket", "key", expiration=7200, client=mock_s3_client)

        call_kwargs = mock_s3_client.generate_presigned_url.call_args
        assert call_kwargs[1]["ExpiresIn"] == 7200

    def test_returns_none_on_error(self, mock_s3_client):
        """Should return None on error."""
        error_response = {"Error": {"Code": "Error"}}
        mock_s3_client.generate_presigned_url.side_effect = ClientError(
            error_response, "GeneratePresignedUrl"
        )

        result = generate_presigned_url("bucket", "key", client=mock_s3_client)

        assert result is None


class TestDeleteGameLogs:
    """Tests for delete_game_logs function."""

    def test_deletes_successfully(self, mock_s3_client):
        """Should return True on successful deletion."""
        mock_s3_client.delete_object.return_value = {}

        result = delete_game_logs("bucket", "key", mock_s3_client)

        assert result is True
        mock_s3_client.delete_object.assert_called_once_with(Bucket="bucket", Key="key")

    def test_returns_false_on_error(self, mock_s3_client):
        """Should return False on error."""
        error_response = {"Error": {"Code": "AccessDenied"}}
        mock_s3_client.delete_object.side_effect = ClientError(error_response, "DeleteObject")

        result = delete_game_logs("bucket", "key", mock_s3_client)

        assert result is False
