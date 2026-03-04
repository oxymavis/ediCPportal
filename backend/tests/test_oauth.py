from uuid import uuid4


def _get_token(client, client_id='openapi-default-client', client_secret='openapi-default-secret', scope=None):
    data = {
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret,
    }
    if scope:
        data['scope'] = scope
    res = client.post('/v1/oauth/token', data=data)
    assert res.status_code == 200
    assert res.json()['success'] is True
    return res.json()['data']['access_token']


def test_oauth_token_and_bearer_read(client):
    token = _get_token(client)
    res = client.get('/v1/partners', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert res.json()['success'] is True


def test_oauth_scope_enforced(client):
    create = client.post(
        '/v1/oauth/clients',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={
            'name': 'read-only-client',
            'scopes': 'partners:read',
            'environment': 'production',
        },
    )
    assert create.status_code == 200
    cid = create.json()['data']['client_id']
    csecret = create.json()['data']['client_secret']
    token = _get_token(client, cid, csecret, scope='partners:read')

    bad = client.post(
        '/v1/partners',
        headers={'Authorization': f'Bearer {token}'},
        json={'name': 'NoWrite', 'code': 'NOW', 'primaryContact': {'email': 'a@b.com'}},
    )
    assert bad.status_code == 403


def test_oauth_revoke(client):
    token = _get_token(client)
    revoke = client.post('/v1/oauth/revoke', data={'token': token})
    assert revoke.status_code == 200
    assert revoke.json()['success'] is True

    denied = client.get('/v1/transactions', headers={'Authorization': f'Bearer {token}'})
    assert denied.status_code == 401


def test_oauth_create_partner_with_write_scope(client):
    create = client.post(
        '/v1/oauth/clients',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={
            'name': f'writer-{uuid4().hex[:8]}',
            'scopes': 'partners:read partners:write',
            'environment': 'production',
        },
    )
    cid = create.json()['data']['client_id']
    csecret = create.json()['data']['client_secret']
    token = _get_token(client, cid, csecret)

    res = client.post(
        '/v1/partners',
        headers={'Authorization': f'Bearer {token}'},
        json={
            'name': 'OAuth Partner',
            'code': 'OAP',
            'primaryContact': {'name': 'Ops', 'email': 'ops@example.com'},
            'subsidiaries': [],
        },
    )
    assert res.status_code == 200
    assert res.json()['success'] is True


def test_oauth_rotate_secret_and_disable_client(client):
    create = client.post(
        '/v1/oauth/clients',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={'name': f'rot-{uuid4().hex[:8]}', 'scopes': 'partners:read', 'environment': 'production'},
    )
    cid = create.json()['data']['client_id']
    old_secret = create.json()['data']['client_secret']
    old_token = _get_token(client, cid, old_secret)
    assert client.get('/v1/partners', headers={'Authorization': f'Bearer {old_token}'}).status_code == 200

    rotate = client.post(f'/v1/oauth/clients/{cid}/rotate-secret', headers={'x-admin-key': 'dev-oauth-admin-key'})
    assert rotate.status_code == 200
    new_secret = rotate.json()['data']['client_secret']

    old_token_after_rotate = client.get('/v1/partners', headers={'Authorization': f'Bearer {old_token}'})
    assert old_token_after_rotate.status_code == 401

    new_token = _get_token(client, cid, new_secret)
    assert client.get('/v1/partners', headers={'Authorization': f'Bearer {new_token}'}).status_code == 200

    disable = client.put(
        f'/v1/oauth/clients/{cid}/status',
        headers={'x-admin-key': 'dev-oauth-admin-key'},
        data={'status': 'disabled'},
    )
    assert disable.status_code == 200
    disabled_token = client.get('/v1/partners', headers={'Authorization': f'Bearer {new_token}'})
    assert disabled_token.status_code == 401
