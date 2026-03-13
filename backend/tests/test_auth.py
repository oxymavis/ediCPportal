def test_register_login_and_me_flow(client):
    register = client.post(
        '/v1/auth/register',
        json={
            'name': 'Test User',
            'email': 'test@example.com',
            'password': 'Password1',
            'confirmPassword': 'Password1',
            'rememberMe': False,
        },
    )
    assert register.status_code == 200
    body = register.json()
    assert body['success'] is True
    assert body['data']['user']['email'] == 'test@example.com'

    me = client.get('/v1/auth/me')
    assert me.status_code == 200
    me_body = me.json()
    assert me_body['success'] is True
    assert me_body['data']['user']['email'] == 'test@example.com'

    csrf = client.cookies.get('edi_csrf')
    logout = client.post('/v1/auth/logout', headers={'x-csrf-token': csrf}, json={})
    assert logout.status_code == 200
    assert logout.json()['success'] is True

    me_after_logout = client.get('/v1/auth/me')
    assert me_after_logout.status_code == 401


def test_protected_endpoint_requires_auth(client):
    response = client.get('/v1/partners')
    assert response.status_code == 401
