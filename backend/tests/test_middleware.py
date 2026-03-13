from app.core.config import settings


def test_security_headers_present(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.headers.get('x-content-type-options') == 'nosniff'
    assert response.headers.get('x-frame-options') == 'DENY'


def test_rate_limit_hits_429(client):
    last_status = None
    for _ in range(settings.rate_limit_requests + 2):
        response = client.get('/v1/meta/version')
        last_status = response.status_code
    assert last_status == 429


def test_ip_allowlist_blocks_request(client):
    prev_allowlist = settings.api_ip_allowlist
    settings.api_ip_allowlist = '1.1.1.1'
    try:
        response = client.get('/v1/oauth/clients')
        assert response.status_code == 403
        assert response.json()['code'] == 'IP_NOT_ALLOWED'
    finally:
        settings.api_ip_allowlist = prev_allowlist


def test_payload_too_large(client):
    prev_limit = settings.api_max_request_size_bytes
    settings.api_max_request_size_bytes = 32
    try:
        response = client.post('/v1/integrations/events', json={'oversize': 'x' * 1024})
        assert response.status_code == 413
        assert response.json()['code'] == 'PAYLOAD_TOO_LARGE'
    finally:
        settings.api_max_request_size_bytes = prev_limit
