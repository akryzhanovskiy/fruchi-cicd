from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    """Application settings, read from environment variables.

    Non-secret values are meant to come from a ConfigMap, secrets (passwords, tokens)
    from a Secret — every field maps to one env var.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "fruchi"
    postgres_user: str = "fruchi"
    postgres_password: str = "fruchi"  # noqa: S105 - local dev default, overridden by Secret

    minio_endpoint: str = "http://localhost:9000"
    minio_bucket: str = "fruchi-media"
    # Public URL prefix for uploaded files (nginx proxies /media/ to the bucket).
    media_base_url: str = "/media"
    minio_access_key: str = "fruchi"
    minio_secret_key: str = "fruchi-minio"  # noqa: S105 - local dev default, overridden by Secret

    # Admin auth. jwt_secret must be a long random value in every real environment.
    jwt_secret: str = "dev-only-change-me-dev-only-change-me"  # noqa: S105 - overridden by Secret
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    # Secure cookies need HTTPS; keep false for plain-http local / minikube setups.
    cookie_secure: bool = False
    # First admin, created by `python -m app.cli ensure-admin` when there are no users yet.
    admin_initial_email: str = ""
    admin_initial_password: str = ""

    # Telegram bot for operator notifications (token from @BotFather). Empty — notifications
    # are kept in the outbox until the bot is configured. The chat id is set in the admin panel.
    telegram_bot_token: str = ""
    telegram_api_url: str = "https://api.telegram.org"
    # Public storefront address: canonical URLs in sitemap.xml.
    site_url: str = "https://fruchi.com.ua"
    # Storefront nginx as seen from the backend: the built index.html is fetched from here
    # and filled with page-specific meta tags for crawlers. Empty — pages aren't rendered
    # and nginx serves the plain index.html.
    storefront_internal_url: str = ""
    # Admin panel address used for "Відкрити в адмінці" links in notifications.
    admin_public_url: str = "http://localhost:8081"

    # JSON list of origins allowed to call the API directly (local dev only;
    # in containers the frontends reach the API through nginx on the same origin).
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://localhost:5174"])

    @property
    def asyncpg_dsn(self) -> str:
        """Plain asyncpg DSN for the LISTEN connection (live order updates)."""
        return self.database_url.set(drivername="postgresql").render_as_string(hide_password=False)

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
