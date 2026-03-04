# UNIS EDI Portal - Functional Specification Document

## Document Information

| Item | Description |
|------|-------------|
| Document Title | UNIS EDI Portal Functional Specification |
| Version | 4.0 |
| Date | March 2026 |
| Status | Major Update: Dual Integration Path, 5-Step Lifecycle, API Documentation, Connection Testing Redesign |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Authentication Module](#2-user-authentication-module)
3. [Dashboard Module](#3-dashboard-module)
4. [Trading Partner Management Module](#4-trading-partner-management-module)
5. [Certificate Management Module](#5-certificate-management-module)
6. [Message Specifications Module](#6-message-specifications-module)
7. [API Documentation Module](#7-api-documentation-module)
8. [Connection Testing Module](#8-connection-testing-module)
9. [Transaction Management Module](#9-transaction-management-module)
10. [Notification System Module](#10-notification-system-module)
11. [Data Models](#11-data-models)
12. [User Interface Specifications](#12-user-interface-specifications)

---

## 1. System Overview

### 1.1 System Purpose

UNIS EDI Portal is a B2B integration management platform that supports **two distinct integration paths**:

**EDI Path (Traditional):**
- X12 document exchange via AS2, SFTP, or VAN protocols
- Certificate-based authentication and encryption
- Segment-level message specifications
- 15 standard X12 document types

**API Path (Modern):**
- JSON document exchange via REST APIs
- Token/OAuth-based authentication
- JSON Schema specifications with X12 field mapping
- Same 15 document types in JSON format

**Unified Capabilities:**
- Hierarchical trading partner management with dual integration support
- 5-step integration lifecycle tracking (Partner Setup -> Communication Setup -> Connection Testing -> Integration Validation -> Go Live)
- Certificate management for secure communications
- API Documentation with per-message JSON Schema
- Connection testing (AS2 diagnostics or API endpoint testing)
- Payload validation (X12, JSON, XML)
- Transaction monitoring with EDI/API filtering
- Real-time notification system

### 1.2 Target Users

| User Type | Description |
|-----------|-------------|
| System Administrator | Full system access, user management, configuration |
| EDI Manager | Trading partner management (EDI path), certificate management |
| API Integration Developer | Trading partner management (API path), API documentation reference |
| Operations Staff | Transaction monitoring, document processing |
| Trading Partner Administrator (TPA) | Partner-specific configuration, specifications management |

### 1.3 Supported Document Types

| Code | Name | Category | Direction | JSON API Name |
|------|------|----------|-----------|---------------|
| 204 | Motor Carrier Load Tender | Transportation | Outbound | LoadTender |
| 210 | Freight Invoice | Transportation | Inbound | FreightInvoice |
| 214 | Shipment Status | Transportation | Both | ShipmentStatus |
| 810 | Invoice | Financial | Outbound | Invoice |
| 832 | Price/Sales Catalog | Inventory | Both | PriceCatalog |
| 846 | Inventory Inquiry/Advice | Inventory | Both | InventoryInquiryAdvice |
| 850 | Purchase Order | Order Management | Inbound | PurchaseOrder |
| 855 | Purchase Order Acknowledgment | Order Management | Outbound | PurchaseOrderAck |
| 856 | Advance Ship Notice (ASN) | Shipping | Outbound | AdvanceShipNotice |
| 940 | Warehouse Shipping Order | Warehouse | Outbound | WarehouseShippingOrder |
| 943 | Warehouse Stock Transfer Shipment | Warehouse | Outbound | WarehouseStockTransferShipment |
| 944 | Warehouse Stock Transfer Receipt | Warehouse | Inbound | WarehouseStockTransferReceipt |
| 945 | Warehouse Shipping Advice | Warehouse | Inbound | WarehouseShippingAdvice |
| 947 | Warehouse Inventory Adjustment | Warehouse | Inbound | WarehouseInventoryAdjustment |
| 990 | Response to Load Tender | Transportation | Inbound | LoadTenderResponse |
| 997 | Functional Acknowledgment | Acknowledgment | Both | FunctionalAck |

### 1.4 Navigation Structure (v4.0)

| # | Nav Item | Description |
|---|----------|-------------|
| 1 | Dashboard | Overview statistics, lifecycle table, recent activity |
| 2 | Trading Partners | Partner management with dual integration paths |
| 3 | Certificates | SSL/TLS certificate management |
| 4 | Message Specifications | UNIS standard + TP-specific specifications |
| 5 | API Documentation | **NEW** - JSON Schema docs with X12 mapping |
| 6 | Connection Testing | **Redesigned** - Partner-scoped AS2/API testing + payload validator |
| 7 | Transactions | Transaction monitoring with EDI/API type filtering |
| 8 | Notifications | System notifications |

---

## 2. User Authentication Module

### 2.1 Functional Description

The authentication module provides secure user login and registration functionality.

### 2.2 Features

#### 2.2.1 User Login

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Email | String | Yes | Valid email format |
| Password | String | Yes | Min 8 characters |

**Actions:**
- Sign In button
- Switch to Registration form
- Forgot Password link

#### 2.2.2 User Registration

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Full Name | String | Yes | Min 2 characters |
| Email | String | Yes | Valid email format, unique |
| Password | String | Yes | Min 8 chars, 1 uppercase, 1 number |
| Confirm Password | String | Yes | Must match password |

---

## 3. Dashboard Module

### 3.1 Statistics Cards (4-column grid)

| Metric | Description | Click Action | Sub-detail |
|--------|-------------|--------------|------------|
| Trading Partners | Count of configured partners | Navigate to Partners | EDI: X / API: Y |
| Today's Transactions | Count of today's transactions | Navigate to Transactions | EDI: X / API: Y |
| Active Certificates | Count of active certificates | Navigate to Certificates | Expiring soon: X |
| Pending Actions | Count of items requiring attention | Navigate to Notifications | Errors: X |

### 3.2 Partner Integration Lifecycle Table

Displays all trading partners with compact lifecycle pipeline:

| Column | Type | Description |
|--------|------|-------------|
| Partner Name | String + Badge | Partner name with integration type badge (EDI blue / API green) |
| Channel | String | Communication channel (AS2 / SFTP / VAN / REST API) |
| Pipeline | Visual | 5 small colored dots (completed=green, active=amber, pending=slate) + step label |
| Progress | Percentage | Numeric percentage (e.g., "60%") |
| Status | Badge | Current lifecycle status text |
| Action | Button | "View Details" navigates to Connection Testing |

**Compact Pipeline Visual:**
- 5 small dots (7px diameter), evenly spaced
- Completed steps: green fill
- Active step: amber fill with pulse animation
- Pending steps: slate/gray fill
- Below dots: current step name text
- Below name: thin progress bar

### 3.3 Recent Activity Feed

| Field | Type | Description |
|-------|------|-------------|
| Action | String | Description with partner name and code |
| Time | String | Relative timestamp |
| Status | Enum | success/warning/error |
| Partner | String | Trading partner name |
| Type | Badge | EDI or API |

---

## 4. Trading Partner Management Module

### 4.1 Dual Integration Path Architecture

The system supports two integration types per trading partner:

```
Trading Partner (Parent)
├── Integration Type: EDI
│   ├── Channel: AS2 / SFTP / VAN
│   ├── Subsidiaries
│   │   ├── AS2 Profiles
│   │   └── Message Routing Rules
│   └── Certificates
│
└── Integration Type: API
    ├── Channel: REST API / Webhook
    ├── API Config (base URL, auth, tokens)
    └── Document Types
```

### 4.2 Parent Trading Partner

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String | Auto | Unique identifier |
| name | String | Yes | Organization name |
| code | String | Yes | Short code (e.g., "WMT") |
| status | Enum | Yes | active / inactive |
| integrationType | Enum | Yes | edi / api |
| communicationChannel | String | Yes | AS2 / SFTP / VAN / REST API / Webhook |
| currentStepId | Number | Yes | 1-8 (1-7 = steps, 8 = fully live) |
| onboardingStartDate | String | Yes | Lifecycle start date |
| stepCompletionDates | Object | No | Record<stepId, dateString> |
| subsidiaries | Array | No | Subsidiaries (EDI path) |
| apiConfig | Object | No | API configuration (API path) |
| documentTypes | Array | Yes | Supported document type codes |
| lastSync | String | Auto | Last sync timestamp |
| transactionCount | Number | Auto | Total transaction count |

### 4.3 5-Step Integration Lifecycle Pipeline

#### 4.3.1 Pipeline Steps

| ID | Name | EDI Description | API Description | Stage Group |
|----|------|----------------|-----------------|-------------|
| 1 | Partner Setup | Register partner, exchange basic info | Register partner, create API credentials | Setup |
| 2 | Communication Setup | Exchange certs, configure AS2/SFTP/VAN | Configure API tokens, webhook endpoints | Setup |
| 3 | Connection Testing | Run AS2 7-step diagnostic | Test API endpoint connectivity | Testing |
| 4 | Integration Validation | Validate EDI document mapping | Validate JSON schema compliance | Testing |
| 5 | Go Live | Switch to production, activate monitoring | Enable prod API keys, activate monitoring | Live |

#### 4.3.2 Pipeline Display - Full Variant

Used in: Partner expanded view, Connection Testing partner detail

```
[1]---[2]---[3]---[4]---[5]
 |     |     |     |     |
Name  Name  Name  Name  Name
Desc  Desc  Desc  Desc  Desc
Date  Date  Date  Date  Date
```

Visual rules:
- Completed step: Green circle with checkmark, green connector line
- Active step: Amber circle with dot, pulsing animation
- Pending step: Slate circle (empty), gray connector line
- Below: step name, action description, completion date (if completed)
- Bottom: progress bar (width = completedSteps / totalSteps * 100%)

#### 4.3.3 Pipeline Display - Compact Variant

Used in: Dashboard lifecycle table, Partner list rows

```
[o][o][o][o][o]  Step 3: Connection Testing  |  60%
```

Visual rules:
- 5 small dots (7px), colored by status (green/amber/slate)
- Step label text showing current step name
- Numeric progress percentage

#### 4.3.4 Pipeline Summary Cards (Trading Partners Page)

| Card | Steps Covered | Color | Badge Count |
|------|--------------|-------|-------------|
| Setup | Steps 1-2 | Slate (bg-slate-50) | Count of partners in steps 1-2 |
| Testing | Steps 3-4 | Amber (bg-amber-50) | Count of partners in steps 3-4 |
| Live | Step 5+ | Green (bg-green-50) | Count of partners at step 5+ |

Clicking a card filters the partner list. Clicking again clears the filter.

### 4.4 Subsidiary (EDI Path)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String | Auto | Unique identifier |
| name | String | Yes | Subsidiary name |
| code | String | Yes | Short code |
| region | String | Yes | Geographic region |
| status | Enum | Yes | active / inactive |
| as2Profiles | Array | Yes | AS2 configurations |
| supportedDocTypes | Object | Yes | { x12: string[], edifact: string[] } |

### 4.5 AS2 Profile (EDI Path)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String | Auto | Unique identifier |
| name | String | Yes | Profile name |
| as2Id | String | Yes | AS2 Identifier |
| as2Url | String | Yes | AS2 endpoint URL |
| status | Enum | Yes | active / standby / inactive |
| encryptionCert | String | No | Encryption certificate |
| signingCert | String | No | Signing certificate |
| mdnRequired | Boolean | Yes | MDN requirement |
| mdnSigned | Boolean | Yes | Signed MDN requirement |
| encryptionAlgorithm | String | Yes | AES-128 / AES-256 / 3DES |
| signatureAlgorithm | String | Yes | SHA-1 / SHA-256 / SHA-512 |

### 4.6 API Configuration (API Path)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| baseUrl | String | Yes | API base URL |
| authMethod | Enum | Yes | Bearer Token / API Key / OAuth 2.0 |
| apiKey | String | Yes | API key or token (masked in display) |
| webhookUrl | String | No | Webhook endpoint URL |
| webhookSecret | String | No | Webhook signing secret (masked) |
| rateLimit | String | No | Rate limit configuration |

### 4.7 Add Partner Wizard (5-Step Channel-Aware)

**Step 1: Basic Information**

| Field | Type | Required |
|-------|------|----------|
| Partner Name | String | Yes |
| Partner Code | String | Yes (auto-uppercase) |
| Partner Type | Select | Yes |

Partner Types: retailer, distributor, 3pl, carrier, marketplace

**Step 2: Integration Path**

Two visual selection cards:

| Card | Title | Description | Icon |
|------|-------|-------------|------|
| EDI | EDI Integration | Traditional X12, certificate-based security, AS2/SFTP/VAN | Network icon |
| API | API Integration | Modern JSON, token-based auth, REST API/Webhook | Code icon |

**Step 3: Channel Configuration**

*EDI sub-step:*

| Field | Type | Required | Condition |
|-------|------|----------|-----------|
| Protocol | Select | Yes | AS2 / SFTP / VAN |
| AS2 ID | Text | Conditional | AS2 only |
| AS2 URL | Text | Conditional | AS2 only |
| SFTP Host | Text | Conditional | SFTP only |
| SFTP Port | Number | Conditional | SFTP only, default 22 |
| SFTP Username | Text | Conditional | SFTP only |
| VAN Provider | Select | Conditional | VAN only |
| VAN Mailbox ID | Text | Conditional | VAN only |
| Encryption Algorithm | Select | Yes | AES-128/AES-256/3DES |
| Signing Algorithm | Select | Yes | SHA-1/SHA-256/SHA-512 |
| MDN Type | Select | Conditional | AS2 only (Sync/Async) |

*API sub-step:*

| Field | Type | Required | Condition |
|-------|------|----------|-----------|
| API Base URL | Text | Yes | - |
| Auth Method | Select | Yes | Bearer Token / API Key / OAuth 2.0 |
| API Key / Token | Text | Yes | - |
| Webhook URL | Text | No | - |
| Webhook Secret | Text | Conditional | Required if webhook URL set |
| Rate Limit | Select | No | 100/min, 500/min, 1000/min, Unlimited |

**Step 4: Document Types**

Multi-checkbox selection. Available types:
204, 210, 214, 810, 832, 846, 850, 855, 856, 940, 943, 944, 945, 947, 990, 997

**Step 5: Review & Confirm**

Summary display of all configured fields, grouped by step. Each section has an "Edit" link back to the corresponding step. "Create Partner" button to finalize.

### 4.8 Message Routing Configuration

Unchanged from v3.0. Configured at subsidiary level for EDI partners.

### 4.9 Partner List UI

| Column | Description |
|--------|-------------|
| Partner Name | Name + integration type badge (EDI blue / API green) |
| Code | Partner code |
| Channel | Communication channel type |
| Status | Active/Inactive badge |
| Lifecycle Pipeline | Compact 5-step pipeline display |
| Progress | Percentage |
| Actions | Expand, Connection Test, Inactive |

**Filters:**

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Name, code |
| Integration Type | Toggle | All / EDI / API |
| Pipeline Stage Card | Button | Setup / Testing / Live |

---

## 5. Certificate Management Module

### 5.1 Overview

Unchanged from v3.0. Certificates are managed with environment separation (Production/Sandbox).

### 5.2 Certificate Entity

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | Number | Auto | Unique identifier |
| name | String | Yes | Certificate display name |
| serialNumber | String | Auto | Certificate serial number |
| fingerprint | String | Auto | SHA-256 fingerprint |
| issuer | String | Auto | Certificate issuer |
| subject | String | Auto | Certificate subject (CN) |
| algorithm | String | Auto | Signing algorithm |
| keySize | String | Auto | Key size in bits |
| created | String | Auto | Upload date |
| expires | String | Auto | Expiration date |
| usage | Enum | Yes | Encryption / Signing / Server Auth / AS2 / SSL |
| type | String | Yes | X.509 / PKCS#12 / PEM |
| status | Enum | Auto | active / expiring / expired |
| partner | String | Yes | Associated trading partner |
| environment | Enum | Yes | production / sandbox |

### 5.3 Search and Filter

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Name, Partner, Serial Number |
| Status | Select | All, Active, Expiring Soon, Expired |
| Expiration | Select | All, 30 days, 60 days, 90 days |
| Partner | Select | All partners list |

### 5.4 Certificate Upload Form

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Target Environment | Radio | Yes | Production / Sandbox |
| Certificate File | File | Yes | .pem, .cer, .crt, .pfx, .p12 |
| Certificate Name | String | Yes | Display name |
| Trading Partner | Select | Yes | Partner association |
| Usage Purpose | Select | Yes | Encryption/Signing/Server Auth/AS2/SSL |
| Certificate Type | Select | Yes | X.509/PKCS#12/PEM |

### 5.5 UNIS Certificates Section

Unchanged from v3.0. Search by AS2 ID or Serial Number, download individual or batch.

---

## 6. Message Specifications Module

### 6.1 Section Tabs

| Tab | Description |
|-----|-------------|
| UNIS Standard Specifications | Download UNIS standard EDI specifications |
| Trading Partner Specifications | Manage TP-specific specification documents |

### 6.2 UNIS Standard Specification

| Field | Type | Description |
|-------|------|-------------|
| code | String | EDI document code |
| name | String | Document name |
| description | String | Brief description |
| category | Enum | Order Management / Warehouse / Shipping / Financial / Inventory / Acknowledgment |
| version | String | Specification version |
| lastUpdated | String | Last update date |

#### 6.2.1 Available Downloads per Specification

| Document Type | Format | Description |
|---------------|--------|-------------|
| Implementation Guide | PDF | Detailed implementation instructions |
| Segment Directory | Excel | Field-level segment details |
| Sample Message | X12 | Example X12 formatted message |
| JSON Schema | JSON | JSON schema for validation |

#### 6.2.2 Category Filter Options

- All Categories
- Order Management (850, 855)
- Warehouse (940, 943, 944, 945, 947)
- Shipping (856, 204, 210, 214)
- Financial (810)
- Inventory (832, 846)
- Acknowledgment (997)

### 6.3 Trading Partner Specification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | String | Auto | Unique identifier |
| messageType | String | Yes | EDI document code |
| messageName | String | Yes | Document name |
| partner | String | Yes | Trading partner name |
| partnerCode | String | Yes | Partner code |
| version | String | Yes | Specification version |
| uploadedDate | String | Auto | Upload timestamp |
| uploadedBy | String | Auto | Uploader email |
| fileType | Enum | Yes | PDF / Excel / X12 / JSON |
| fileName | String | Auto | Original file name |
| size | String | Auto | File size |

---

## 7. API Documentation Module (NEW in v4.0)

### 7.1 Functional Description

The API Documentation module provides comprehensive, developer-friendly documentation for UNIS JSON API integration. Each message type includes full JSON Schema specification with X12 field mapping, sample payloads, and response examples. This module serves API-path partners but is accessible to all users.

### 7.2 Page Layout

#### 7.2.1 Header Section

| Element | Description |
|---------|-------------|
| Title | "API Documentation" |
| Subtitle | "Comprehensive JSON API schema documentation with X12 field mapping for all UNIS message types" |
| Search | Full-text search by message code or name |
| Category Filter | Dropdown with categories |

#### 7.2.2 Message List (Left Panel / Cards)

| Column | Description |
|--------|-------------|
| Message Name | JSON API name (e.g., "PurchaseOrder") |
| EDI Equivalent | Badge showing X12 code (e.g., "850") |
| Category | Category badge |
| Direction | IN / OUT / Both |
| Field Count | Total number of fields |
| Version | Schema version |

#### 7.2.3 Message Categories

| Category | Messages |
|----------|---------|
| Order Management | PurchaseOrder (850), PurchaseOrderAck (855) |
| Shipping | AdvanceShipNotice (856) |
| Financial | Invoice (810) |
| Transportation | LoadTender (204), LoadTenderResponse (990), ShipmentStatus (214), FreightInvoice (210) |
| Warehouse / Inventory | WarehouseShippingOrder (940), WarehouseShippingAdvice (945), WarehouseStockTransferShipment (943), WarehouseStockTransferReceipt (944), InventoryInquiryAdvice (846), WarehouseInventoryAdjustment (947) |

### 7.3 Message Detail View

#### 7.3.1 Header Section

| Element | Description |
|---------|-------------|
| Message Name | e.g., "PurchaseOrder" |
| EDI Equivalent | Badge (e.g., "EDI 850") |
| Version | Schema version (e.g., "v2.1") |
| Category | Category name |
| Direction | Inbound / Outbound |
| Description | Detailed message description |

#### 7.3.2 Statistics Bar

| Stat | Description |
|------|-------------|
| Total Fields | Total number of schema fields |
| Required Fields | Count of required fields |
| X12 Mapped Fields | Count of fields with X12 mapping |

#### 7.3.3 API Endpoint Section

| Element | Description |
|---------|-------------|
| Method | HTTP method badge (e.g., POST green) |
| Path | Endpoint path (e.g., `/api/v2/messages/purchase-order`) |
| Description | Endpoint purpose |
| Headers | Required headers table |

**Required Headers:**

| Header | Value | Description |
|--------|-------|-------------|
| Content-Type | application/json | Request content type |
| Authorization | Bearer {token} | Authentication token |
| X-UNIS-Partner-ID | {partner_id} | Target partner identifier |
| X-Message-Type | {message_type} | Message type code |

#### 7.3.4 JSON Schema Table

Recursive table displaying nested field structure:

| Column | Description |
|--------|-------------|
| Name | Field name with indentation for nesting (chevron for object/array) |
| Type | Data type badge (string/integer/number/boolean/object/array) |
| Required | Red star icon if required |
| Description | Field description |
| X12 Mapping | Orange badge showing X12 segment/element (e.g., "BEG03") |
| Example | Example value |

**Type Badge Colors:**

| Type | Color |
|------|-------|
| string | Blue (bg-blue-100) |
| integer / number | Purple (bg-purple-100) |
| boolean | Amber (bg-amber-100) |
| object | Slate (bg-slate-100) |
| array | Cyan (bg-cyan-100) |
| enum | Pink (bg-pink-100) |

**Nesting Behavior:**
- Object and array types have a chevron toggle (ChevronRight/ChevronDown)
- Clicking toggles visibility of child fields
- Child fields are indented with left padding (depth * 24px)
- Alternating row backgrounds for readability

#### 7.3.5 Sample Payload Section

| Element | Description |
|---------|-------------|
| Tab | "Sample Payload" |
| Content | Formatted JSON with syntax highlighting |
| Copy Button | Copy to clipboard |
| Line Numbers | Optional line numbers |

#### 7.3.6 Response Example Section

| Element | Description |
|---------|-------------|
| Tab | "Response Example" |
| Content | Expected response JSON |
| Copy Button | Copy to clipboard |

### 7.4 API Documentation Data Model

#### 7.4.1 APIMessage

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| name | String | JSON message name (e.g., "PurchaseOrder") |
| ediEquivalent | String | X12 code (e.g., "850") |
| version | String | Schema version |
| category | Enum | Same categories as UNIS specs |
| direction | Enum | inbound / outbound / both |
| description | String | Detailed description |
| endpoint | Object | { method, path, description, headers } |
| schema | Array[SchemaField] | Recursive field definitions |
| samplePayload | String | JSON sample payload |
| responseExample | String | JSON response example |

#### 7.4.2 SchemaField

| Field | Type | Description |
|-------|------|-------------|
| name | String | JSON field name |
| type | Enum | string / integer / number / boolean / object / array |
| required | Boolean | Whether field is required |
| description | String | Field description |
| x12Mapping | String | X12 segment/element (e.g., "BEG03") |
| example | String | Example value |
| enum | Array[String] | Allowed values (if constrained) |
| format | String | Format hint (date, date-time, etc.) |
| pattern | String | Regex pattern |
| maxLength | Number | Max string length |
| children | Array[SchemaField] | Nested fields |

---

## 8. Connection Testing Module (Redesigned in v4.0)

### 8.1 Functional Description

The Connection Testing module provides partner-scoped testing capabilities that adapt based on the partner's integration type (EDI or API). It includes AS2 7-step diagnostics, API endpoint testing, document testing matrix, and a payload validator.

### 8.2 Page Layout

#### 8.2.1 Partner List (Left Panel)

| Column | Description |
|--------|-------------|
| Partner Name | With integration type badge |
| Channel | Communication channel type |
| Lifecycle | Compact 5-step pipeline |
| Progress | Percentage |

Clicking a partner shows its testing detail.

#### 8.2.2 Partner Testing Detail (Right Panel)

**Tabs:**

| Tab | Description | Phase | Lock Condition |
|-----|-------------|-------|----------------|
| Connection Test | AS2 diagnostics or API test console | Phase 3 | Locked until step >= 3 |
| Document Testing | Document test matrix per doc type | Phase 2 | Locked until step >= 4 |
| Payload Validator | Format validation for X12/JSON/XML | Phase 1 (Active) | Always accessible |

### 8.3 Connection Test Tab (EDI Partners - AS2)

7-step diagnostic sequence:

| Step | Name | Description |
|------|------|-------------|
| 1 | DNS Resolution | Resolve AS2 endpoint hostname |
| 2 | TCP Connection | Establish TCP on port 443 |
| 3 | TLS Handshake | Verify TLS certificate chain |
| 4 | Certificate Validation | Validate encryption & signing certs |
| 5 | AS2 Handshake | Send AS2 ping message |
| 6 | MDN Response | Await MDN |
| 7 | EDI Compliance | Verify ISA/GS envelope compliance |

**Step Display:**
- Step number circle
- Step name
- Status indicator (pass=green check / fail=red X / pending=gray spinner)
- Detail text
- Duration (e.g., "45ms")

**Actions:** Run Test, Re-run Test

### 8.4 Connection Test Tab (API Partners)

**API Test Console:**

| Element | Description |
|---------|-------------|
| Method Selector | GET / POST / PUT / DELETE |
| Endpoint URL | Pre-filled from partner config |
| Headers Editor | Key-value header pairs |
| Request Body | JSON editor with syntax highlighting |
| Send Test Button | Execute request |
| Response Area | Status code, headers, body |
| Test History | Recent test attempts |

### 8.5 Document Testing Tab

**Document Test Matrix:**

| Column | Description |
|--------|-------------|
| Document Type | EDI code + name |
| Direction | Inbound / Outbound badge |
| Test Count | Number of test submissions |
| Latest Result | Pass (green) / Fail (red) / Pending (amber) badge |
| Error Count | Number of validation errors |
| Actions | View Errors, Submit Test |

**Validation Error Detail (per document):**

| Field | Description |
|-------|-------------|
| Segment | X12 segment or JSON field reference |
| Element | Element position or nested path |
| Expected | Expected value or format |
| Actual | Actual value received |
| Severity | Error (red) / Warning (amber) |

### 8.6 Payload Validator Tab

#### 8.6.1 Input Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| Format | Select | Yes | X12 EDI / JSON / XML |
| Direction | Select | Yes | Inbound / Outbound |
| Partner | Select | No | Trading partners list or "UNIS Standard" |
| Payload | Textarea | Yes | Paste or type content |

#### 8.6.2 Actions

| Action | Description |
|--------|-------------|
| Validate Payload | Run validation against selected format/partner |
| Load Sample | Load a sample payload for the selected format |
| Clear | Clear the textarea |

#### 8.6.3 Validation Result

| Field | Type | Description |
|-------|------|-------------|
| valid | Boolean | Overall validation result |
| errorCount | Number | Count of critical errors |
| warningCount | Number | Count of warnings |
| errors | Array[String] | Critical error messages |
| warnings | Array[String] | Warning messages |

### 8.7 Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Payload Validator (frontend format validation) | Active |
| Phase 2 | Document Testing (submit reports, structured errors) | Planned |
| Phase 3 | AS2/API Connection Test (real diagnostic execution) | Planned |

---

## 9. Transaction Management Module

### 9.1 Dual Channel Support

Transactions display both EDI and API transactions in a unified interface.

### 9.2 Transaction Entity

| Field | Type | Description |
|-------|------|-------------|
| id | String | Transaction ID (e.g., TRX-850-001) |
| type | String | Document type code |
| typeName | String | Document type name |
| partner | String | Trading partner name |
| integrationType | Enum | edi / api |
| channel | String | AS2 / SFTP / VAN / REST API |
| direction | Enum | inbound / outbound |
| status | Enum | completed / processing / error / pending |
| date | String | Transaction date |
| time | String | Transaction time |
| size | String | Document size |
| records | Number | Number of records |
| controlNumber | String | ISA control number (EDI) or Request ID (API) |
| senderId | String | ISA sender ID (EDI) or API client ID (API) |
| receiverId | String | ISA receiver ID (EDI) or partner ID (API) |
| raw | String | Raw X12 content (EDI) or JSON content (API) |
| logs | Array | Processing log entries |
| errors | Array | Error entries (if any) |

### 9.3 Search and Filter

| Filter | Type | Description |
|--------|------|-------------|
| Search | Text | Transaction ID, Partner, Control Number, Sender/Receiver ID |
| Integration Type | Toggle Button | All / EDI (AS2/SFTP) / API (REST) |
| Document Type | Button Group | All Types + individual type buttons |
| Status | Select | All / Completed / Processing / Error / Pending |
| Direction | Select | All / Inbound / Outbound |
| Partner | Select | Trading partner list |
| Date From | Date | Start date filter |
| Date To | Date | End date filter |

### 9.4 Transaction Summary Bar

| Metric | Description |
|--------|-------------|
| Total | Total filtered count / Total count |
| EDI | Count of EDI transactions in current filter |
| API | Count of API transactions in current filter |

### 9.5 Enhanced Transaction Status

#### 9.5.1 Multi-dimensional Status Bar

| Indicator | Values | Visual |
|-----------|--------|--------|
| Validation | Valid (green) / Invalid (red) / Pending (amber) | Colored dot + label |
| Delivery | Delivered (green) / Pending (amber) | Colored dot + label |
| 997 Ack | Accepted (green) / Rejected (red) / N/A (slate) | Colored dot + label |
| Stream | Live (green badge) / Test (amber badge) | Badge |
| Direction | IN (cyan badge) / OUT (purple badge) | Badge |
| Type | EDI (blue badge) / API (green badge) | Badge |

#### 9.5.2 Additional Reference Fields

| Field | Type | Description |
|-------|------|-------------|
| Interchange Ref (ICN) | String | ISA control number (EDI) or Request ID (API) |
| Group Ref (GS) | String | GS group control number (EDI only) |
| Transaction Ref (ST) | String | ST transaction set control number (EDI only) |

### 9.6 Transaction Detail Modal

#### 9.6.1 Tabs

| Tab | Content |
|-----|---------|
| Raw X12 / JSON | Original document (X12 for EDI, JSON for API) |
| Errors | Validation errors and warnings |
| Logs | Processing log entries |

### 9.7 Export Function

Export filtered transactions to CSV/Excel with columns:
Transaction ID, Document Type, Type Name, Partner, Integration Type, Channel, Direction, Status, Date, Time, Size, Records, Control Number, Sender ID, Receiver ID

---

## 10. Notification System Module

### 10.1 Notification Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| Warning | Alert Triangle | Orange/Amber | Certificate expiring, sync delays |
| Error | X Circle | Red | Connection failures, validation errors |
| Info | Info Circle | Blue | System updates, new features |

**Note:** Transaction success notifications are not generated.

### 10.2 Notification Entity

| Field | Type | Description |
|-------|------|-------------|
| id | Number | Unique identifier |
| type | Enum | warning / error / info |
| title | String | Notification title |
| message | String | Detailed message |
| date | String | Notification date |
| time | String | Notification time |
| read | Boolean | Read status |
| archived | Boolean | Archive status |
| environment | Enum | production / sandbox |
| action | Object | Optional action link |
| details | Object | Additional details |

### 10.3 Notification Details Object

| Field | Type | Description |
|-------|------|-------------|
| partnerName | String | Related partner name |
| partnerCode | String | Related partner code |
| certificateName | String | Related certificate |
| expiresIn | String | Expiration period |
| errorCode | String | Error code reference |
| transactionId | String | Related transaction |
| endpoint | String | Related endpoint URL |

### 10.4 Filter Options

| Filter | Type | Options |
|--------|------|---------|
| Type | Button Group | All / Warning / Error / Info |
| Show Archived | Toggle | Yes / No |

### 10.5 Actions

| Action | Scope | Description |
|--------|-------|-------------|
| Mark All Read | Bulk | Mark all visible as read |
| Dismiss | Individual | Mark as read |
| Inactive | Individual | Archive notification |
| View Action | Individual | Navigate to related item |

---

## 11. Data Models

### 11.1 Complete TypeScript Interfaces

```typescript
// ==================== Trading Partner ====================

interface TradingPartner {
  id: string
  name: string
  code: string
  status: "active" | "inactive"
  integrationType: "edi" | "api"
  communicationChannel: string // AS2 / SFTP / VAN / REST API / Webhook
  currentStepId: number // 1-8 (1-7 = steps, 8 = fully live)
  onboardingStartDate: string
  stepCompletionDates?: Record<number, string>
  subsidiaries?: Subsidiary[]
  apiConfig?: APIConfig
  documentTypes: string[]
  lastSync?: string
  transactionCount?: number
  // Legacy fields (backward compatibility)
  industry?: string
  website?: string
  primaryContact?: {
    name: string
    email: string
    phone?: string
  }
}

interface APIConfig {
  baseUrl: string
  authMethod: "Bearer Token" | "API Key" | "OAuth 2.0"
  apiKey: string
  webhookUrl?: string
  webhookSecret?: string
  rateLimit?: string
}

interface Subsidiary {
  id: string
  name: string
  code: string
  region: string
  status: "active" | "inactive"
  as2Profiles: AS2Profile[]
  supportedDocTypes: {
    x12: string[]
    edifact: string[]
  }
}

interface AS2Profile {
  id: string
  name: string
  as2Id: string
  as2Url: string
  status: "active" | "standby" | "inactive"
  encryptionCert?: string
  signingCert?: string
  mdnRequired: boolean
  mdnSigned: boolean
  encryptionAlgorithm: string
  signatureAlgorithm: string
}

// ==================== 5-Step Lifecycle Pipeline ====================

interface LifecycleStep {
  id: number
  name: string
  ediAction: string
  apiAction: string
}

// Step definitions (constant):
// 1: Partner Setup
// 2: Communication Setup
// 3: Connection Testing
// 4: Integration Validation
// 5: Go Live
// currentStepId 6-7: reserved
// currentStepId 8: fully live (all steps completed)

// ==================== Message Routing ====================

interface MessageTypeConfig {
  messageType: string
  messageName: string
  direction: "inbound" | "outbound"
  enabled: boolean
}

interface RoutingRule {
  id: string
  messageType: string
  messageName: string
  routingType: "return_to_sender" | "specific_partner"
  targetPartner?: string
  targetSubsidiary?: string
  enabled: boolean
  description?: string
}

// ==================== Certificate ====================

interface Certificate {
  id: number
  name: string
  serialNumber: string
  fingerprint: string
  issuer: string
  subject: string
  algorithm: string
  keySize: string
  created: string
  expires: string
  usage: "Encryption" | "Signing" | "Server Auth" | "AS2 Communication" | "SSL"
  type: "X.509" | "PKCS#12" | "PEM"
  status: "active" | "expiring" | "expired"
  partner: string
  environment: "production" | "sandbox"
}

interface UNISCertificate {
  id: string
  name: string
  type: string
  as2Id: string
  serialNumber: string
  validFrom: string
  validTo: string
  algorithm: string
  keySize: string
  fingerprint: string
  environment: "production" | "sandbox"
}

// ==================== Transaction ====================

interface Transaction {
  id: string
  type: string
  typeName: string
  partner: string
  integrationType: "edi" | "api"
  channel: string // AS2 / SFTP / VAN / REST API
  direction: "inbound" | "outbound"
  status: "completed" | "processing" | "error" | "pending"
  date: string
  time: string
  size: string
  records: number
  controlNumber: string
  senderId: string
  receiverId: string
  raw: string
  logs: LogEntry[]
  errors?: ErrorEntry[]
}

interface LogEntry {
  timestamp: string
  level: "info" | "success" | "error" | "warning"
  message: string
}

interface ErrorEntry {
  code: string
  severity: "error" | "warning"
  segment: string
  position: string
  message: string
  suggestion: string
}

// ==================== Specification ====================

interface UNISSpecification {
  code: string
  name: string
  description: string
  category: "Order Management" | "Warehouse" | "Shipping" | "Financial" | "Inventory" | "Acknowledgment"
  version: string
  lastUpdated: string
}

interface TPSpecification {
  id: string
  messageType: string
  messageName: string
  partner: string
  partnerCode: string
  version: string
  uploadedDate: string
  uploadedBy: string
  fileType: "PDF" | "Excel" | "X12" | "JSON"
  fileName: string
  size: string
}

// ==================== API Documentation ====================

interface APIMessage {
  id: string
  name: string
  ediEquivalent: string
  version: string
  category: string
  direction: "inbound" | "outbound" | "both"
  description: string
  endpoint: {
    method: string
    path: string
    description: string
    headers: Array<{
      name: string
      value: string
      description: string
    }>
  }
  schema: SchemaField[]
  samplePayload: string
  responseExample: string
}

interface SchemaField {
  name: string
  type: "string" | "integer" | "number" | "boolean" | "object" | "array"
  required: boolean
  description: string
  x12Mapping?: string
  example?: string
  enum?: string[]
  format?: string
  pattern?: string
  maxLength?: number
  children?: SchemaField[]
}

// ==================== Connection Testing ====================

interface DocumentTestResult {
  documentType: string
  direction: "inbound" | "outbound"
  testCount: number
  latestResult: "pass" | "fail" | "pending" | "not-tested"
  errorCount: number
  lastTestedAt?: string
  validationErrors?: ValidationError[]
}

interface ValidationError {
  segment: string
  element: string
  expected: string
  actual: string
  severity: "error" | "warning"
}

interface ConnectionTestStep {
  step: number
  name: string
  status: "pass" | "fail" | "pending" | "running"
  detail: string
  duration?: string
}

// ==================== Notification ====================

interface Notification {
  id: number
  type: "warning" | "error" | "info"
  title: string
  message: string
  date: string
  time: string
  read: boolean
  archived: boolean
  environment: "production" | "sandbox"
  action?: {
    label: string
    href: string
  }
  details?: {
    partnerName?: string
    partnerCode?: string
    certificateName?: string
    expiresIn?: string
    errorCode?: string
    transactionId?: string
    endpoint?: string
  }
}

// ==================== User ====================

interface User {
  id: string
  email: string
  name: string
  company?: string
  createdAt: Date
  lastLogin: Date
}
```

---

## 12. User Interface Specifications

### 12.1 Navigation Structure

```
+--------------------------------------------------+
|  [Logo]  UNIS EDI Portal   Company: Midea Group   |
+--------------------------------------------------+
|  Sidebar          |     Main Content              |
|                   |                               |
| 1. Dashboard      |   [Tab Content Area]          |
| 2. Trading Partners                               |
| 3. Certificates   |                               |
| 4. Message Specs  |                               |
| 5. API Docs (NEW) |                               |
| 6. Connection Testing (Redesigned)                |
| 7. Transactions   |                               |
| 8. Notifications  |                               |
+-------------------+-------------------------------+
```

### 12.2 Integration Type Badges

| Type | Color | Style |
|------|-------|-------|
| EDI | Blue | bg-blue-100, text-blue-700 |
| API | Green | bg-green-100, text-green-700 |

### 12.3 Communication Channel Badges

| Channel | Display |
|---------|---------|
| AS2 | Blue badge |
| SFTP | Green badge |
| VAN | Orange badge |
| REST API | Purple badge |
| Webhook | Cyan badge |

### 12.4 Pipeline Step Colors

| State | Dot Color | Connector Color | Text |
|-------|-----------|-----------------|------|
| Completed | Green (bg-green-500) | Green (bg-green-400) | Green |
| Active | Amber (bg-amber-500, pulse) | Gray | Amber |
| Pending | Slate (bg-slate-300) | Gray | Muted |

### 12.5 Action Button Patterns

| Action Type | Style | Color |
|-------------|-------|-------|
| Primary Action | Solid | Primary (Blue) |
| Secondary Action | Outline | Border only |
| Destructive/Inactive | Outline | Amber (text-amber-600) |
| Download | Ghost | Primary text |

### 12.6 Status Indicators

| Status | Color | Background |
|--------|-------|------------|
| Active/Completed/Success | Green | bg-green-50, text-green-700 |
| Warning/Expiring/Standby | Amber | bg-amber-50, text-amber-700 |
| Error/Expired/Inactive | Red | bg-red-50, text-red-700 |
| Processing/Pending/Info | Blue | bg-blue-50, text-blue-700 |

### 12.7 Modal Specifications

| Property | Value |
|----------|-------|
| Overlay | Black 50% opacity |
| Max Width | 4xl (896px) - 6xl (1152px) |
| Max Height | 90vh |
| Position | Center of viewport |
| Scroll | Internal content scroll |

---

## Appendix A: Module Feature Matrix

| Module | Integration Awareness | Description |
|--------|----------------------|-------------|
| Dashboard | Yes - shows EDI/API split in stats, lifecycle pipeline | Enhanced |
| Trading Partners | Yes - dual path (EDI/API), 5-step lifecycle, channel-aware wizard | Major Redesign |
| Certificates | No change | TP + UNIS certificates |
| Message Specifications | No change | UNIS standard + TP specs |
| API Documentation | **New** | JSON Schema docs with X12 mapping |
| Connection Testing | **Redesigned** | Partner-scoped, AS2/API adaptive, phased rollout |
| Transactions | Yes - EDI/API type filter, channel display | Enhanced |
| Notifications | No change | Warning/Error/Info |

## Appendix B: v3.0 -> v4.0 Migration Summary

| v3.0 Component | v4.0 Status | Notes |
|----------------|-------------|-------|
| Communication Channels module | Removed | Absorbed into Partner Wizard Step 3 |
| Integration Testing module | Replaced | Now "Connection Testing" with different approach |
| Demo Partners | Removed | Testing is partner-scoped instead |
| Scenario Checklists | Removed | Replaced by Document Testing matrix |
| 3-stage Onboarding (Setup/Testing/Live) | Replaced | 5-step integration lifecycle |
| Partner `onboardingStage` field | Replaced | `currentStepId` (1-8) |
| Partner `nextStep` field | Replaced | Computed from step definitions |
| Environment toggles | Simplified | Removed from most headers |
| Overview (nav name) | Renamed | "Dashboard" |

## Appendix C: Error Codes

| Code | Category | Description |
|------|----------|-------------|
| VAL-001 | Validation | Missing required segment |
| VAL-002 | Validation | Invalid data element |
| VAL-003 | Validation | Segment out of order |
| VAL-004 | Validation | Invalid qualifier |
| CONN-001 | Connection | Partner endpoint unreachable |
| CONN-002 | Connection | AS2 handshake failed |
| CONN-003 | Connection | MDN not received |
| CONN-004 | Connection | API endpoint timeout |
| CONN-005 | Connection | API authentication failed |
| CERT-001 | Certificate | Certificate expired |
| CERT-002 | Certificate | Certificate validation failed |
| CERT-003 | Certificate | Certificate revoked |
| AUTH-001 | Authentication | Invalid credentials |
| AUTH-002 | Authentication | Session expired |
| ROUTE-001 | Routing | No routing rule configured |
| ROUTE-002 | Routing | Target partner inactive |
| API-VAL-001 | API Validation | Missing required JSON field |
| API-VAL-002 | API Validation | Invalid field type |
| API-VAL-003 | API Validation | Schema validation failed |
| TEST-001 | Testing | Document test submission failed |
| TEST-002 | Testing | Payload validation failed |

---

*End of Document - Version 4.0*
