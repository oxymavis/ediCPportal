from __future__ import annotations
import hashlib
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import APIClient, APIMessage, APIMessageMapping, APIMessageSample, APIMessageSchema, IntegrationClient, Notification, Partner, Subsidiary, UnisSpecification

UNIS_SPECS = [
    {'code': '850', 'name': 'Purchase Order', 'description': 'Request purchase of goods or services', 'category': 'Order Management', 'version': '005010', 'last_updated': '2024-01-15'},
    {'code': '855', 'name': 'Purchase Order Acknowledgment', 'description': 'Confirms receipt of PO', 'category': 'Order Management', 'version': '005010', 'last_updated': '2024-01-15'},
    {'code': '856', 'name': 'Advance Ship Notice', 'description': 'Shipment contents and carrier details', 'category': 'Shipping', 'version': '005010', 'last_updated': '2024-02-05'},
    {'code': '810', 'name': 'Invoice', 'description': 'Commercial invoice', 'category': 'Financial', 'version': '005010', 'last_updated': '2024-01-30'},
    {'code': '204', 'name': 'Motor Carrier Load Tender', 'description': 'Request to carrier to transport', 'category': 'Shipping', 'version': '005010', 'last_updated': '2024-01-25'},
    {'code': '210', 'name': 'Freight Invoice', 'description': 'Freight invoice from carrier', 'category': 'Shipping', 'version': '005010', 'last_updated': '2024-01-25'},
    {'code': '214', 'name': 'Shipment Status', 'description': 'Shipment location and delivery status', 'category': 'Shipping', 'version': '005010', 'last_updated': '2024-01-25'},
    {'code': '832', 'name': 'Price/Sales Catalog', 'description': 'Product catalog with pricing', 'category': 'Inventory', 'version': '005010', 'last_updated': '2024-01-12'},
    {'code': '846', 'name': 'Inventory Inquiry/Advice', 'description': 'Inventory levels or request', 'category': 'Inventory', 'version': '005010', 'last_updated': '2024-01-18'},
    {'code': '940', 'name': 'Warehouse Shipping Order', 'description': 'Instruction to warehouse to ship', 'category': 'Warehouse', 'version': '005010', 'last_updated': '2024-02-01'},
    {'code': '943', 'name': 'Warehouse Stock Transfer Shipment', 'description': 'Goods transferred between warehouses', 'category': 'Warehouse', 'version': '005010', 'last_updated': '2024-02-01'},
    {'code': '944', 'name': 'Warehouse Stock Transfer Receipt', 'description': 'Confirmation of goods received', 'category': 'Warehouse', 'version': '005010', 'last_updated': '2024-02-01'},
    {'code': '945', 'name': 'Warehouse Shipping Advice', 'description': 'Notification that goods have been shipped', 'category': 'Warehouse', 'version': '005010', 'last_updated': '2024-02-01'},
    {'code': '947', 'name': 'Warehouse Inventory Adjustment', 'description': 'Inventory adjustments', 'category': 'Warehouse', 'version': '005010', 'last_updated': '2024-01-20'},
    {'code': '997', 'name': 'Functional Acknowledgment', 'description': 'Confirms receipt and syntax of EDI', 'category': 'Acknowledgment', 'version': '005010', 'last_updated': '2024-01-05'},
]


def seed_if_empty(db: Session):
    if db.query(UnisSpecification).count() == 0:
        db.add_all([UnisSpecification(**s) for s in UNIS_SPECS])

    if db.query(Partner).count() == 0:
        p = Partner(
            id='tp-001',
            name='Walmart',
            code='WMT',
            status='active',
            industry='retail',
            website='https://walmart.com',
            contact_name='EDI Team',
            contact_email='edi@walmart.com',
            contact_phone='+1-800-925-6278',
            integration_type='edi',
            communication_channel='AS2',
            current_step_id=2,
            onboarding_start_date='2024-01-01',
            step_completion_dates={'1': '2024-01-01', '2': '2024-01-15'},
            api_config=None,
            environment='production',
        )
        p.subsidiaries.append(
            Subsidiary(
                id='sub-wmt-us',
                name='Walmart US',
                code='WMT-US',
                region='United States',
                status='active',
                supported_doc_types_x12=['850', '855', '856', '810', '940', '945', '997'],
                supported_doc_types_edifact=[],
                message_routing={'enabledTypes': [], 'rules': []},
            )
        )
        db.add(p)
        ap = Partner(
            id='tp-002',
            name='Amazon API',
            code='AMZN',
            status='active',
            industry='ecommerce',
            website='https://amazon.com',
            contact_name='API Team',
            contact_email='api@amazon.com',
            contact_phone='+1-555-0000',
            integration_type='api',
            communication_channel='REST_API',
            current_step_id=3,
            onboarding_start_date='2024-02-01',
            step_completion_dates={'1': '2024-02-01', '2': '2024-02-05', '3': '2024-02-10'},
            api_config={'baseUrl': 'https://api.example.com', 'authMethod': 'OAuth 2.0', 'apiKey': '***MASKED***'},
            environment='sandbox',
        )
        db.add(ap)

    if db.query(Notification).count() == 0:
        db.add_all(
            [
                Notification(type='warning', title='Certificate Expiring Soon', message='AS2 Certificate for Target Stores expires in 30 days', date='2024-01-15', time='14:30', read=False, archived=False, environment='production'),
                Notification(type='info', title='New Trading Partner Added', message='Walmart has been configured.', date='2024-01-15', time='11:00', read=True, archived=False, environment='production'),
            ]
        )

    if db.query(IntegrationClient).count() == 0 and settings.parsed_integration_api_keys:
        seed_key = settings.parsed_integration_api_keys[0]
        db.add(
            IntegrationClient(
                id='integration-client-default',
                name='Default Integration Client',
                api_key_hash=hashlib.sha256(seed_key.encode('utf-8')).hexdigest(),
                status='active',
                allowed_sources=['edi', 'oms', 'wms', 'tms'],
            )
        )
    if db.query(APIClient).count() == 0:
        db.add(
            APIClient(
                client_id='openapi-default-client',
                name='Default OpenAPI Client',
                secret_hash=hash_password('openapi-default-secret'),
                status='active',
                scopes=[
                    'integrations:read', 'integrations:write',
                    'transactions:read', 'transactions:write',
                    'partners:read', 'partners:write',
                    'certificates:read', 'certificates:write',
                    'specifications:read', 'specifications:write',
                    'notifications:read', 'notifications:write',
                ],
                environment='production',
            )
        )

    if db.query(APIMessage).count() == 0:
        db.add_all(
            [
                APIMessage(code='850', name='PurchaseOrder', category='Order Management', x12_equivalent='850', version='v1'),
                APIMessage(code='856', name='AdvanceShipNotice', category='Shipping', x12_equivalent='856', version='v1'),
            ]
        )
        db.flush()
        db.add(APIMessageSchema(message_code='850', version='v1', schema={'type': 'object', 'required': ['orderNo']}))
        db.add(APIMessageSample(message_code='850', sample_type='request', content={'orderNo': 'PO-1001'}))
        db.add(APIMessageSample(message_code='850', sample_type='response', content={'accepted': True, 'id': 'PO-1001'}))
        db.add(APIMessageMapping(message_code='850', json_field='orderNo', x12_segment='BEG', x12_element='03', notes='Purchase Order Number'))

    db.commit()
