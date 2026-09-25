import boto3
from botocore.exceptions import ClientError
from core.config import get_settings
import logging
from io import BytesIO

logger = logging.getLogger(__name__)
settings = get_settings()

class StorageService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name='us-east-1' # Default for MinIO
        )
        self.bucket = settings.S3_BUCKET
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                logger.info(f"Bucket {self.bucket} not found. Creating it.")
                self.s3_client.create_bucket(Bucket=self.bucket)
            else:
                logger.error(f"Error checking bucket {self.bucket}: {e}")
                raise

    def upload_file(self, file_obj: BytesIO, object_name: str, content_type: str = "application/pdf"):
        """Upload a file to an S3 bucket"""
        try:
            # Ensure we're at the start of the BytesIO object
            file_obj.seek(0)
            self.s3_client.upload_fileobj(
                file_obj, 
                self.bucket, 
                object_name,
                ExtraArgs={'ContentType': content_type}
            )
            return f"{self.bucket}/{object_name}"
        except ClientError as e:
            logger.error(f"Failed to upload {object_name}: {e}")
            raise e

    def read_bytes(self, path: str) -> bytes:
        """Read an object previously stored via upload_file. `path` is '<bucket>/<object>'."""
        bucket, obj_name = path.replace("s3://", "").split("/", 1)
        response = self.s3_client.get_object(Bucket=bucket, Key=obj_name)
        return response['Body'].read()

    def get_file_url(self, object_name: str, expiration=3600):
        """Generate a presigned URL to share an S3 object"""
        try:
            response = self.s3_client.generate_presigned_url('get_object',
                                                            Params={'Bucket': self.bucket,
                                                                    'Key': object_name},
                                                            ExpiresIn=expiration)
            return response
        except ClientError as e:
            logger.error(f"Failed to generate URL for {object_name}: {e}")
            return None

    def get_file_stream(self, object_name: str):
        """Download file as stream"""
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=object_name)
            return response['Body']
        except ClientError as e:
            logger.error(f"Failed to download {object_name}: {e}")
            raise e

    def delete_file(self, object_name: str):
        """Delete file from bucket"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=object_name)
            return True
        except ClientError as e:
            logger.error(f"Failed to delete {object_name}: {e}")
            return False

class LocalStorageService:
    """Filesystem drop-in for StorageService (free/lite mode: no MinIO/S3 needed)."""

    def __init__(self):
        import os
        self.bucket = settings.S3_BUCKET
        self.root = os.path.abspath(settings.LOCAL_STORAGE_DIR)
        os.makedirs(os.path.join(self.root, self.bucket), exist_ok=True)

    def _full(self, object_name: str) -> str:
        import os
        full = os.path.abspath(os.path.join(self.root, self.bucket, object_name))
        if not full.startswith(os.path.join(self.root, self.bucket)):
            raise ValueError("Invalid object name")
        return full

    def upload_file(self, file_obj, object_name: str, content_type: str = "application/pdf"):
        import os
        full = self._full(object_name)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        file_obj.seek(0)
        with open(full, "wb") as fh:
            fh.write(file_obj.read())
        return f"{self.bucket}/{object_name}"

    def read_bytes(self, path: str) -> bytes:
        bucket, obj_name = path.replace("s3://", "").split("/", 1)
        with open(self._full(obj_name), "rb") as fh:
            return fh.read()

    def get_file_stream(self, object_name: str):
        return open(self._full(object_name), "rb")

    def delete_file(self, object_name: str):
        import os
        try:
            os.remove(self._full(object_name))
            return True
        except OSError:
            return False


# Singleton instance
storage = LocalStorageService() if settings.STORAGE_BACKEND == "local" else StorageService()
