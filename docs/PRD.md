# UNIS EDI Portal - Product Requirements Document (PRD)

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-XX | Product Team | Initial release |
| 2.0 | 2026-02-XX | Product Team | Major update: Hierarchical TP, Message Routing, Specifications |
| 3.0 | 2026-03-XX | Product Team | Orderful-informed: Onboarding Lifecycle, Integration Testing, Communication Channels |
| 4.0 | 2026-03-XX | Product Team | Dual Integration Path (EDI/API), 5-Step Lifecycle, API Documentation, Connection Testing redesign, Communication Channels absorbed into TP setup |

---

## 1. Executive Summary

### 1.1 Product Overview

UNIS EDI Portal is a customer-facing web application designed to facilitate Electronic Data Interchange (EDI) and API-based integrations between businesses and their trading partners. The platform supports two distinct integration paths:

**EDI Integration Path (AS2/SFTP/VAN):**
- Traditional X12 EDI document exchange via AS2, SFTP, or VAN protocols
- Certificate-based authentication and encryption
- Segment-level message specifications

**API Integration Path (REST):**
- Modern JSON-based document exchange via REST APIs
- Token/webhook-based authentication
- JSON Schema message specifications with X12 field mapping

**Core Capabilities (Both Paths):**
- Manage hierarchical trading partner structures (Parent-Subsidiary model)
- Track partner integration lifecycle through a 5-step pipeline
- Submit and receive documents across 15+ document types
- Manage SSL/TLS certificates for secure communications
- Configure message routing rules for outbound documents
- Manage message specifications per trading partner
- Reference comprehensive API documentation with X12 field mappings
- Run connection tests (AS2 diagnostics or API endpoint testing)
- Validate EDI/JSON payloads against UNIS specifications
- Monitor transaction statuses with validation, delivery, and acknowledgment tracking

### 1.2 Business Objectives

- Support dual integration paths (EDI and API) to serve both traditional and modern partners
- Simplify integration for customers who lack native X12 capabilities via API-first approach
- Provide transparent, self-service integration lifecycle tracking (5-step pipeline)
- Enable developer self-service through comprehensive API documentation
- Support complex enterprise structures with multi-level trading partner hierarchies
- Enable flexible message routing to multiple retail partners
- Reduce implementation time for new trading partners
- Enable real-time transaction visibility across both EDI and API channels

### 1.3 Target Audience

**Primary Users:**
- Supply chain managers
- Logistics coordinators
- EDI specialists
- API integration developers
- Trading Partner Administrators (TPA)

**Secondary Users:**
- IT administrators
- Compliance officers

**User Personas:**
- Large retail platforms (Walmart, Target) using traditional EDI via AS2
- E-commerce platforms (Amazon, Costco) using modern API integration
- Third-party logistics providers (3PLs) handling multi-client operations
- EDI service providers (SPS Commerce) with complex routing needs
- Small-to-medium businesses without EDI infrastructure adopting API path

### 1.4 Success Metrics

| Metric | Target |
|--------|--------|
| User onboarding completion rate | >80% |
| Transaction processing success rate | >99% |
| Average transaction submission time | <2 minutes |
| User satisfaction score (NPS) | >40 |
| Partner configuration time (EDI) | <30 minutes |
| Partner configuration time (API) | <15 minutes |
| Message routing accuracy | >99.9% |
| Integration lifecycle transparency | 100% visibility at each step |

---

## 2. Product Scope

### 2.1 In Scope (Phase 4)

- User authentication and authorization
- Dual integration path support (EDI via AS2/SFTP/VAN + API via REST)
- Hierarchical trading partner management (Parent-Subsidiary-AS2 Profile)
- 5-step integration lifecycle management (Partner Setup -> Communication Setup -> Connection Testing -> Integration Validation -> Go Live)
- Multi-level AS2 configuration management (EDI path)
- API token and webhook configuration management (API path)
- Channel-aware Add Partner wizard (5-step: Basic Info -> Integration Path -> Channel Config -> Document Types -> Review)
- Message type configuration per subsidiary
- Message routing rules (return to sender / specific partner)
- Certificate management
- UNIS certificate distribution
- Message specifications management (UNIS standard + TP-specific)
- **API Documentation module** with per-message JSON Schema, X12 field mapping, sample payloads, and response examples
- Connection testing (AS2 7-step diagnostics for EDI / API endpoint testing for REST)
- Payload validator (X12, JSON, XML)
- Transaction monitoring with EDI/API type filtering and enhanced status tracking
- Advanced search and filtering with 15+ document types
- Excel export functionality
- Real-time notification system

### 2.2 Out of Scope (Future Phases)

- Multi-tenancy and white-labeling
- AI-assisted EDI mapping (similar to Orderful Mosaic)
- Pre-connected partner network marketplace
- Custom document type definitions
- Role-based access control (RBAC) with Leader/Follower model
- Audit logging and compliance reporting
- Order fulfillment management
- Product catalog management
- Automated webMethods integration (Phase 4 of backend roadmap)

---

## 3. Functional Requirements

### 3.1 Authentication & User Management

#### 3.1.1 User Registration

**User Story:** As a new customer, I want to create an account so that I can access the EDI Portal.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-001 | System shall provide email/password registration | Must Have |
| FR-AUTH-002 | System shall validate email format and password strength (min 8 chars, 1 uppercase, 1 number) | Must Have |
| FR-AUTH-003 | System shall send verification email upon registration | Should Have |
| FR-AUTH-004 | System shall prevent duplicate email registrations | Must Have |
| FR-AUTH-005 | System shall display clear error messages for validation failures | Must Have |

**Acceptance Criteria:**
- User can complete registration in <60 seconds
- Password requirements are clearly communicated
- Success/error states are visually distinct

#### 3.1.2 User Login

**User Story:** As a registered user, I want to securely log in to access my account.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-010 | System shall authenticate users with email and password | Must Have |
| FR-AUTH-011 | System shall implement session management with 24-hour expiry | Must Have |
| FR-AUTH-012 | System shall provide "Remember Me" option for 30-day sessions | Should Have |
| FR-AUTH-013 | System shall redirect authenticated users to dashboard | Must Have |
| FR-AUTH-014 | System shall handle authentication errors gracefully | Must Have |

---

### 3.2 Dashboard & Overview

#### 3.2.1 Dashboard Layout

**User Story:** As a user, I want a centralized dashboard to view my EDI/API activity at a glance.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DASH-001 | System shall display dashboard with navigation sidebar | Must Have |
| FR-DASH-002 | System shall show company name in header | Must Have |
| FR-DASH-003 | System shall provide navigation to all major sections in order: Dashboard, Trading Partners, Certificates, Message Specifications, API Documentation, Connection Testing, Transactions, Notifications | Must Have |
| FR-DASH-004 | System shall display current active tab state | Must Have |
| FR-DASH-005 | System shall be responsive on desktop and tablet devices | Must Have |

#### 3.2.2 Dashboard Overview Tab

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DASH-010 | System shall display clickable statistics cards for: Trading Partners, Today's Transactions, Active Certificates, Pending Actions | Must Have |
| FR-DASH-011 | System shall display EDI/API transaction split in stats | Must Have |
| FR-DASH-012 | System shall display Partner Integration Lifecycle table with 5-step compact pipeline per partner | Must Have |
| FR-DASH-013 | System shall show integration type badge (EDI/API) per partner | Must Have |
| FR-DASH-014 | System shall display recent activity with partner names and codes | Must Have |
| FR-DASH-015 | Clicking statistics cards shall navigate to corresponding module | Must Have |

---

### 3.3 Trading Partner Management

#### 3.3.1 Dual Integration Path

**User Story:** As an EDI manager, I want to configure trading partners with either EDI (AS2/SFTP/VAN) or API (REST) integration paths so that I can support both traditional and modern partners.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PARTNER-001 | System shall support two integration types: "edi" and "api" | Must Have |
| FR-PARTNER-002 | System shall display integration type badge (EDI blue / API green) on each partner | Must Have |
| FR-PARTNER-003 | System shall store communication channel type per partner (AS2 / SFTP / VAN for EDI; REST API / Webhook for API) | Must Have |
| FR-PARTNER-004 | System shall support 3-level hierarchy: Parent TP > Subsidiary > AS2 Profile (EDI path) | Must Have |
| FR-PARTNER-005 | System shall support flat structure for API partners (Parent TP with API config) | Must Have |

**Data Model - Trading Partner (Parent):**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| id | String | Auto | UUID format |
| name | String | Yes | Max 100 chars |
| code | String | Yes | Max 10 chars, uppercase |
| status | Enum | Yes | active / inactive |
| integrationType | Enum | Yes | edi / api |
| communicationChannel | String | Yes | AS2 / SFTP / VAN (EDI) or REST API / Webhook (API) |
| currentStepId | Number | Yes | 1-8 (1-7 = steps, 8 = fully live) |
| onboardingStartDate | String | Yes | ISO date |
| stepCompletionDates | Object | No | Record of step -> completion date |
| subsidiaries | Array | No | List of subsidiary companies |
| as2Profiles | Array | No | AS2 profiles (EDI path only) |
| documentTypes | Array | Yes | Supported document type codes |
| lastSync | String | Auto | Last sync timestamp |
| transactionCount | Number | Auto | Total transaction count |

#### 3.3.2 5-Step Integration Lifecycle Pipeline

**User Story:** As a customer, I want to clearly see where each trading partner is in the integration process and what I need to do next.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-LIFECYCLE-001 | System shall support 5-step integration lifecycle | Must Have |
| FR-LIFECYCLE-002 | System shall display pipeline in full and compact variants | Must Have |
| FR-LIFECYCLE-003 | System shall show different action descriptions for EDI vs API paths | Must Have |
| FR-LIFECYCLE-004 | System shall display step completion dates | Should Have |
| FR-LIFECYCLE-005 | System shall calculate and display overall progress percentage | Must Have |

**5-Step Pipeline:**

| Step | Name | EDI Action | API Action | Status Colors |
|------|------|-----------|------------|---------------|
| 1 | Partner Setup | Register partner, exchange basic info | Register partner, create API credentials | Slate |
| 2 | Communication Setup | Exchange certificates, configure AS2/SFTP/VAN | Configure API tokens, webhook endpoints | Slate |
| 3 | Connection Testing | Run AS2 7-step diagnostic | Test API endpoint connectivity | Amber |
| 4 | Integration Validation | Validate EDI document mapping | Validate JSON schema compliance | Amber |
| 5 | Go Live | Switch to production, activate monitoring | Enable production API keys, activate monitoring | Green |

**Pipeline Display Variants:**
- **Full variant**: Horizontal stepper with step circles, names, action descriptions, completion dates, and progress bar
- **Compact variant**: Small colored dots (7px) with step labels and progress bar

**Pipeline Summary Cards (Partners Tab):**

| Group | Steps | Color | Description |
|-------|-------|-------|-------------|
| Setup | 1-2 | Slate | Partner and communication setup |
| Testing | 3-4 | Amber | Connection testing and validation |
| Live | 5+ | Green | Production active |

#### 3.3.3 Add Partner Wizard (5-Step Channel-Aware)

**User Story:** As an administrator, I want a guided wizard that adapts based on whether I'm adding an EDI or API partner.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PARTNER-020 | System shall provide 5-step wizard: Basic Info -> Integration Path -> Channel Config -> Document Types -> Review | Must Have |
| FR-PARTNER-021 | Step 2 shall present EDI vs API as visual selection cards | Must Have |
| FR-PARTNER-022 | Step 3 shall dynamically show fields based on selected path | Must Have |
| FR-PARTNER-023 | System shall validate each step before allowing progression | Must Have |
| FR-PARTNER-024 | System shall allow navigation back to previous steps | Must Have |

**Step 1 - Basic Information:**

| Field | Type | Required |
|-------|------|----------|
| Partner Name | Text | Yes |
| Partner Code | Text | Yes |
| Partner Type | Select | Yes (retailer/distributor/3pl/carrier/marketplace) |

**Step 2 - Integration Path Selection:**

Two visual cards:
- **EDI Integration** (AS2/SFTP/VAN): Traditional X12, certificate-based, suited for retailers
- **API Integration** (REST): Modern JSON, token-based, suited for e-commerce

**Step 3 - Channel Configuration (EDI path):**

| Field | Type | Required |
|-------|------|----------|
| Protocol | Select | Yes (AS2/SFTP/VAN) |
| AS2 ID | Text | Yes (AS2 only) |
| AS2 URL | Text | Yes (AS2 only) |
| SFTP Host | Text | Yes (SFTP only) |
| SFTP Port | Number | Yes (SFTP only) |
| VAN Provider | Select | Yes (VAN only) |
| VAN Mailbox ID | Text | Yes (VAN only) |
| Encryption Algorithm | Select | Yes |
| Signing Algorithm | Select | Yes |
| MDN Type | Select | Yes (AS2 only) |

**Step 3 - Channel Configuration (API path):**

| Field | Type | Required |
|-------|------|----------|
| API Base URL | Text | Yes |
| Auth Method | Select | Yes (Bearer Token/API Key/OAuth 2.0) |
| API Key / Token | Text | Yes |
| Webhook URL | Text | No |
| Webhook Secret | Text | No (required if webhook URL provided) |
| Rate Limit | Select | No |

**Step 4 - Document Types:**

| Field | Type | Required |
|-------|------|----------|
| Document Types | Multi-checkbox | Yes (at least one) |

Available: 204, 210, 214, 810, 832, 846, 850, 855, 856, 940, 943, 944, 945, 947, 997

**Step 5 - Review:**
- Summary of all configured fields
- Edit links back to each step
- Create Partner button

#### 3.3.4 Message Routing Configuration

Unchanged from v3.0. Message routing configured at subsidiary level for EDI partners.

#### 3.3.5 Partner Detail Modal

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PARTNER-030 | System shall provide tabbed interface: Overview, AS2 Profiles (EDI) / API Config (API), Documents, Specifications, Message Routing | Must Have |
| FR-PARTNER-031 | System shall display full 5-step lifecycle pipeline in expanded partner view | Must Have |
| FR-PARTNER-032 | System shall display integration type and communication channel prominently | Must Have |

---

### 3.4 Certificate Management

Unchanged from v3.0. Certificates support Production/Sandbox environments, upload/download, UNIS certificate distribution.

---

### 3.5 Message Specifications Management

Unchanged from v3.0. UNIS standard specifications + TP-specific specification upload/download.

---

### 3.6 API Documentation Module (NEW)

#### 3.6.1 Overview

**User Story:** As an API integration developer, I want comprehensive, per-message JSON Schema documentation with X12 field mappings so that I can implement the integration correctly before running connection tests.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-APIDOC-001 | System shall provide a dedicated API Documentation page | Must Have |
| FR-APIDOC-002 | System shall display JSON Schema per message type with field-level detail | Must Have |
| FR-APIDOC-003 | System shall map each JSON field to its corresponding X12 segment/element | Must Have |
| FR-APIDOC-004 | System shall provide sample request payloads per message type | Must Have |
| FR-APIDOC-005 | System shall provide sample response payloads per message type | Must Have |
| FR-APIDOC-006 | System shall support filtering by message category | Must Have |
| FR-APIDOC-007 | System shall support search by message code or name | Must Have |
| FR-APIDOC-008 | System shall display EDI equivalent code per message | Must Have |
| FR-APIDOC-009 | System shall support copy-to-clipboard for sample payloads | Should Have |

#### 3.6.2 Message Categories

| Category | Message Types |
|----------|--------------|
| Order Management | 850 PurchaseOrder, 855 PurchaseOrderAck |
| Shipping | 856 AdvanceShipNotice |
| Financial | 810 Invoice |
| Transportation | 204 LoadTender, 990 LoadTenderResponse, 214 ShipmentStatus, 210 FreightInvoice |
| Warehouse / Inventory | 940 WarehouseShippingOrder, 945 WarehouseShippingAdvice, 943 WarehouseStockTransferShipment, 944 WarehouseStockTransferReceipt, 846 InventoryInquiryAdvice, 947 WarehouseInventoryAdjustment |

#### 3.6.3 JSON Field Schema Model

| Field | Type | Description |
|-------|------|-------------|
| name | String | JSON field name (e.g., "poNumber") |
| type | Enum | string / integer / number / boolean / object / array |
| required | Boolean | Whether the field is required |
| description | String | Human-readable description |
| x12Mapping | String | Corresponding X12 segment/element (e.g., "BEG03", "N401") |
| example | String | Example value |
| enum | Array | Allowed values (if constrained) |
| format | String | Format hint (e.g., "date", "date-time") |
| pattern | String | Regex pattern constraint |
| maxLength | Number | Maximum string length |
| children | Array | Nested fields (for object/array types) |

#### 3.6.4 API Endpoint Specification

Each message type includes:

| Field | Description |
|-------|-------------|
| method | HTTP method (POST) |
| path | Endpoint path (e.g., `/api/v2/messages/purchase-order`) |
| description | Endpoint description |
| headers | Required headers (Content-Type, Authorization, X-UNIS-Partner-ID, X-Message-Type) |

#### 3.6.5 Detail View Layout

- Top: Message name, EDI equivalent badge, version, direction, category
- Statistics: Total fields count, required fields count, X12 mapped fields count
- Endpoint section: Method + Path, Headers table
- Schema table: Recursive field table with columns (Name, Type, Required, Description, X12 Mapping, Example)
- X12 Mapping column: Orange code badges (e.g., `BEG03`) for mapped fields
- Sample Payload: Formatted JSON with copy button
- Response Example: Expected response JSON

---

### 3.7 Connection Testing Module (Redesigned)

#### 3.7.1 Overview

**User Story:** As an integration engineer, I want to run connection tests specific to my integration type (AS2 or API) and validate document exchanges before going live.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CONNTEST-001 | System shall display partner list with 5-step lifecycle pipeline | Must Have |
| FR-CONNTEST-002 | System shall automatically show AS2 or API testing based on partner's integration type | Must Have |
| FR-CONNTEST-003 | System shall provide Payload Validator accessible regardless of partner lifecycle stage | Must Have |
| FR-CONNTEST-004 | System shall lock Document Testing and Connection Test for partners not yet at that lifecycle stage | Must Have |

#### 3.7.2 EDI Connection Testing (AS2 Partners)

**AS2 7-Step Diagnostic:**

| Step | Name | Description |
|------|------|-------------|
| 1 | DNS Resolution | Resolve AS2 endpoint hostname |
| 2 | TCP Connection | Establish TCP connection on port 443 |
| 3 | TLS Handshake | Verify TLS certificate chain |
| 4 | Certificate Validation | Validate partner encryption & signing certificates |
| 5 | AS2 Handshake | Send AS2 ping message |
| 6 | MDN Response | Await Message Disposition Notification |
| 7 | EDI Compliance | Verify ISA/GS envelope compliance |

Each step shows: step number, name, pass/fail indicator, detail text, duration.

#### 3.7.3 API Connection Testing (API Partners)

**API Test Console:**

| Component | Description |
|-----------|-------------|
| Request Builder | Method selector, endpoint URL, headers editor, JSON body editor |
| Send Test button | Execute API request |
| Response Viewer | Status code, headers, response body with syntax highlighting |
| History | Recent test results with timestamps |

#### 3.7.4 Document Testing (Both Paths)

**Document Test Matrix:**

| Column | Description |
|--------|-------------|
| Document Type | EDI code (e.g., 850) |
| Direction | Inbound / Outbound |
| Test Count | Number of test attempts |
| Latest Result | Pass / Fail / Pending |
| Error Count | Number of validation errors |

**Validation Error Detail:**

| Field | Description |
|-------|-------------|
| Segment | X12 segment or JSON field reference |
| Element | Element position or nested path |
| Expected | Expected value or format |
| Actual | Actual value received |
| Severity | Error / Warning |

#### 3.7.5 Payload Validator (Phase 1 - Fully Functional)

**Input Fields:**

| Field | Type | Required | Options |
|-------|------|----------|---------|
| Format | Select | Yes | X12 EDI / JSON / XML |
| Direction | Select | Yes | Inbound / Outbound |
| Partner | Select | No | Trading partners list or "UNIS Standard" |
| Payload | Textarea | Yes | Paste or type content |

**Actions:** Validate Payload, Load Sample, Clear

**Validation Result:**

| Field | Type | Description |
|-------|------|-------------|
| valid | Boolean | Overall validation result |
| errors | Array | Critical errors with segment/field reference |
| warnings | Array | Non-critical warnings |

#### 3.7.6 Implementation Phases

| Phase | Scope | Data Source |
|-------|-------|------------|
| Phase 1 (Current) | Payload Validator - client-side format validation | Frontend (no backend needed) |
| Phase 2 | Document Testing - submit reports, view structured errors | Backend API or UNIS manual entry |
| Phase 3 | AS2/API Connection Test - real diagnostic execution | Backend AS2 server / API gateway |

---

### 3.8 Transaction Management

#### 3.8.1 Dual Channel Support

**User Story:** As an operations user, I want to view both EDI and API transactions in a unified interface with the ability to filter by integration type.

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TRANS-001 | System shall display both EDI and API transactions in unified list | Must Have |
| FR-TRANS-002 | System shall provide integration type toggle (All / EDI / API) | Must Have |
| FR-TRANS-003 | System shall display integration type badge per transaction (EDI blue / API green) | Must Have |
| FR-TRANS-004 | System shall display channel type per transaction (AS2, SFTP, VAN, REST API) | Should Have |
| FR-TRANS-005 | System shall support API-specific document types (PO, ASN, INV as JSON equivalents) | Must Have |
| FR-TRANS-006 | System shall display raw content as X12 for EDI or JSON for API transactions | Must Have |

**Transaction Data Model (Extended):**

| Field | Type | Description |
|-------|------|-------------|
| integrationType | Enum | edi / api |
| channel | String | AS2 / SFTP / VAN / REST API |

All other transaction fields remain from v3.0.

**Summary Bar:**
- Total transaction count (filtered/total)
- EDI transaction count
- API transaction count

#### 3.8.2 Search and Filter

All v3.0 filters remain. New additions:

| Filter | Type | Options |
|--------|------|---------|
| Integration Type | Toggle Button | All / EDI (AS2/SFTP) / API (REST) |

**Document Type Quick Filter (Extended):**
All 15 X12 types + API types: PO, ASN, INV

#### 3.8.3 Enhanced Transaction Status

Unchanged from v3.0. Multi-dimensional status tracking (Validation/Delivery/Acknowledgment).

---

### 3.9 Notification System

Unchanged from v3.0. Warning/Error/Info notifications with environment filtering.

---

### 3.10 Partner Integration Lifecycle (Cross-Module Feature)

#### 3.10.1 Overview

The 5-step integration lifecycle is a **cross-cutting concern** that appears across multiple modules:

| Module | Display |
|--------|---------|
| Trading Partners | Compact pipeline per row + Full pipeline in expanded view |
| Connection Testing | Full pipeline per partner + Phase-locked features |
| Dashboard Overview | Compact pipeline in Partner Lifecycle table |

#### 3.10.2 Lifecycle Data Model

| Field | Type | Description |
|-------|------|-------------|
| currentStepId | Number | Current step (1-7 active, 8 = fully live) |
| onboardingStartDate | String | Lifecycle start date |
| stepCompletionDates | Record<number, string> | Completion date per step |

#### 3.10.3 Data Source Strategy

| Phase | Approach | Description |
|-------|----------|-------------|
| Phase 1 (Current) | Frontend Mock | Static data in components |
| Phase 2 (Short-term) | Manual Backend | UNIS team updates via admin panel |
| Phase 3 (Mid-term) | API + Manual Hybrid | Some steps auto-advance, some manual |
| Phase 4 (Long-term) | webMethods Auto-sync | Fully automated from webMethods |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-001 | Page load time | <2 seconds |
| NFR-PERF-002 | Transaction list load | <1 second for 1000 records |
| NFR-PERF-003 | Certificate search response | <500ms |
| NFR-PERF-004 | Export generation | <5 seconds for 10,000 records |
| NFR-PERF-005 | Partner hierarchy expansion | <200ms |
| NFR-PERF-006 | API Documentation page load | <1 second |

### 4.2 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-001 | All data transmission shall use TLS 1.3 |
| NFR-SEC-002 | Passwords shall be hashed using bcrypt (cost factor 12) |
| NFR-SEC-003 | Session tokens shall be cryptographically secure |
| NFR-SEC-004 | System shall implement CSRF protection |
| NFR-SEC-005 | System shall sanitize all user inputs |
| NFR-SEC-006 | Certificate private keys shall never be exposed |
| NFR-SEC-007 | API tokens shall be masked in UI display |

### 4.3 Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SCALE-001 | Registered users | 10,000 |
| NFR-SCALE-002 | Trading partners per user | 500 |
| NFR-SCALE-003 | Transactions per month | 1M |
| NFR-SCALE-004 | Certificates per user | 1,000 |
| NFR-SCALE-005 | Concurrent users | 100 |

### 4.4 Availability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-AVAIL-001 | System uptime | 99.5% |
| NFR-AVAIL-002 | Planned maintenance window | <2 hours monthly |
| NFR-AVAIL-003 | RTO (Recovery Time Objective) | 4 hours |
| NFR-AVAIL-004 | RPO (Recovery Point Objective) | 1 hour |

### 4.5 Usability

| ID | Requirement |
|----|-------------|
| NFR-USE-001 | Interface shall be responsive (desktop, tablet) |
| NFR-USE-002 | Color contrast shall meet WCAG 2.1 AA standards |
| NFR-USE-003 | Form validation errors shall be inline and actionable |
| NFR-USE-004 | Integration type (EDI/API) shall be visually distinct |
| NFR-USE-005 | All actions shall provide visual feedback |
| NFR-USE-006 | Lifecycle pipeline shall be immediately understandable |

---

## 5. Technical Architecture

### 5.1 Technology Stack

**Frontend:**
- Framework: Next.js 16 (React 19.2)
- Language: TypeScript 5.x
- Styling: Tailwind CSS v4
- UI Components: shadcn/ui
- State Management: React Hooks, SWR
- Build Tool: Turbopack

**Backend:**
- Runtime: Next.js API Routes
- Language: TypeScript 5.x
- Authentication: Custom session-based

**Data Storage:**
- Database: PostgreSQL (recommended)
- File Storage: Vercel Blob / AWS S3
- Session Storage: Redis (recommended)

### 5.2 Module Dependencies

```
Authentication
     |
     +---> Trading Partners (+ Integration Lifecycle)
     |          |
     |          +---> Certificate Management
     |          +---> Message Specifications
     |          +---> API Documentation
     |          +---> Connection Testing
     |
     +---> Transactions (EDI + API)
     |
     +---> Notifications
```

---

## 6. Glossary

| Term | Definition |
|------|------------|
| AS2 | Applicability Statement 2 - secure file transfer protocol |
| EDI | Electronic Data Interchange |
| EDIFACT | Electronic Data Interchange for Administration, Commerce and Transport |
| ISA | Interchange Control Header segment in X12 |
| MDN | Message Disposition Notification |
| REST API | Representational State Transfer Application Programming Interface |
| TPA | Trading Partner Administrator |
| TP | Trading Partner |
| X12 | ANSI ASC X12 - US EDI standard |
| JSON Schema | Vocabulary for annotating and validating JSON documents |
| SCAC | Standard Carrier Alpha Code |

---

## 7. Appendices

### Appendix A: Supported Document Types

| Code | Name | Category | Typical Direction | API JSON Equivalent |
|------|------|----------|-------------------|---------------------|
| 204 | Motor Carrier Load Tender | Transportation | Outbound | LoadTender |
| 210 | Freight Invoice | Transportation | Inbound | FreightInvoice |
| 214 | Shipment Status | Transportation | Both | ShipmentStatus |
| 810 | Invoice | Financial | Outbound | Invoice |
| 832 | Price/Sales Catalog | Inventory | Both | PriceCatalog |
| 846 | Inventory Inquiry/Advice | Inventory | Both | InventoryInquiryAdvice |
| 850 | Purchase Order | Order Management | Inbound | PurchaseOrder |
| 855 | Purchase Order Acknowledgment | Order Management | Outbound | PurchaseOrderAck |
| 856 | Advance Ship Notice | Shipping | Outbound | AdvanceShipNotice |
| 940 | Warehouse Shipping Order | Warehouse | Outbound | WarehouseShippingOrder |
| 943 | Warehouse Stock Transfer Shipment | Warehouse | Outbound | WarehouseStockTransferShipment |
| 944 | Warehouse Stock Transfer Receipt | Warehouse | Inbound | WarehouseStockTransferReceipt |
| 945 | Warehouse Shipping Advice | Warehouse | Inbound | WarehouseShippingAdvice |
| 947 | Warehouse Inventory Adjustment | Warehouse | Inbound | WarehouseInventoryAdjustment |
| 990 | Response to Load Tender | Transportation | Inbound | LoadTenderResponse |
| 997 | Functional Acknowledgment | Acknowledgment | Both | FunctionalAck |

### Appendix B: Navigation Structure (v4.0)

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
| 5. API Documentation (NEW)                        |
| 6. Connection Testing (Redesigned)                |
| 7. Transactions   |                               |
| 8. Notifications  |                               |
+-------------------+-------------------------------+
```

### Appendix C: Removed/Replaced Features (v3.0 -> v4.0)

| v3.0 Feature | v4.0 Status | Reason |
|--------------|-------------|--------|
| Communication Channels (standalone module) | Removed | Absorbed into Trading Partner setup wizard (Step 3: Channel Config) |
| 7-step Integration Lifecycle | Simplified to 5 steps | Clearer, maps to actual UNIS workflow |
| Demo Partners (Integration Testing) | Removed | Replaced by real partner-scoped Connection Testing |
| Scenario Checklists | Removed | Replaced by Document Testing matrix in Connection Testing |
| Environment Toggle (per module) | Removed from header | Simplified to company-level display |
| Overview (tab name) | Renamed to "Dashboard" | Clarity |

### Appendix D: Error Codes

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

---

*End of Document - Version 4.0*
