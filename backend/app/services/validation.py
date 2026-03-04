from __future__ import annotations

from fastapi import HTTPException, status


def validate_message_routing(message_routing: dict | None) -> dict:
    default = {'enabledTypes': [], 'rules': []}
    if not message_routing:
        return default

    enabled_types = message_routing.get('enabledTypes') or []
    rules = message_routing.get('rules') or []

    if not isinstance(enabled_types, list) or not isinstance(rules, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid messageRouting payload')

    for r in rules:
        routing_type = r.get('routingType')
        if routing_type not in {'return_to_sender', 'specific_partner'}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid routingType')
        if routing_type == 'specific_partner':
            if not r.get('targetPartner') or not r.get('targetSubsidiary'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='specific_partner requires targetPartner and targetSubsidiary',
                )

    return {'enabledTypes': enabled_types, 'rules': rules}
