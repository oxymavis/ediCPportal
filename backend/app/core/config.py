from __future__ import annotations
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 始终从 backend 目录加载 .env，避免受当前工作目录影响
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = 'UNIS EDI API'
    app_env: str = 'development'
    database_url: str = 'sqlite:///./dev.db'
    auth_secret: str = 'change-me-in-production'
    auth_algorithm: str = 'HS256'
    access_token_ttl_hours: int = 24
    remember_me_ttl_days: int = 30
    cookie_name: str = 'edi_session'
    csrf_cookie_name: str = 'edi_csrf'
    csrf_header_name: str = 'x-csrf-token'
    cookie_secure: bool = False
    cookie_samesite: str = 'lax'
    cors_origins: str = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001'
    email_mode: str = 'mock'
    local_storage_path: str = './storage'
    smtp_host: str = 'localhost'
    smtp_port: int = 25
    smtp_username: str = ''
    smtp_password: str = ''
    smtp_use_tls: bool = False
    smtp_from: str = 'no-reply@localhost'
    integration_api_keys: str = 'dev-integration-key'
    linking_time_window_days: int = 7
    oauth_access_token_ttl_minutes: int = 60
    oauth_enable_api_key_fallback: bool = True
    oauth_admin_key: str = 'dev-oauth-admin-key'
    api_daily_quota: int = 20000
    api_monthly_quota: int = 300000
    api_max_request_size_bytes: int = 5 * 1024 * 1024
    api_ip_allowlist: str = ''
    platform_version: str = '1.0.0'
    feature_connection_test_real: bool = True
    feature_api_docs_backend: bool = True
    feature_notif_sse: bool = True
    api_test_endpoint: str = 'https://httpbin.org/get'
    sandbox_api_test_endpoint: str = 'https://httpbin.org/get'
    production_api_test_endpoint: str = 'https://httpbin.org/get'
    as2_connectivity_sandbox_url: str = 'https://edi-staging.item.com:5555/invoke/UNIS_EDI_PORTAL.service:AS2_Connectivity_API'
    as2_connectivity_production_url: str = 'https://edi-prod.item.com:443/invoke/UNIS_EDI_PORTAL.service:AS2_Connectivity_API'
    as2_connectivity_url: str = ''
    as2_connectivity_authorization: str = ''
    as2_connectivity_username: str = ''
    as2_connectivity_password: str = ''
    as2_connectivity_timeout_seconds: int = 30
    as2_connectivity_verify_tls: bool = True
    rate_limit_requests: int = 2000
    rate_limit_window_seconds: int = 60
    partner_sync_enabled: bool = False
    partner_sync_url: str = ''
    partner_sync_username: str = ''
    partner_sync_password: str = ''
    partner_sync_sandbox_url: str = ''
    partner_sync_sandbox_username: str = ''
    partner_sync_sandbox_password: str = ''
    partner_sync_production_url: str = ''
    partner_sync_production_username: str = ''
    partner_sync_production_password: str = ''
    partner_sync_timeout_seconds: int = 10
    partner_sync_verify_tls: bool = True
    auto_create_tables: bool = True
    auto_seed: bool = True

    @property
    def parsed_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(',') if o.strip()]

    @property
    def parsed_integration_api_keys(self) -> list[str]:
        return [k.strip() for k in self.integration_api_keys.split(',') if k.strip()]

    @property
    def parsed_api_ip_allowlist(self) -> list[str]:
        return [ip.strip() for ip in self.api_ip_allowlist.split(',') if ip.strip()]

    def partner_sync_target(self, environment: str | None = None) -> dict[str, str | int | bool]:
        del environment
        return {
            'environment': 'default',
            'url': self.partner_sync_url or self.partner_sync_production_url or self.partner_sync_sandbox_url,
            'username': self.partner_sync_username or self.partner_sync_production_username or self.partner_sync_sandbox_username,
            'password': self.partner_sync_password or self.partner_sync_production_password or self.partner_sync_sandbox_password,
            'timeout_seconds': self.partner_sync_timeout_seconds,
            'verify_tls': self.partner_sync_verify_tls,
        }

    @property
    def resolved_api_test_endpoint(self) -> str:
        return self.api_test_endpoint or self.production_api_test_endpoint or self.sandbox_api_test_endpoint

    def as2_connectivity_target(self, environment: str | None = None) -> dict[str, str | int | bool]:
        env = (environment or '').lower()
        env_url = self.as2_connectivity_production_url if env in {'production', 'prod'} else self.as2_connectivity_sandbox_url
        return {
            'url': self.as2_connectivity_url or env_url,
            'authorization': self.as2_connectivity_authorization,
            'username': self.as2_connectivity_username,
            'password': self.as2_connectivity_password,
            'timeout_seconds': self.as2_connectivity_timeout_seconds,
            'verify_tls': self.as2_connectivity_verify_tls,
        }


settings = Settings()
