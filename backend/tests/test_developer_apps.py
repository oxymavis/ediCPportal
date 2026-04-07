def _register(client, email: str, name: str = 'Dev User'):
    response = client.post(
        '/v1/auth/register',
        json={
            'name': name,
            'email': email,
            'password': 'Password1',
            'confirmPassword': 'Password1',
            'rememberMe': False,
        },
    )
    assert response.status_code == 200
    assert response.json()['success'] is True
    return response


def test_user_can_manage_own_oauth_clients(client):
    _register(client, 'dev1@example.com')

    create = client.post(
        '/v1/oauth/my/clients',
        json={
            'name': 'OMS App',
            'scopes': ['integrations:write', 'transactions:read'],
        },
    )
    assert create.status_code == 200
    body = create.json()
    assert body['success'] is True
    client_id = body['data']['client_id']
    client_secret = body['data']['client_secret']
    assert client_id.startswith('cli_')
    assert len(client_secret) > 20

    list_res = client.get('/v1/oauth/my/clients')
    assert list_res.status_code == 200
    rows = list_res.json()['data']
    assert len(rows) == 1
    assert rows[0]['client_id'] == client_id
    assert rows[0]['environment'] == 'all'

    rotate = client.post(f'/v1/oauth/my/clients/{client_id}/rotate-secret')
    assert rotate.status_code == 200
    rotated_secret = rotate.json()['data']['client_secret']
    assert rotated_secret != client_secret

    disable = client.put(f'/v1/oauth/my/clients/{client_id}/status', json={'status': 'disabled'})
    assert disable.status_code == 200
    assert disable.json()['data']['status'] == 'disabled'


def test_user_cannot_access_another_users_oauth_clients(client):
    _register(client, 'owner@example.com', name='Owner')
    create = client.post(
        '/v1/oauth/my/clients',
        json={
            'name': 'Private App',
            'scopes': ['integrations:write'],
        },
    )
    client_id = create.json()['data']['client_id']

    csrf = client.cookies.get('edi_csrf')
    logout = client.post('/v1/auth/logout', headers={'x-csrf-token': csrf}, json={})
    assert logout.status_code == 200

    _register(client, 'other@example.com', name='Other')
    list_res = client.get('/v1/oauth/my/clients')
    assert list_res.status_code == 200
    assert list_res.json()['data'] == []

    rotate = client.post(f'/v1/oauth/my/clients/{client_id}/rotate-secret')
    assert rotate.status_code == 404
