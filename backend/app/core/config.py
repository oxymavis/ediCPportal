from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

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
    cors_origins: str = 'http://localhost:3000'
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
    sandbox_api_test_endpoint: str = 'https://httpbin.org/get'
    production_api_test_endpoint: str = 'https://httpbin.org/get'
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60
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


settings = Settings()
