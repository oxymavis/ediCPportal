from __future__ import annotations
from pydantic import BaseModel


class PrimaryContact(BaseModel):
    name: str
    email: str
    phone: str | None = None


class AS2ProfileSchema(BaseModel):
    id: str
    name: str
    as2Id: str
    as2Url: str
    status: str
    encryptionCert: str | None = None
    signingCert: str | None = None
    mdnRequired: bool = True
    mdnSigned: bool = True
    encryptionAlgorithm: str = 'AES-256'
    signatureAlgorithm: str = 'SHA-256'


class SubsidiarySchema(BaseModel):
    id: str
    name: str
    code: str
    region: str
    status: str
    supportedDocTypes: dict
    as2Profiles: list[AS2ProfileSchema] = []
    messageRouting: dict | None = None


class PartnerSchema(BaseModel):
    id: str
    name: str
    code: str
    status: str
    industry: str
    website: str | None = None
    primaryContact: PrimaryContact
    subsidiaries: list[SubsidiarySchema] = []
    environment: str | None = None


class CertificateSchema(BaseModel):
    id: int
    name: str
    serialNumber: str
    fingerprint: str
    issuer: str
    subject: str
    algorithm: str
    keySize: str
    created: str
    expires: str
    usage: str
    type: str
    status: str
    partner: str
    environment: str


class TransactionSchema(BaseModel):
    id: str
    type: str
    docType: str
    typeName: str
    partner: str
    direction: str
    status: str
    date: str
    time: str
    size: str
    records: int
    controlNumber: str
    senderId: str
    receiverId: str
    sourceSystem: str
    externalEventId: str | None = None
    idempotencyKey: str | None = None
    businessRefs: dict = {}
    controlRefs: dict = {}
    occurredAt: str | None = None
    raw: str
    logs: list
    errors: list | None = None
    environment: str


class NotificationSchema(BaseModel):
    id: int
    type: str
    title: str
    message: str
    date: str
    time: str
    read: bool
    archived: bool
    environment: str
    action: dict | None = None
    details: dict | None = None


class UnisSpecificationSchema(BaseModel):
    code: str
    name: str
    description: str
    category: str
    version: str
    lastUpdated: str


class TpSpecificationSchema(BaseModel):
    id: str
    messageType: str
    messageName: str
    partner: str
    partnerCode: str
    version: str
    uploadedDate: str
    uploadedBy: str
    fileType: str
    fileName: str
    size: str
    status: str
