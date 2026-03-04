"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ---- Types ----
interface JsonField {
  name: string
  type: "string" | "number" | "integer" | "boolean" | "object" | "array" | "datetime"
  required: boolean
  description: string
  x12Mapping?: string // e.g. "BEG03", "N1*ST > N104"
  example?: string
  enum?: string[]
  children?: JsonField[]
  format?: string
  minLength?: number
  maxLength?: number
  pattern?: string
}

interface ApiEndpoint {
  method: "POST" | "GET" | "PUT" | "DELETE"
  path: string
  description: string
}

interface ApiMessageSpec {
  id: string
  code: string
  name: string
  ediEquivalent: string
  category: string
  direction: "inbound" | "outbound"
  version: string
  description: string
  endpoint: ApiEndpoint
  headers: { name: string; value: string; description: string }[]
  requestSchema: JsonField[]
  responseExample: string
  samplePayload: string
}

// ---- Shared header schema builder ----
function headerSchema(msgType: string, example: { id: string; sender: string; receiver: string; ts: string }): JsonField {
  return {
    name: "header", type: "object", required: true,
    description: "Message envelope / routing metadata",
    x12Mapping: "ISA / GS / ST Segments",
    children: [
      { name: "messageId", type: "string", required: true, description: "Unique message identifier (UUID v4)", example: example.id, format: "uuid", x12Mapping: "ST02 (Transaction Set Control Number)" },
      { name: "messageType", type: "string", required: true, description: "Message type identifier", example: msgType, enum: [msgType], x12Mapping: "ST01 (Transaction Set ID Code)" },
      { name: "version", type: "string", required: true, description: "API schema version", example: "2.1", x12Mapping: "GS08 (Version)" },
      { name: "sender", type: "string", required: true, description: "Sender system identifier", example: example.sender, maxLength: 64, x12Mapping: "ISA06 (Interchange Sender ID)" },
      { name: "receiver", type: "string", required: true, description: "Receiver system identifier", example: example.receiver, maxLength: 64, x12Mapping: "ISA08 (Interchange Receiver ID)" },
      { name: "timestamp", type: "datetime", required: true, description: "ISO 8601 timestamp of message creation", example: example.ts, x12Mapping: "ISA09/ISA10 (Date/Time)" },
    ],
  }
}

const sharedHeaders = [
  { name: "Content-Type", value: "application/json", description: "Must be application/json" },
  { name: "Authorization", value: "Bearer {access_token}", description: "OAuth2 bearer token" },
  { name: "X-Partner-ID", value: "{partner_id}", description: "UNIS assigned partner identifier" },
  { name: "X-Message-ID", value: "{uuid}", description: "Unique message ID for idempotency" },
]

// ---- Mock Data ----
const apiSpecs: ApiMessageSpec[] = [
  // ======================== ORDER MANAGEMENT ========================
  {
    id: "api-po", code: "PurchaseOrder", name: "Purchase Order",
    ediEquivalent: "850", category: "order", direction: "inbound", version: "v2.1",
    description: "Receive purchase orders from trading partners via REST API. This message replaces the EDI 850 transaction for API-integrated partners.",
    endpoint: { method: "POST", path: "/api/v2/messages/purchase-order", description: "Submit a new purchase order" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("PurchaseOrder", { id: "550e8400-e29b-41d4-a716-446655440000", sender: "AMAZON-VC", receiver: "UNIS-API", ts: "2024-01-21T14:30:00Z" }),
      {
        name: "purchaseOrder", type: "object", required: true,
        description: "Purchase order details",
        x12Mapping: "BEG Segment (Beginning Segment for PO)",
        children: [
          { name: "poNumber", type: "string", required: true, description: "Purchase order number assigned by buyer", example: "PO-AMZ-2024-5678", maxLength: 35, x12Mapping: "BEG03 (Purchase Order Number)" },
          { name: "orderDate", type: "string", required: true, description: "Date the order was placed (YYYY-MM-DD)", example: "2024-01-21", format: "date", x12Mapping: "BEG05 (Date)" },
          { name: "expectedDeliveryDate", type: "string", required: false, description: "Requested delivery date", example: "2024-02-15", format: "date", x12Mapping: "DTM*002 (Delivery Requested)" },
          { name: "currency", type: "string", required: true, description: "ISO 4217 currency code", example: "USD", enum: ["USD", "EUR", "GBP", "CNY", "JPY"], x12Mapping: "CUR02 (Currency Code)" },
          {
            name: "buyerInfo", type: "object", required: true, description: "Buyer organization details", x12Mapping: "N1*BY Loop",
            children: [
              { name: "name", type: "string", required: true, description: "Buyer company name", example: "Amazon Vendor Central", x12Mapping: "N1*BY > N102 (Name)" },
              { name: "accountNumber", type: "string", required: false, description: "Buyer account number", example: "AMZ-VND-001", x12Mapping: "N1*BY > N104 (ID Code)" },
            ],
          },
          {
            name: "shipTo", type: "object", required: true, description: "Shipping destination address", x12Mapping: "N1*ST Loop + N3 + N4",
            children: [
              { name: "name", type: "string", required: true, description: "Recipient name or facility", example: "Amazon FC - PHX6", x12Mapping: "N1*ST > N102 (Name)" },
              { name: "address", type: "string", required: true, description: "Street address line 1", example: "4750 W Mohave St", x12Mapping: "N301 (Address Line 1)" },
              { name: "address2", type: "string", required: false, description: "Street address line 2", example: "Building B", x12Mapping: "N302 (Address Line 2)" },
              { name: "city", type: "string", required: true, description: "City name", example: "Phoenix", x12Mapping: "N401 (City)" },
              { name: "state", type: "string", required: true, description: "State/province code", example: "AZ", maxLength: 2, x12Mapping: "N402 (State)" },
              { name: "zip", type: "string", required: true, description: "ZIP/postal code", example: "85043", pattern: "^\\d{5}(-\\d{4})?$", x12Mapping: "N403 (Postal Code)" },
              { name: "country", type: "string", required: false, description: "ISO 3166-1 alpha-2 country code", example: "US", x12Mapping: "N404 (Country Code)" },
            ],
          },
          {
            name: "lineItems", type: "array", required: true, description: "Order line items (minimum 1)", x12Mapping: "PO1 Loop",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Sequential line number", example: "1", x12Mapping: "PO101 (Assigned ID)" },
              { name: "sku", type: "string", required: true, description: "Seller SKU / product identifier", example: "SKU-001", maxLength: 48, x12Mapping: "PO107 (Product ID)" },
              { name: "upc", type: "string", required: false, description: "Universal Product Code (UPC-A)", example: "012345678905", pattern: "^\\d{12}$", x12Mapping: "PO109 (UPC)" },
              { name: "description", type: "string", required: false, description: "Product description", example: "Midea Air Purifier Model X1", x12Mapping: "PID*F > PID05 (Description)" },
              { name: "quantity", type: "integer", required: true, description: "Ordered quantity", example: "500", x12Mapping: "PO102 (Quantity Ordered)" },
              { name: "unitOfMeasure", type: "string", required: true, description: "Unit of measure code", example: "EA", enum: ["EA", "CS", "PK", "BX", "PL"], x12Mapping: "PO103 (Unit of Measure)" },
              { name: "unitPrice", type: "number", required: true, description: "Price per unit", example: "12.99", x12Mapping: "PO104 (Unit Price)" },
            ],
          },
          { name: "totalAmount", type: "number", required: true, description: "Total order amount", example: "11395.00", x12Mapping: "CTT/AMT (Transaction Totals)" },
          { name: "notes", type: "string", required: false, description: "Free-text order notes", example: "Please ship before Feb 10", maxLength: 500, x12Mapping: "MSG01 (Free-Form Message)" },
        ],
      },
    ],
    samplePayload: `{
  "header": {
    "messageId": "550e8400-e29b-41d4-a716-446655440000",
    "messageType": "PurchaseOrder",
    "version": "2.1",
    "sender": "AMAZON-VC",
    "receiver": "UNIS-API",
    "timestamp": "2024-01-21T14:30:00Z"
  },
  "purchaseOrder": {
    "poNumber": "PO-AMZ-2024-5678",
    "orderDate": "2024-01-21",
    "expectedDeliveryDate": "2024-02-15",
    "currency": "USD",
    "buyerInfo": { "name": "Amazon Vendor Central", "accountNumber": "AMZ-VND-001" },
    "shipTo": {
      "name": "Amazon FC - PHX6", "address": "4750 W Mohave St",
      "city": "Phoenix", "state": "AZ", "zip": "85043", "country": "US"
    },
    "lineItems": [
      { "lineNumber": 1, "sku": "SKU-001", "upc": "012345678905", "description": "Midea Air Purifier Model X1", "quantity": 500, "unitOfMeasure": "EA", "unitPrice": 12.99 }
    ],
    "totalAmount": 6495.00,
    "notes": "Please ship before Feb 10"
  }
}`,
    responseExample: `{
  "status": "accepted",
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "acknowledgment": {
    "ackId": "ACK-20240121-001",
    "receivedAt": "2024-01-21T14:30:01Z",
    "validationStatus": "passed",
    "errors": []
  }
}`,
  },
  {
    id: "api-poa", code: "PurchaseOrderAck", name: "Purchase Order Acknowledgment",
    ediEquivalent: "855", category: "order", direction: "outbound", version: "v2.1",
    description: "Send purchase order acknowledgments to confirm receipt and acceptance. Replaces the EDI 855 for API-integrated partners.",
    endpoint: { method: "POST", path: "/api/v2/messages/po-acknowledgment", description: "Submit a PO acknowledgment" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("PurchaseOrderAck", { id: "660e8400-e29b-41d4-a716-446655440001", sender: "UNIS-API", receiver: "AMAZON-VC", ts: "2024-01-21T15:00:00Z" }),
      {
        name: "acknowledgment", type: "object", required: true, description: "Order acknowledgment details", x12Mapping: "BAK Segment (Beginning Segment for PO Ack)",
        children: [
          { name: "originalPoNumber", type: "string", required: true, description: "The PO number being acknowledged", example: "PO-AMZ-2024-5678", x12Mapping: "BAK03 (PO Number)" },
          { name: "ackStatus", type: "string", required: true, description: "Acknowledgment status", example: "accepted", enum: ["accepted", "accepted_with_changes", "rejected", "pending"], x12Mapping: "BAK01 (Transaction Set Purpose Code)" },
          { name: "ackDate", type: "string", required: true, description: "Acknowledgment date", example: "2024-01-21", format: "date", x12Mapping: "BAK04 (Date)" },
          { name: "estimatedShipDate", type: "string", required: false, description: "Estimated ship date", example: "2024-02-10", format: "date", x12Mapping: "DTM*011 (Estimated Ship Date)" },
          {
            name: "lineItems", type: "array", required: true, description: "Line item level acknowledgment", x12Mapping: "ACK Loop",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Original line number", example: "1", x12Mapping: "ACK01 (Line Item Status)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-001", x12Mapping: "ACK > PO1 reference" },
              { name: "acknowledgedQty", type: "integer", required: true, description: "Quantity acknowledged", example: "500", x12Mapping: "ACK02 (Quantity)" },
              { name: "status", type: "string", required: true, description: "Line item status", example: "accepted", enum: ["accepted", "backordered", "rejected", "substituted"], x12Mapping: "ACK01 (Line Item Status Code)" },
              { name: "reason", type: "string", required: false, description: "Reason for non-acceptance", example: "Insufficient stock", x12Mapping: "ACK > MSG01" },
            ],
          },
          { name: "notes", type: "string", required: false, description: "Acknowledgment notes", example: "All items in stock", maxLength: 500, x12Mapping: "MSG01 (Free-Form Message)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "660e8400-...", "messageType": "PurchaseOrderAck", "version": "2.1", "sender": "UNIS-API", "receiver": "AMAZON-VC", "timestamp": "2024-01-21T15:00:00Z" },
  "acknowledgment": {
    "originalPoNumber": "PO-AMZ-2024-5678", "ackStatus": "accepted", "ackDate": "2024-01-21", "estimatedShipDate": "2024-02-10",
    "lineItems": [{ "lineNumber": 1, "sku": "SKU-001", "acknowledgedQty": 500, "status": "accepted" }],
    "notes": "All items in stock, will ship by Feb 10"
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "660e8400-...", "receivedAt": "2024-01-21T15:00:01Z" }`,
  },
  // ======================== SHIPPING ========================
  {
    id: "api-asn", code: "AdvanceShipNotice", name: "Advance Ship Notice",
    ediEquivalent: "856", category: "shipping", direction: "outbound", version: "v2.1",
    description: "Send advance ship notices to notify trading partners of pending shipments. Replaces the EDI 856 for API-integrated partners.",
    endpoint: { method: "POST", path: "/api/v2/messages/advance-ship-notice", description: "Submit an advance ship notice" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("AdvanceShipNotice", { id: "770e8400-e29b-41d4-a716-446655440002", sender: "UNIS-API", receiver: "COSTCO-API", ts: "2024-01-20T09:45:15Z" }),
      {
        name: "shipNotice", type: "object", required: true, description: "Shipment details", x12Mapping: "BSN Segment (Beginning Segment for Ship Notice)",
        children: [
          { name: "shipmentId", type: "string", required: true, description: "Unique shipment identifier", example: "SHP-2024-0120", x12Mapping: "BSN02 (Shipment ID)" },
          { name: "poNumber", type: "string", required: true, description: "Related purchase order number", example: "PO-COST-2024-100", x12Mapping: "PRF01 (PO Number)" },
          { name: "shipDate", type: "string", required: true, description: "Actual ship date", example: "2024-01-20", format: "date", x12Mapping: "BSN03 (Date)" },
          { name: "expectedDeliveryDate", type: "string", required: false, description: "Expected delivery date", example: "2024-01-25", format: "date", x12Mapping: "DTM*017 (Estimated Delivery)" },
          {
            name: "carrier", type: "object", required: true, description: "Carrier and tracking information", x12Mapping: "TD5 Segment (Carrier Details)",
            children: [
              { name: "name", type: "string", required: true, description: "Carrier name", example: "UPS", x12Mapping: "TD505 (Routing)" },
              { name: "scac", type: "string", required: false, description: "Standard Carrier Alpha Code", example: "UPSN", maxLength: 4, x12Mapping: "TD503 (SCAC)" },
              { name: "trackingNumber", type: "string", required: true, description: "Primary tracking number", example: "1Z999AA10123456784", x12Mapping: "REF*CN > REF02 (Tracking #)" },
              { name: "serviceLevel", type: "string", required: false, description: "Service level", example: "Ground", enum: ["Ground", "Express", "Overnight", "Freight"], x12Mapping: "TD504 (Service Level)" },
            ],
          },
          {
            name: "destination", type: "object", required: true, description: "Ship-to destination", x12Mapping: "N1*ST Loop + N3 + N4",
            children: [
              { name: "warehouseCode", type: "string", required: true, description: "Destination warehouse code", example: "COST-DC-LAX", x12Mapping: "N1*ST > N104 (ID Code)" },
              { name: "name", type: "string", required: true, description: "Destination name", example: "Costco DC - Los Angeles", x12Mapping: "N1*ST > N102 (Name)" },
              { name: "address", type: "string", required: true, description: "Street address", example: "1200 S Figueroa St", x12Mapping: "N301" },
              { name: "city", type: "string", required: true, description: "City", example: "Los Angeles", x12Mapping: "N401" },
              { name: "state", type: "string", required: true, description: "State", example: "CA", x12Mapping: "N402" },
              { name: "zip", type: "string", required: true, description: "ZIP code", example: "90015", x12Mapping: "N403" },
            ],
          },
          {
            name: "items", type: "array", required: true, description: "Shipped items", x12Mapping: "HL*I (Item Level Loop)",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "PO line reference", example: "1", x12Mapping: "LIN01 (Assigned ID)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "COST-SKU-100", x12Mapping: "LIN > IN (Product ID)" },
              { name: "quantity", type: "integer", required: true, description: "Quantity shipped", example: "1000", x12Mapping: "SN102 (Shipped Qty)" },
              { name: "lotNumber", type: "string", required: false, description: "Lot / batch number", example: "LOT-2024-A", x12Mapping: "LIN > REF*LT" },
            ],
          },
          { name: "totalWeight", type: "number", required: false, description: "Total shipment weight in LB", example: "2505.0", x12Mapping: "TD101 (Pack)" },
          { name: "palletCount", type: "integer", required: false, description: "Number of pallets", example: "5", x12Mapping: "TD103 (Lading Quantity)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "770e8400-...", "messageType": "AdvanceShipNotice", "version": "2.1", "sender": "UNIS-API", "receiver": "COSTCO-API", "timestamp": "2024-01-20T09:45:15Z" },
  "shipNotice": {
    "shipmentId": "SHP-2024-0120", "poNumber": "PO-COST-2024-100", "shipDate": "2024-01-20",
    "carrier": { "name": "UPS", "scac": "UPSN", "trackingNumber": "1Z999AA10123456784", "serviceLevel": "Ground" },
    "destination": { "warehouseCode": "COST-DC-LAX", "name": "Costco DC - LA", "address": "1200 S Figueroa St", "city": "Los Angeles", "state": "CA", "zip": "90015" },
    "items": [{ "lineNumber": 1, "sku": "COST-SKU-100", "quantity": 1000, "lotNumber": "LOT-2024-A" }],
    "totalWeight": 2505.0, "palletCount": 5
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "770e8400-...", "receivedAt": "2024-01-20T09:45:16Z", "validationStatus": "passed" }`,
  },
  // ======================== FINANCIAL ========================
  {
    id: "api-inv", code: "Invoice", name: "Invoice",
    ediEquivalent: "810", category: "financial", direction: "outbound", version: "v2.1",
    description: "Send invoices to trading partners for goods delivered. Replaces the EDI 810 for API-integrated partners.",
    endpoint: { method: "POST", path: "/api/v2/messages/invoice", description: "Submit an invoice" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("Invoice", { id: "880e8400-e29b-41d4-a716-446655440003", sender: "UNIS-API", receiver: "AMAZON-VC", ts: "2024-02-01T10:00:00Z" }),
      {
        name: "invoice", type: "object", required: true, description: "Invoice details", x12Mapping: "BIG Segment (Beginning Segment for Invoice)",
        children: [
          { name: "invoiceNumber", type: "string", required: true, description: "Unique invoice number", example: "INV-2024-001234", x12Mapping: "BIG02 (Invoice Number)" },
          { name: "invoiceDate", type: "string", required: true, description: "Invoice date", example: "2024-02-01", format: "date", x12Mapping: "BIG01 (Invoice Date)" },
          { name: "dueDate", type: "string", required: true, description: "Payment due date", example: "2024-03-02", format: "date", x12Mapping: "ITD > ITD06 (Due Date)" },
          { name: "poNumber", type: "string", required: true, description: "Related purchase order number", example: "PO-AMZ-2024-5678", x12Mapping: "BIG04 (PO Number)" },
          { name: "currency", type: "string", required: true, description: "Currency code", example: "USD", x12Mapping: "CUR02" },
          { name: "paymentTerms", type: "string", required: false, description: "Payment terms code", example: "NET30", enum: ["NET15", "NET30", "NET45", "NET60", "DUE_ON_RECEIPT"], x12Mapping: "ITD01 (Terms Type Code)" },
          {
            name: "lineItems", type: "array", required: true, description: "Invoice line items", x12Mapping: "IT1 Loop",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "IT101 (Assigned ID)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-001", x12Mapping: "IT107 (Product ID)" },
              { name: "description", type: "string", required: false, description: "Product description", example: "Midea Air Purifier Model X1", x12Mapping: "PID05" },
              { name: "quantity", type: "integer", required: true, description: "Invoiced quantity", example: "500", x12Mapping: "IT102 (Quantity Invoiced)" },
              { name: "unitPrice", type: "number", required: true, description: "Unit price", example: "12.99", x12Mapping: "IT104 (Unit Price)" },
              { name: "lineTotal", type: "number", required: true, description: "Line total (qty x unitPrice)", example: "6495.00", x12Mapping: "Computed (IT102 x IT104)" },
            ],
          },
          { name: "subtotal", type: "number", required: true, description: "Subtotal before tax", example: "6495.00", x12Mapping: "TDS01 (Total Invoice Amount)" },
          { name: "taxAmount", type: "number", required: false, description: "Tax amount", example: "519.60", x12Mapping: "TXI > TXI02 (Tax Amount)" },
          { name: "totalAmount", type: "number", required: true, description: "Total invoice amount", example: "7014.60", x12Mapping: "TDS01 (Total)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "880e8400-...", "messageType": "Invoice", "version": "2.1", "sender": "UNIS-API", "receiver": "AMAZON-VC", "timestamp": "2024-02-01T10:00:00Z" },
  "invoice": {
    "invoiceNumber": "INV-2024-001234", "invoiceDate": "2024-02-01", "dueDate": "2024-03-02", "poNumber": "PO-AMZ-2024-5678", "currency": "USD", "paymentTerms": "NET30",
    "lineItems": [{ "lineNumber": 1, "sku": "SKU-001", "description": "Midea Air Purifier Model X1", "quantity": 500, "unitPrice": 12.99, "lineTotal": 6495.00 }],
    "subtotal": 6495.00, "taxAmount": 519.60, "totalAmount": 7014.60
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "880e8400-...", "receivedAt": "2024-02-01T10:00:01Z" }`,
  },
  // ======================== TRANSPORTATION ========================
  {
    id: "api-204", code: "LoadTender", name: "Motor Carrier Load Tender",
    ediEquivalent: "204", category: "transportation", direction: "outbound", version: "v2.1",
    description: "Send a load tender request to a carrier, specifying shipment details, stops, equipment requirements, and scheduling. Replaces the EDI 204 for API-integrated carriers.",
    endpoint: { method: "POST", path: "/api/v2/messages/load-tender", description: "Submit a load tender to carrier" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("LoadTender", { id: "a10e8400-e29b-41d4-a716-446655440010", sender: "UNIS-API", receiver: "CARRIER-API", ts: "2024-03-01T08:00:00Z" }),
      {
        name: "loadTender", type: "object", required: true, description: "Load tender / shipment request details", x12Mapping: "B2/B2A Segments (Set Purpose / Shipment Info)",
        children: [
          { name: "shipmentId", type: "string", required: true, description: "Unique shipment identifier", example: "SHIP-2024-03-0001", x12Mapping: "B203 (Shipment ID Number)" },
          { name: "purpose", type: "string", required: true, description: "Tender purpose", example: "original", enum: ["original", "cancel", "update"], x12Mapping: "B2A01 (Transaction Set Purpose Code)" },
          { name: "scac", type: "string", required: true, description: "Standard Carrier Alpha Code", example: "SNLU", maxLength: 4, x12Mapping: "B201 (SCAC)" },
          { name: "totalWeight", type: "number", required: true, description: "Total shipment weight in LB", example: "42000", x12Mapping: "L1104 (Weight)" },
          { name: "weightUnit", type: "string", required: true, description: "Weight unit", example: "LB", enum: ["LB", "KG"], x12Mapping: "L1105 (Weight Unit Code)" },
          { name: "equipmentType", type: "string", required: true, description: "Equipment type required", example: "TL", enum: ["TL", "LTL", "FLATBED", "REEFER", "TANKER"], x12Mapping: "MS301 (Equipment Code)" },
          { name: "totalMiles", type: "number", required: false, description: "Estimated total miles", example: "1250", x12Mapping: "MS306 (Distance)" },
          { name: "totalRate", type: "number", required: true, description: "Total agreed rate", example: "3500.00", x12Mapping: "L1102 (Freight Rate)" },
          { name: "currency", type: "string", required: true, description: "Currency code", example: "USD", x12Mapping: "CUR02" },
          { name: "specialInstructions", type: "string", required: false, description: "Special handling or delivery instructions", example: "Temperature controlled, 35-45F", maxLength: 500, x12Mapping: "NTE02 (Free-Form Note)" },
          {
            name: "stops", type: "array", required: true, description: "Pickup and delivery stops (minimum 2: origin + destination)", x12Mapping: "S5 Loop (Stop Off Details)",
            children: [
              { name: "stopNumber", type: "integer", required: true, description: "Stop sequence number", example: "1", x12Mapping: "S501 (Stop Sequence Number)" },
              { name: "stopType", type: "string", required: true, description: "Type of stop", example: "pickup", enum: ["pickup", "delivery", "both"], x12Mapping: "S502 (Stop Reason Code)" },
              { name: "facilityName", type: "string", required: true, description: "Facility / location name", example: "Midea Distribution Center", x12Mapping: "N102 (Name)" },
              { name: "address", type: "string", required: true, description: "Street address", example: "500 Industrial Blvd", x12Mapping: "N301" },
              { name: "city", type: "string", required: true, description: "City", example: "Louisville", x12Mapping: "N401" },
              { name: "state", type: "string", required: true, description: "State", example: "KY", x12Mapping: "N402" },
              { name: "zip", type: "string", required: true, description: "ZIP code", example: "40201", x12Mapping: "N403" },
              { name: "appointmentStart", type: "datetime", required: true, description: "Appointment window start", example: "2024-03-02T06:00:00Z", x12Mapping: "G6201 (Earliest Date)" },
              { name: "appointmentEnd", type: "datetime", required: true, description: "Appointment window end", example: "2024-03-02T10:00:00Z", x12Mapping: "G6202 (Latest Date)" },
              { name: "contactName", type: "string", required: false, description: "On-site contact name", example: "John Smith", x12Mapping: "G61 > G6102 (Contact Name)" },
              { name: "contactPhone", type: "string", required: false, description: "On-site contact phone", example: "502-555-0100", x12Mapping: "G61 > G6104 (Phone Number)" },
            ],
          },
          {
            name: "commodities", type: "array", required: true, description: "Commodity details for the load", x12Mapping: "L5/L0 Loop (Commodity Description)",
            children: [
              { name: "description", type: "string", required: true, description: "Commodity description", example: "Air conditioning units", x12Mapping: "L501 (Lading Description)" },
              { name: "pieces", type: "integer", required: true, description: "Number of pieces", example: "200", x12Mapping: "L002 (Lading Quantity)" },
              { name: "weight", type: "number", required: true, description: "Commodity weight", example: "42000", x12Mapping: "L004 (Weight)" },
              { name: "hazmat", type: "boolean", required: false, description: "Hazardous materials flag", example: "false", x12Mapping: "LH1 (Hazardous Identification)" },
            ],
          },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "a10e8400-...", "messageType": "LoadTender", "version": "2.1", "sender": "UNIS-API", "receiver": "CARRIER-API", "timestamp": "2024-03-01T08:00:00Z" },
  "loadTender": {
    "shipmentId": "SHIP-2024-03-0001", "purpose": "original", "scac": "SNLU",
    "totalWeight": 42000, "weightUnit": "LB", "equipmentType": "TL", "totalMiles": 1250, "totalRate": 3500.00, "currency": "USD",
    "specialInstructions": "Temperature controlled, 35-45F",
    "stops": [
      { "stopNumber": 1, "stopType": "pickup", "facilityName": "Midea DC", "address": "500 Industrial Blvd", "city": "Louisville", "state": "KY", "zip": "40201", "appointmentStart": "2024-03-02T06:00:00Z", "appointmentEnd": "2024-03-02T10:00:00Z" },
      { "stopNumber": 2, "stopType": "delivery", "facilityName": "Walmart DC #6082", "address": "7300 SW 44th St", "city": "Oklahoma City", "state": "OK", "zip": "73179", "appointmentStart": "2024-03-03T08:00:00Z", "appointmentEnd": "2024-03-03T16:00:00Z" }
    ],
    "commodities": [{ "description": "Air conditioning units", "pieces": 200, "weight": 42000, "hazmat": false }]
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "a10e8400-...", "tenderId": "TNR-2024-0301-001", "receivedAt": "2024-03-01T08:00:01Z" }`,
  },
  {
    id: "api-990", code: "LoadTenderResponse", name: "Response to Load Tender",
    ediEquivalent: "990", category: "transportation", direction: "inbound", version: "v2.1",
    description: "Receive carrier's acceptance, rejection, or counter-offer in response to a load tender (204). Replaces the EDI 990.",
    endpoint: { method: "POST", path: "/api/v2/messages/load-tender-response", description: "Receive carrier response to load tender" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("LoadTenderResponse", { id: "a20e8400-e29b-41d4-a716-446655440011", sender: "CARRIER-API", receiver: "UNIS-API", ts: "2024-03-01T09:30:00Z" }),
      {
        name: "tenderResponse", type: "object", required: true, description: "Carrier response to load tender", x12Mapping: "B1 Segment (Beginning Segment for Response)",
        children: [
          { name: "originalShipmentId", type: "string", required: true, description: "Shipment ID from original 204 tender", example: "SHIP-2024-03-0001", x12Mapping: "B102 (Shipment ID)" },
          { name: "scac", type: "string", required: true, description: "Carrier SCAC code", example: "SNLU", maxLength: 4, x12Mapping: "B101 (SCAC)" },
          { name: "responseCode", type: "string", required: true, description: "Carrier response", example: "accepted", enum: ["accepted", "rejected", "counter_offer"], x12Mapping: "B104 (Response Code: A=Accept, D=Decline)" },
          { name: "responseDate", type: "string", required: true, description: "Response date", example: "2024-03-01", format: "date", x12Mapping: "B103 (Date)" },
          { name: "rejectionReason", type: "string", required: false, description: "Reason for rejection (if rejected)", example: "No available equipment", x12Mapping: "NTE02 (Note)" },
          {
            name: "counterOffer", type: "object", required: false, description: "Counter-offer details (when responseCode = counter_offer)", x12Mapping: "L1 (Rate and Charges)",
            children: [
              { name: "proposedRate", type: "number", required: true, description: "Carrier's proposed rate", example: "4200.00", x12Mapping: "L102 (Freight Rate)" },
              { name: "currency", type: "string", required: true, description: "Currency", example: "USD", x12Mapping: "CUR02" },
              { name: "proposedPickupDate", type: "datetime", required: false, description: "Carrier's proposed pickup date/time", example: "2024-03-03T08:00:00Z", x12Mapping: "G62 (Date/Time)" },
              { name: "notes", type: "string", required: false, description: "Counter-offer notes", example: "Can pick up one day later", maxLength: 500, x12Mapping: "NTE02" },
            ],
          },
          { name: "driverName", type: "string", required: false, description: "Assigned driver name", example: "Mike Johnson", x12Mapping: "N102 (Driver Name)" },
          { name: "driverPhone", type: "string", required: false, description: "Driver contact phone", example: "555-123-4567", x12Mapping: "G61 > G6104" },
          { name: "truckNumber", type: "string", required: false, description: "Truck / unit number", example: "TRK-4521", x12Mapping: "N7 > N702 (Equipment Number)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "a20e8400-...", "messageType": "LoadTenderResponse", "version": "2.1", "sender": "CARRIER-API", "receiver": "UNIS-API", "timestamp": "2024-03-01T09:30:00Z" },
  "tenderResponse": {
    "originalShipmentId": "SHIP-2024-03-0001", "scac": "SNLU", "responseCode": "accepted", "responseDate": "2024-03-01",
    "driverName": "Mike Johnson", "driverPhone": "555-123-4567", "truckNumber": "TRK-4521"
  }
}`,
    responseExample: `{ "status": "received", "messageId": "a20e8400-...", "receivedAt": "2024-03-01T09:30:01Z" }`,
  },
  {
    id: "api-214", code: "ShipmentStatus", name: "Transportation Carrier Shipment Status",
    ediEquivalent: "214", category: "transportation", direction: "inbound", version: "v2.1",
    description: "Receive real-time shipment status updates from carriers including pickup, in-transit checkpoints, delivery, and exceptions. Replaces the EDI 214.",
    endpoint: { method: "POST", path: "/api/v2/messages/shipment-status", description: "Receive carrier shipment status update" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("ShipmentStatus", { id: "a30e8400-e29b-41d4-a716-446655440012", sender: "CARRIER-API", receiver: "UNIS-API", ts: "2024-03-02T14:30:00Z" }),
      {
        name: "shipmentStatus", type: "object", required: true, description: "Shipment status update", x12Mapping: "B10 Segment (Beginning Segment for Shipment Status)",
        children: [
          { name: "shipmentId", type: "string", required: true, description: "Shipment identifier (from original 204)", example: "SHIP-2024-03-0001", x12Mapping: "B1002 (Shipment ID)" },
          { name: "scac", type: "string", required: true, description: "Carrier SCAC code", example: "SNLU", maxLength: 4, x12Mapping: "B1001 (SCAC)" },
          { name: "bolNumber", type: "string", required: false, description: "Bill of Lading number", example: "BOL-20240302-001", x12Mapping: "B1004 (BOL Number)" },
          {
            name: "statusUpdate", type: "object", required: true, description: "Current status event", x12Mapping: "AT7 Segment (Shipment Status Details)",
            children: [
              { name: "statusCode", type: "string", required: true, description: "Shipment status code", example: "in_transit", enum: ["dispatched", "picked_up", "in_transit", "at_checkpoint", "out_for_delivery", "delivered", "exception", "returned"], x12Mapping: "AT701 (Shipment Status Code)" },
              { name: "statusReason", type: "string", required: false, description: "Reason code for exceptions", example: "weather_delay", enum: ["weather_delay", "mechanical", "shipper_delay", "receiver_delay", "damaged", "refused", "other"], x12Mapping: "AT702 (Shipment Status Reason)" },
              { name: "statusDateTime", type: "datetime", required: true, description: "Date/time of status event", example: "2024-03-02T14:30:00Z", x12Mapping: "AT705/AT706 (Date/Time)" },
              { name: "estimatedArrival", type: "datetime", required: false, description: "Updated ETA", example: "2024-03-03T12:00:00Z", x12Mapping: "G62 (Estimated Arrival)" },
            ],
          },
          {
            name: "location", type: "object", required: true, description: "Current location at time of status", x12Mapping: "MS1 Segment (Equipment/Container/Location)",
            children: [
              { name: "city", type: "string", required: true, description: "City", example: "Nashville", x12Mapping: "MS101 (City)" },
              { name: "state", type: "string", required: true, description: "State", example: "TN", x12Mapping: "MS102 (State)" },
              { name: "country", type: "string", required: false, description: "Country code", example: "US", x12Mapping: "MS103 (Country)" },
              { name: "latitude", type: "number", required: false, description: "GPS latitude", example: "36.1627" },
              { name: "longitude", type: "number", required: false, description: "GPS longitude", example: "-86.7816" },
            ],
          },
          { name: "stopNumber", type: "integer", required: false, description: "Related stop number from the original tender", example: "1", x12Mapping: "S501 (Stop Sequence)" },
          {
            name: "proofOfDelivery", type: "object", required: false, description: "Delivery confirmation details (when statusCode = delivered)", x12Mapping: "K1/POD Segment",
            children: [
              { name: "signedBy", type: "string", required: true, description: "Name of person who signed", example: "Robert Williams", x12Mapping: "K101 (Free-Form Text)" },
              { name: "deliveredAt", type: "datetime", required: true, description: "Actual delivery date/time", example: "2024-03-03T11:45:00Z", x12Mapping: "AT705/AT706" },
              { name: "exceptionNotes", type: "string", required: false, description: "Delivery exception notes", example: "2 pallets short", x12Mapping: "K101 (Note)" },
            ],
          },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "a30e8400-...", "messageType": "ShipmentStatus", "version": "2.1", "sender": "CARRIER-API", "receiver": "UNIS-API", "timestamp": "2024-03-02T14:30:00Z" },
  "shipmentStatus": {
    "shipmentId": "SHIP-2024-03-0001", "scac": "SNLU", "bolNumber": "BOL-20240302-001",
    "statusUpdate": { "statusCode": "in_transit", "statusDateTime": "2024-03-02T14:30:00Z", "estimatedArrival": "2024-03-03T12:00:00Z" },
    "location": { "city": "Nashville", "state": "TN", "country": "US", "latitude": 36.1627, "longitude": -86.7816 }
  }
}`,
    responseExample: `{ "status": "received", "messageId": "a30e8400-...", "receivedAt": "2024-03-02T14:30:01Z" }`,
  },
  {
    id: "api-210", code: "FreightInvoice", name: "Motor Carrier Freight Invoice",
    ediEquivalent: "210", category: "transportation", direction: "inbound", version: "v2.1",
    description: "Receive freight invoices from carriers for completed shipments, including line-haul charges, accessorial charges, and surcharges. Replaces the EDI 210.",
    endpoint: { method: "POST", path: "/api/v2/messages/freight-invoice", description: "Receive freight invoice from carrier" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("FreightInvoice", { id: "a40e8400-e29b-41d4-a716-446655440013", sender: "CARRIER-API", receiver: "UNIS-API", ts: "2024-03-05T10:00:00Z" }),
      {
        name: "freightInvoice", type: "object", required: true, description: "Freight invoice details", x12Mapping: "B3 Segment (Beginning Segment for Carrier Invoice)",
        children: [
          { name: "invoiceNumber", type: "string", required: true, description: "Carrier invoice number", example: "CINV-SNLU-2024-0301", x12Mapping: "B302 (Invoice Number)" },
          { name: "invoiceDate", type: "string", required: true, description: "Invoice date", example: "2024-03-05", format: "date", x12Mapping: "B306 (Invoice Date)" },
          { name: "shipmentId", type: "string", required: true, description: "Related shipment ID", example: "SHIP-2024-03-0001", x12Mapping: "B304 (Shipment ID)" },
          { name: "bolNumber", type: "string", required: true, description: "Bill of Lading number", example: "BOL-20240302-001", x12Mapping: "B305 (BOL Number)" },
          { name: "scac", type: "string", required: true, description: "Carrier SCAC code", example: "SNLU", maxLength: 4, x12Mapping: "B301 (SCAC)" },
          { name: "currency", type: "string", required: true, description: "Currency code", example: "USD", x12Mapping: "CUR02" },
          { name: "paymentTerms", type: "string", required: false, description: "Payment terms", example: "NET30", enum: ["NET15", "NET30", "NET45", "DUE_ON_RECEIPT"], x12Mapping: "ITD01 (Terms Type)" },
          {
            name: "shipmentSummary", type: "object", required: true, description: "Shipment summary for the invoice", x12Mapping: "N1/N3/N4 + MS/N7",
            children: [
              { name: "originCity", type: "string", required: true, description: "Origin city", example: "Louisville", x12Mapping: "N1*SH > N401" },
              { name: "originState", type: "string", required: true, description: "Origin state", example: "KY", x12Mapping: "N1*SH > N402" },
              { name: "destinationCity", type: "string", required: true, description: "Destination city", example: "Oklahoma City", x12Mapping: "N1*CN > N401" },
              { name: "destinationState", type: "string", required: true, description: "Destination state", example: "OK", x12Mapping: "N1*CN > N402" },
              { name: "totalWeight", type: "number", required: true, description: "Total weight", example: "42000", x12Mapping: "L004 (Weight)" },
              { name: "weightUnit", type: "string", required: true, description: "Weight unit", example: "LB", x12Mapping: "L005" },
              { name: "totalMiles", type: "number", required: false, description: "Total miles", example: "1250", x12Mapping: "MS306 (Distance)" },
              { name: "pickupDate", type: "string", required: true, description: "Actual pickup date", example: "2024-03-02", format: "date", x12Mapping: "G62*86 (Actual Pickup)" },
              { name: "deliveryDate", type: "string", required: true, description: "Actual delivery date", example: "2024-03-03", format: "date", x12Mapping: "G62*11 (Actual Delivery)" },
            ],
          },
          {
            name: "charges", type: "array", required: true, description: "Itemized charge lines", x12Mapping: "L1 Loop (Rate and Charges)",
            children: [
              { name: "chargeType", type: "string", required: true, description: "Type of charge", example: "linehaul", enum: ["linehaul", "fuel_surcharge", "detention", "lumper", "accessorial", "hazmat", "reefer", "stop_off", "other"], x12Mapping: "L101 (Lading Line Item Number)" },
              { name: "description", type: "string", required: true, description: "Charge description", example: "Line-haul freight charge", x12Mapping: "L110 (Special Charge Description)" },
              { name: "amount", type: "number", required: true, description: "Charge amount", example: "3500.00", x12Mapping: "L102 (Freight Rate)" },
              { name: "rateType", type: "string", required: false, description: "Rate basis", example: "flat", enum: ["flat", "per_mile", "per_cwt", "per_pallet", "percentage"], x12Mapping: "L103 (Rate/Value Qualifier)" },
            ],
          },
          { name: "subtotal", type: "number", required: true, description: "Subtotal of all charges", example: "3985.00", x12Mapping: "L3 (Total Weight and Charges)" },
          { name: "taxAmount", type: "number", required: false, description: "Applicable tax", example: "0.00", x12Mapping: "TXI02" },
          { name: "totalAmount", type: "number", required: true, description: "Total invoice amount", example: "3985.00", x12Mapping: "L302 (Total Charges)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "a40e8400-...", "messageType": "FreightInvoice", "version": "2.1", "sender": "CARRIER-API", "receiver": "UNIS-API", "timestamp": "2024-03-05T10:00:00Z" },
  "freightInvoice": {
    "invoiceNumber": "CINV-SNLU-2024-0301", "invoiceDate": "2024-03-05",
    "shipmentId": "SHIP-2024-03-0001", "bolNumber": "BOL-20240302-001", "scac": "SNLU", "currency": "USD", "paymentTerms": "NET30",
    "shipmentSummary": { "originCity": "Louisville", "originState": "KY", "destinationCity": "Oklahoma City", "destinationState": "OK", "totalWeight": 42000, "weightUnit": "LB", "totalMiles": 1250, "pickupDate": "2024-03-02", "deliveryDate": "2024-03-03" },
    "charges": [
      { "chargeType": "linehaul", "description": "Line-haul freight charge", "amount": 3500.00, "rateType": "flat" },
      { "chargeType": "fuel_surcharge", "description": "Fuel surcharge (12%)", "amount": 420.00, "rateType": "percentage" },
      { "chargeType": "stop_off", "description": "Stop-off fee", "amount": 65.00, "rateType": "flat" }
    ],
    "subtotal": 3985.00, "taxAmount": 0.00, "totalAmount": 3985.00
  }
}`,
    responseExample: `{ "status": "received", "messageId": "a40e8400-...", "receivedAt": "2024-03-05T10:00:01Z", "validationStatus": "passed" }`,
  },
  // ======================== WAREHOUSE / INVENTORY ========================
  {
    id: "api-940", code: "WarehouseShippingOrder", name: "Warehouse Shipping Order",
    ediEquivalent: "940", category: "warehouse", direction: "outbound", version: "v2.1",
    description: "Send a shipping order to a 3PL warehouse, instructing them to pick, pack, and ship inventory to a specified destination. Replaces the EDI 940.",
    endpoint: { method: "POST", path: "/api/v2/messages/warehouse-shipping-order", description: "Submit a warehouse shipping order to 3PL" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("WarehouseShippingOrder", { id: "b10e8400-e29b-41d4-a716-446655440020", sender: "UNIS-API", receiver: "3PL-API", ts: "2024-04-01T08:00:00Z" }),
      {
        name: "shippingOrder", type: "object", required: true, description: "Warehouse shipping order details", x12Mapping: "W06 Segment (Beginning Segment for Warehouse Shipping Order)",
        children: [
          { name: "orderNumber", type: "string", required: true, description: "Unique warehouse order number", example: "WSO-2024-001", x12Mapping: "W0602 (Depositor Order Number)" },
          { name: "depositor", type: "string", required: true, description: "Depositor / owner of goods", example: "MIDEA-US", x12Mapping: "N1*DE > N104 (Depositor ID)" },
          { name: "orderDate", type: "string", required: true, description: "Order date", example: "2024-04-01", format: "date", x12Mapping: "W0604 (Date)" },
          { name: "requestedShipDate", type: "string", required: true, description: "Requested ship date", example: "2024-04-03", format: "date", x12Mapping: "DTM*010 (Requested Ship Date)" },
          { name: "shipmentMethod", type: "string", required: true, description: "Shipment method", example: "ground", enum: ["ground", "express", "freight", "ltl", "customer_pickup"], x12Mapping: "W0601 (Reporting Code)" },
          { name: "carrierScac", type: "string", required: false, description: "Preferred carrier SCAC", example: "UPSN", maxLength: 4, x12Mapping: "W0609 (SCAC)" },
          {
            name: "shipTo", type: "object", required: true, description: "Ship-to destination address", x12Mapping: "N1*ST Loop + N3 + N4",
            children: [
              { name: "name", type: "string", required: true, description: "Recipient name", example: "Walmart DC #6082", x12Mapping: "N1*ST > N102 (Name)" },
              { name: "address", type: "string", required: true, description: "Street address", example: "7300 SW 44th St", x12Mapping: "N301" },
              { name: "city", type: "string", required: true, description: "City", example: "Oklahoma City", x12Mapping: "N401" },
              { name: "state", type: "string", required: true, description: "State", example: "OK", x12Mapping: "N402" },
              { name: "zip", type: "string", required: true, description: "ZIP code", example: "73179", x12Mapping: "N403" },
              { name: "country", type: "string", required: false, description: "Country code", example: "US", x12Mapping: "N404" },
            ],
          },
          {
            name: "lineItems", type: "array", required: true, description: "Items to ship from warehouse", x12Mapping: "W04 Loop (Line Item Detail)",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "W0401 (Sequence Number)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-001", x12Mapping: "W0405 (Product ID)" },
              { name: "upc", type: "string", required: false, description: "UPC code", example: "012345678905", x12Mapping: "W0407 (UPC)" },
              { name: "description", type: "string", required: false, description: "Product description", example: "Midea Portable AC 12000 BTU", x12Mapping: "G6901 (Description)" },
              { name: "quantityOrdered", type: "integer", required: true, description: "Quantity to ship", example: "100", x12Mapping: "W0402 (Quantity Ordered)" },
              { name: "unitOfMeasure", type: "string", required: true, description: "Unit of measure", example: "EA", enum: ["EA", "CS", "PK", "PL"], x12Mapping: "W0403 (Unit of Measure)" },
              { name: "lotNumber", type: "string", required: false, description: "Lot / batch number", example: "LOT-2024-Q1", x12Mapping: "W04 > N9*LT (Lot Reference)" },
              { name: "serialNumbers", type: "array", required: false, description: "Serial numbers (if serialized)", x12Mapping: "W04 > N9*SE (Serial Reference)", children: [
                { name: "serialNumber", type: "string", required: true, description: "Serial number", example: "SN-00001", x12Mapping: "N902 (Reference ID)" },
              ]},
            ],
          },
          { name: "specialInstructions", type: "string", required: false, description: "Special handling instructions", example: "Stack no more than 3 high", maxLength: 500, x12Mapping: "N901/NTE02 (Note)" },
          { name: "poNumber", type: "string", required: false, description: "Related purchase order number", example: "PO-WMT-2024-5678", x12Mapping: "N9*PO > N902 (PO Reference)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b10e8400-...", "messageType": "WarehouseShippingOrder", "version": "2.1", "sender": "UNIS-API", "receiver": "3PL-API", "timestamp": "2024-04-01T08:00:00Z" },
  "shippingOrder": {
    "orderNumber": "WSO-2024-001", "depositor": "MIDEA-US", "orderDate": "2024-04-01", "requestedShipDate": "2024-04-03",
    "shipmentMethod": "ground", "carrierScac": "UPSN",
    "shipTo": { "name": "Walmart DC #6082", "address": "7300 SW 44th St", "city": "Oklahoma City", "state": "OK", "zip": "73179", "country": "US" },
    "lineItems": [
      { "lineNumber": 1, "sku": "SKU-AC-001", "upc": "012345678905", "description": "Midea Portable AC 12000 BTU", "quantityOrdered": 100, "unitOfMeasure": "EA", "lotNumber": "LOT-2024-Q1" }
    ],
    "specialInstructions": "Stack no more than 3 high", "poNumber": "PO-WMT-2024-5678"
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "b10e8400-...", "receivedAt": "2024-04-01T08:00:01Z", "warehouseRef": "WH-REF-20240401-001" }`,
  },
  {
    id: "api-945", code: "WarehouseShippingAdvice", name: "Warehouse Shipping Advice",
    ediEquivalent: "945", category: "warehouse", direction: "inbound", version: "v2.1",
    description: "Receive confirmation from the 3PL warehouse that a shipping order (940) has been fulfilled, including actual quantities shipped, carrier details, and tracking numbers. Replaces the EDI 945.",
    endpoint: { method: "POST", path: "/api/v2/messages/warehouse-shipping-advice", description: "Receive warehouse shipment confirmation from 3PL" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("WarehouseShippingAdvice", { id: "b20e8400-e29b-41d4-a716-446655440021", sender: "3PL-API", receiver: "UNIS-API", ts: "2024-04-03T16:00:00Z" }),
      {
        name: "shippingAdvice", type: "object", required: true, description: "Warehouse shipping confirmation details", x12Mapping: "W06 Segment (Beginning Segment for Warehouse Shipping Advice)",
        children: [
          { name: "adviceNumber", type: "string", required: true, description: "Warehouse shipping advice number", example: "WSA-2024-001", x12Mapping: "W0602 (Depositor Order Number)" },
          { name: "originalOrderNumber", type: "string", required: true, description: "Original 940 order number", example: "WSO-2024-001", x12Mapping: "N9*PO > N902 (Reference)" },
          { name: "depositor", type: "string", required: true, description: "Depositor ID", example: "MIDEA-US", x12Mapping: "N1*DE > N104" },
          { name: "shipDate", type: "string", required: true, description: "Actual ship date", example: "2024-04-03", format: "date", x12Mapping: "W0604 (Date)" },
          {
            name: "carrier", type: "object", required: true, description: "Actual carrier used", x12Mapping: "W27 Segment (Carrier Detail)",
            children: [
              { name: "name", type: "string", required: true, description: "Carrier name", example: "UPS", x12Mapping: "W2702 (Carrier Name)" },
              { name: "scac", type: "string", required: true, description: "Carrier SCAC", example: "UPSN", x12Mapping: "W2701 (SCAC)" },
              { name: "trackingNumber", type: "string", required: true, description: "Tracking / PRO number", example: "1Z999AA10123456784", x12Mapping: "W2704 (Tracking Number)" },
              { name: "bolNumber", type: "string", required: false, description: "Bill of Lading number", example: "BOL-3PL-20240403", x12Mapping: "W2706 (BOL)" },
            ],
          },
          {
            name: "lineItems", type: "array", required: true, description: "Items actually shipped", x12Mapping: "W12 Loop (Shipment Item Detail)",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "W1201 (Sequence)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-001", x12Mapping: "W1203 (Product ID)" },
              { name: "quantityOrdered", type: "integer", required: true, description: "Original quantity ordered", example: "100", x12Mapping: "W1207 (Qty Ordered)" },
              { name: "quantityShipped", type: "integer", required: true, description: "Actual quantity shipped", example: "98", x12Mapping: "W1202 (Qty Shipped)" },
              { name: "shortageReason", type: "string", required: false, description: "Reason for shortage", example: "damaged_in_warehouse", enum: ["out_of_stock", "damaged_in_warehouse", "on_hold", "other"], x12Mapping: "W14 (Shortage Reason)" },
              { name: "lotNumber", type: "string", required: false, description: "Lot shipped from", example: "LOT-2024-Q1", x12Mapping: "N9*LT" },
            ],
          },
          { name: "totalPieces", type: "integer", required: true, description: "Total pieces shipped", example: "98", x12Mapping: "W03 (Total Shipped Qty)" },
          { name: "totalWeight", type: "number", required: false, description: "Total weight in LB", example: "4900.0", x12Mapping: "W03 (Total Weight)" },
          { name: "palletCount", type: "integer", required: false, description: "Number of pallets", example: "5", x12Mapping: "W03 (Lading Quantity)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b20e8400-...", "messageType": "WarehouseShippingAdvice", "version": "2.1", "sender": "3PL-API", "receiver": "UNIS-API", "timestamp": "2024-04-03T16:00:00Z" },
  "shippingAdvice": {
    "adviceNumber": "WSA-2024-001", "originalOrderNumber": "WSO-2024-001", "depositor": "MIDEA-US", "shipDate": "2024-04-03",
    "carrier": { "name": "UPS", "scac": "UPSN", "trackingNumber": "1Z999AA10123456784", "bolNumber": "BOL-3PL-20240403" },
    "lineItems": [{ "lineNumber": 1, "sku": "SKU-AC-001", "quantityOrdered": 100, "quantityShipped": 98, "shortageReason": "damaged_in_warehouse", "lotNumber": "LOT-2024-Q1" }],
    "totalPieces": 98, "totalWeight": 4900.0, "palletCount": 5
  }
}`,
    responseExample: `{ "status": "received", "messageId": "b20e8400-...", "receivedAt": "2024-04-03T16:00:01Z" }`,
  },
  {
    id: "api-943", code: "WarehouseStockTransferShipment", name: "Warehouse Stock Transfer Shipment Advice",
    ediEquivalent: "943", category: "warehouse", direction: "outbound", version: "v2.1",
    description: "Notify a 3PL warehouse that an inbound stock transfer shipment is on its way. Used to pre-advise the warehouse of incoming inventory for receiving preparation. Replaces the EDI 943.",
    endpoint: { method: "POST", path: "/api/v2/messages/stock-transfer-shipment", description: "Notify warehouse of inbound stock transfer" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("WarehouseStockTransferShipment", { id: "b30e8400-e29b-41d4-a716-446655440022", sender: "UNIS-API", receiver: "3PL-API", ts: "2024-04-05T09:00:00Z" }),
      {
        name: "stockTransfer", type: "object", required: true, description: "Stock transfer shipment details", x12Mapping: "W06 Segment (Beginning Segment for Stock Transfer)",
        children: [
          { name: "transferNumber", type: "string", required: true, description: "Stock transfer reference number", example: "STS-2024-001", x12Mapping: "W0602 (Depositor Order Number)" },
          { name: "depositor", type: "string", required: true, description: "Depositor / goods owner", example: "MIDEA-US", x12Mapping: "N1*DE > N104" },
          { name: "transferDate", type: "string", required: true, description: "Transfer initiation date", example: "2024-04-05", format: "date", x12Mapping: "W0604 (Date)" },
          { name: "expectedArrivalDate", type: "string", required: true, description: "Expected warehouse arrival date", example: "2024-04-07", format: "date", x12Mapping: "DTM*017 (Estimated Arrival)" },
          {
            name: "originWarehouse", type: "object", required: true, description: "Origin warehouse / facility", x12Mapping: "N1*SF Loop (Ship From)",
            children: [
              { name: "name", type: "string", required: true, description: "Origin facility name", example: "Midea Factory - Wuhu", x12Mapping: "N1*SF > N102" },
              { name: "code", type: "string", required: false, description: "Facility code", example: "WH-WUHU-01", x12Mapping: "N1*SF > N104" },
            ],
          },
          {
            name: "destinationWarehouse", type: "object", required: true, description: "Destination 3PL warehouse", x12Mapping: "N1*ST Loop (Ship To)",
            children: [
              { name: "name", type: "string", required: true, description: "Destination warehouse name", example: "3PL Central - Memphis", x12Mapping: "N1*ST > N102" },
              { name: "code", type: "string", required: true, description: "Warehouse code", example: "3PL-MEM-01", x12Mapping: "N1*ST > N104" },
            ],
          },
          {
            name: "lineItems", type: "array", required: true, description: "Items being transferred", x12Mapping: "W04 Loop",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "W0401" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-002", x12Mapping: "W0405" },
              { name: "description", type: "string", required: false, description: "Product description", example: "Midea Window AC 8000 BTU", x12Mapping: "G6901" },
              { name: "quantity", type: "integer", required: true, description: "Quantity being transferred", example: "500", x12Mapping: "W0402 (Quantity)" },
              { name: "unitOfMeasure", type: "string", required: true, description: "Unit of measure", example: "EA", x12Mapping: "W0403" },
              { name: "lotNumber", type: "string", required: false, description: "Lot number", example: "LOT-WH-2024-04", x12Mapping: "N9*LT" },
            ],
          },
          { name: "totalPallets", type: "integer", required: false, description: "Number of pallets", example: "25", x12Mapping: "W03 (Lading Quantity)" },
          { name: "carrierScac", type: "string", required: false, description: "Carrier SCAC", example: "FDEG", x12Mapping: "W27 > W2701" },
          { name: "proNumber", type: "string", required: false, description: "Freight PRO number", example: "PRO-FDX-20240405", x12Mapping: "W27 > W2704" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b30e8400-...", "messageType": "WarehouseStockTransferShipment", "version": "2.1", "sender": "UNIS-API", "receiver": "3PL-API", "timestamp": "2024-04-05T09:00:00Z" },
  "stockTransfer": {
    "transferNumber": "STS-2024-001", "depositor": "MIDEA-US", "transferDate": "2024-04-05", "expectedArrivalDate": "2024-04-07",
    "originWarehouse": { "name": "Midea Factory - Wuhu", "code": "WH-WUHU-01" },
    "destinationWarehouse": { "name": "3PL Central - Memphis", "code": "3PL-MEM-01" },
    "lineItems": [{ "lineNumber": 1, "sku": "SKU-AC-002", "description": "Midea Window AC 8000 BTU", "quantity": 500, "unitOfMeasure": "EA", "lotNumber": "LOT-WH-2024-04" }],
    "totalPallets": 25, "carrierScac": "FDEG", "proNumber": "PRO-FDX-20240405"
  }
}`,
    responseExample: `{ "status": "accepted", "messageId": "b30e8400-...", "receivedAt": "2024-04-05T09:00:01Z" }`,
  },
  {
    id: "api-944", code: "WarehouseStockTransferReceipt", name: "Warehouse Stock Transfer Receipt Advice",
    ediEquivalent: "944", category: "warehouse", direction: "inbound", version: "v2.1",
    description: "Receive confirmation from the 3PL warehouse that an inbound stock transfer (943) has been received, including actual quantities received, damages, and discrepancies. Replaces the EDI 944.",
    endpoint: { method: "POST", path: "/api/v2/messages/stock-transfer-receipt", description: "Receive warehouse stock transfer receipt" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("WarehouseStockTransferReceipt", { id: "b40e8400-e29b-41d4-a716-446655440023", sender: "3PL-API", receiver: "UNIS-API", ts: "2024-04-07T14:00:00Z" }),
      {
        name: "receiptAdvice", type: "object", required: true, description: "Stock transfer receipt confirmation", x12Mapping: "W17 Segment (Warehouse Receipt ID)",
        children: [
          { name: "receiptNumber", type: "string", required: true, description: "Warehouse receipt number", example: "WRC-2024-001", x12Mapping: "W1702 (Warehouse Receipt Number)" },
          { name: "originalTransferNumber", type: "string", required: true, description: "Original 943 transfer number", example: "STS-2024-001", x12Mapping: "N9*PO > N902" },
          { name: "depositor", type: "string", required: true, description: "Depositor ID", example: "MIDEA-US", x12Mapping: "N1*DE > N104" },
          { name: "receiptDate", type: "string", required: true, description: "Actual receipt date", example: "2024-04-07", format: "date", x12Mapping: "W1703 (Date)" },
          { name: "warehouseCode", type: "string", required: true, description: "Receiving warehouse code", example: "3PL-MEM-01", x12Mapping: "N1*WH > N104" },
          {
            name: "lineItems", type: "array", required: true, description: "Items received", x12Mapping: "W07 Loop (Item Detail Receiving)",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "W0701 (Sequence)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-002", x12Mapping: "W0705 (Product ID)" },
              { name: "quantityExpected", type: "integer", required: true, description: "Expected quantity from 943", example: "500", x12Mapping: "W0702 (Qty Expected)" },
              { name: "quantityReceived", type: "integer", required: true, description: "Actual quantity received", example: "495", x12Mapping: "W0703 (Qty Received)" },
              { name: "quantityDamaged", type: "integer", required: false, description: "Quantity received damaged", example: "3", x12Mapping: "W0704 (Qty Damaged)" },
              { name: "discrepancyReason", type: "string", required: false, description: "Reason for discrepancy", example: "shipping_damage", enum: ["shipping_damage", "short_shipment", "wrong_item", "expired", "other"], x12Mapping: "W14 (Adjustment Reason)" },
              { name: "lotNumber", type: "string", required: false, description: "Lot number received into", example: "LOT-WH-2024-04", x12Mapping: "N9*LT" },
              { name: "locationCode", type: "string", required: false, description: "Warehouse bin / location", example: "A-12-03", x12Mapping: "W20 (Location ID)" },
            ],
          },
          { name: "totalReceived", type: "integer", required: true, description: "Total pieces received", example: "495", x12Mapping: "W03 (Total Qty)" },
          { name: "totalDamaged", type: "integer", required: false, description: "Total pieces damaged", example: "3", x12Mapping: "W03 (Damage Qty)" },
          { name: "receiverNotes", type: "string", required: false, description: "Receiving notes", example: "3 units with dented packaging, placed on hold", maxLength: 500, x12Mapping: "N901/NTE02" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b40e8400-...", "messageType": "WarehouseStockTransferReceipt", "version": "2.1", "sender": "3PL-API", "receiver": "UNIS-API", "timestamp": "2024-04-07T14:00:00Z" },
  "receiptAdvice": {
    "receiptNumber": "WRC-2024-001", "originalTransferNumber": "STS-2024-001", "depositor": "MIDEA-US",
    "receiptDate": "2024-04-07", "warehouseCode": "3PL-MEM-01",
    "lineItems": [{ "lineNumber": 1, "sku": "SKU-AC-002", "quantityExpected": 500, "quantityReceived": 495, "quantityDamaged": 3, "discrepancyReason": "shipping_damage", "lotNumber": "LOT-WH-2024-04", "locationCode": "A-12-03" }],
    "totalReceived": 495, "totalDamaged": 3, "receiverNotes": "3 units with dented packaging, placed on hold"
  }
}`,
    responseExample: `{ "status": "received", "messageId": "b40e8400-...", "receivedAt": "2024-04-07T14:00:01Z" }`,
  },
  {
    id: "api-846", code: "InventoryInquiryAdvice", name: "Inventory Inquiry / Advice",
    ediEquivalent: "846", category: "warehouse", direction: "inbound", version: "v2.1",
    description: "Receive inventory snapshots or real-time inventory updates from a 3PL warehouse, including on-hand quantities, allocated quantities, and available-to-promise by location and lot. Replaces the EDI 846.",
    endpoint: { method: "POST", path: "/api/v2/messages/inventory-advice", description: "Receive inventory snapshot from 3PL" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("InventoryInquiryAdvice", { id: "b50e8400-e29b-41d4-a716-446655440024", sender: "3PL-API", receiver: "UNIS-API", ts: "2024-04-08T06:00:00Z" }),
      {
        name: "inventoryAdvice", type: "object", required: true, description: "Inventory report details", x12Mapping: "BIA Segment (Beginning Segment for Inventory Inquiry/Advice)",
        children: [
          { name: "reportId", type: "string", required: true, description: "Inventory report identifier", example: "INV-RPT-2024-0408", x12Mapping: "BIA03 (Report ID)" },
          { name: "reportType", type: "string", required: true, description: "Report type", example: "snapshot", enum: ["snapshot", "delta", "cycle_count"], x12Mapping: "BIA01 (Transaction Set Purpose: 00=Snapshot, 04=Change)" },
          { name: "reportDate", type: "string", required: true, description: "Report as-of date", example: "2024-04-08", format: "date", x12Mapping: "BIA04 (Date)" },
          { name: "warehouseCode", type: "string", required: true, description: "Warehouse code", example: "3PL-MEM-01", x12Mapping: "N1*WH > N104" },
          { name: "depositor", type: "string", required: true, description: "Depositor ID", example: "MIDEA-US", x12Mapping: "N1*DE > N104" },
          {
            name: "items", type: "array", required: true, description: "Inventory items", x12Mapping: "LIN/QTY Loop (Item Identification + Quantities)",
            children: [
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-001", x12Mapping: "LIN03 (Product ID)" },
              { name: "upc", type: "string", required: false, description: "UPC code", example: "012345678905", x12Mapping: "LIN05 (UPC)" },
              { name: "description", type: "string", required: false, description: "Product description", example: "Midea Portable AC 12000 BTU", x12Mapping: "PID05" },
              { name: "quantityOnHand", type: "integer", required: true, description: "Total on-hand quantity", example: "2500", x12Mapping: "QTY*33 (Quantity On Hand)" },
              { name: "quantityAllocated", type: "integer", required: false, description: "Quantity allocated to orders", example: "800", x12Mapping: "QTY*20 (Quantity Allocated)" },
              { name: "quantityAvailable", type: "integer", required: true, description: "Available-to-promise (on-hand - allocated - hold)", example: "1650", x12Mapping: "QTY*QA (Available to Promise)" },
              { name: "quantityOnHold", type: "integer", required: false, description: "Quantity on hold (damaged, QC)", example: "50", x12Mapping: "QTY*QH (On Hold)" },
              { name: "unitOfMeasure", type: "string", required: true, description: "Unit of measure", example: "EA", x12Mapping: "QTY UOM" },
              {
                name: "locations", type: "array", required: false, description: "Inventory breakdown by warehouse location", x12Mapping: "SDQ Segment (Location Detail)",
                children: [
                  { name: "locationCode", type: "string", required: true, description: "Bin / location code", example: "A-12-03", x12Mapping: "SDQ > Location ID" },
                  { name: "quantity", type: "integer", required: true, description: "Quantity at this location", example: "500", x12Mapping: "SDQ > Quantity" },
                  { name: "lotNumber", type: "string", required: false, description: "Lot at this location", example: "LOT-2024-Q1", x12Mapping: "SDQ > N9*LT" },
                ],
              },
            ],
          },
          { name: "totalSkuCount", type: "integer", required: true, description: "Total number of unique SKUs", example: "45", x12Mapping: "CTT01 (Number of Line Items)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b50e8400-...", "messageType": "InventoryInquiryAdvice", "version": "2.1", "sender": "3PL-API", "receiver": "UNIS-API", "timestamp": "2024-04-08T06:00:00Z" },
  "inventoryAdvice": {
    "reportId": "INV-RPT-2024-0408", "reportType": "snapshot", "reportDate": "2024-04-08",
    "warehouseCode": "3PL-MEM-01", "depositor": "MIDEA-US",
    "items": [{
      "sku": "SKU-AC-001", "upc": "012345678905", "description": "Midea Portable AC 12000 BTU",
      "quantityOnHand": 2500, "quantityAllocated": 800, "quantityAvailable": 1650, "quantityOnHold": 50, "unitOfMeasure": "EA",
      "locations": [
        { "locationCode": "A-12-03", "quantity": 500, "lotNumber": "LOT-2024-Q1" },
        { "locationCode": "B-05-01", "quantity": 2000, "lotNumber": "LOT-2024-Q2" }
      ]
    }],
    "totalSkuCount": 45
  }
}`,
    responseExample: `{ "status": "received", "messageId": "b50e8400-...", "receivedAt": "2024-04-08T06:00:01Z", "itemsProcessed": 45 }`,
  },
  {
    id: "api-947", code: "WarehouseInventoryAdjustment", name: "Warehouse Inventory Adjustment Advice",
    ediEquivalent: "947", category: "warehouse", direction: "inbound", version: "v2.1",
    description: "Receive inventory adjustment notifications from the 3PL warehouse, including cycle count corrections, damage write-offs, returns processing, and other inventory changes. Replaces the EDI 947.",
    endpoint: { method: "POST", path: "/api/v2/messages/inventory-adjustment", description: "Receive inventory adjustment from 3PL" },
    headers: sharedHeaders,
    requestSchema: [
      headerSchema("WarehouseInventoryAdjustment", { id: "b60e8400-e29b-41d4-a716-446655440025", sender: "3PL-API", receiver: "UNIS-API", ts: "2024-04-10T11:30:00Z" }),
      {
        name: "inventoryAdjustment", type: "object", required: true, description: "Inventory adjustment details", x12Mapping: "W17 Segment (Warehouse Inventory Adjustment)",
        children: [
          { name: "adjustmentNumber", type: "string", required: true, description: "Unique adjustment reference", example: "ADJ-2024-0042", x12Mapping: "W1702 (Adjustment Number)" },
          { name: "adjustmentType", type: "string", required: true, description: "Type of adjustment", example: "cycle_count", enum: ["cycle_count", "damage", "return", "expiration", "recount", "transfer", "other"], x12Mapping: "W1701 (Adjustment Type Code)" },
          { name: "adjustmentDate", type: "string", required: true, description: "Date of adjustment", example: "2024-04-10", format: "date", x12Mapping: "W1703 (Date)" },
          { name: "warehouseCode", type: "string", required: true, description: "Warehouse code", example: "3PL-MEM-01", x12Mapping: "N1*WH > N104" },
          { name: "depositor", type: "string", required: true, description: "Depositor ID", example: "MIDEA-US", x12Mapping: "N1*DE > N104" },
          {
            name: "lineItems", type: "array", required: true, description: "Adjusted items", x12Mapping: "W13 Loop (Item Detail Adjustment)",
            children: [
              { name: "lineNumber", type: "integer", required: true, description: "Line number", example: "1", x12Mapping: "W1301 (Sequence)" },
              { name: "sku", type: "string", required: true, description: "Product SKU", example: "SKU-AC-001", x12Mapping: "W1305 (Product ID)" },
              { name: "previousQuantity", type: "integer", required: true, description: "Quantity before adjustment", example: "2500", x12Mapping: "W1302 (Previous Qty)" },
              { name: "adjustedQuantity", type: "integer", required: true, description: "Quantity after adjustment", example: "2485", x12Mapping: "W1303 (New Qty)" },
              { name: "adjustmentQty", type: "integer", required: true, description: "Net change (negative = decrease)", example: "-15", x12Mapping: "W1304 (Adjustment Qty)" },
              { name: "reason", type: "string", required: true, description: "Adjustment reason", example: "cycle_count_variance", enum: ["cycle_count_variance", "damaged_goods", "expired", "customer_return", "warehouse_error", "quality_hold", "other"], x12Mapping: "W14 (Adjustment Reason Code)" },
              { name: "lotNumber", type: "string", required: false, description: "Lot affected", example: "LOT-2024-Q1", x12Mapping: "N9*LT" },
              { name: "locationCode", type: "string", required: false, description: "Warehouse location", example: "A-12-03", x12Mapping: "W20 (Location ID)" },
            ],
          },
          { name: "totalAdjustments", type: "integer", required: true, description: "Total number of line adjustments", example: "3", x12Mapping: "CTT01 (Line Item Count)" },
          { name: "notes", type: "string", required: false, description: "Adjustment notes from warehouse", example: "Cycle count variance found during Q1 audit", maxLength: 500, x12Mapping: "NTE02 (Free-Form Note)" },
        ],
      },
    ],
    samplePayload: `{
  "header": { "messageId": "b60e8400-...", "messageType": "WarehouseInventoryAdjustment", "version": "2.1", "sender": "3PL-API", "receiver": "UNIS-API", "timestamp": "2024-04-10T11:30:00Z" },
  "inventoryAdjustment": {
    "adjustmentNumber": "ADJ-2024-0042", "adjustmentType": "cycle_count", "adjustmentDate": "2024-04-10",
    "warehouseCode": "3PL-MEM-01", "depositor": "MIDEA-US",
    "lineItems": [
      { "lineNumber": 1, "sku": "SKU-AC-001", "previousQuantity": 2500, "adjustedQuantity": 2485, "adjustmentQty": -15, "reason": "cycle_count_variance", "lotNumber": "LOT-2024-Q1", "locationCode": "A-12-03" }
    ],
    "totalAdjustments": 1, "notes": "Cycle count variance found during Q1 audit"
  }
}`,
    responseExample: `{ "status": "received", "messageId": "b60e8400-...", "receivedAt": "2024-04-10T11:30:01Z" }`,
  },
]

const categories = [
  { id: "all", label: "All Messages" },
  { id: "order", label: "Order Management" },
  { id: "shipping", label: "Shipping" },
  { id: "financial", label: "Financial" },
  { id: "transportation", label: "Transportation" },
  { id: "warehouse", label: "Warehouse / Inventory" },
]

// ---- Field Row Component (recursive) ----
function FieldRow({ field, depth = 0 }: { field: JsonField; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = field.children && field.children.length > 0

  const typeColor: Record<string, string> = {
    string: "text-green-700 bg-green-50",
    number: "text-blue-700 bg-blue-50",
    integer: "text-blue-700 bg-blue-50",
    boolean: "text-amber-700 bg-amber-50",
    object: "text-purple-700 bg-purple-50",
    array: "text-pink-700 bg-pink-50",
    datetime: "text-cyan-700 bg-cyan-50",
  }

  return (
    <>
      <tr className={`border-b border-border/50 hover:bg-muted/30 ${depth === 0 ? "bg-muted/10" : ""}`}>
        <td className="px-4 py-2.5 font-mono text-sm" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <div className="flex items-center gap-1.5">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
              >
                {expanded ? "\u25BC" : "\u25B6"}
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            <span className="text-foreground">{field.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${typeColor[field.type] || "text-foreground bg-secondary"}`}>
            {field.type}{field.type === "array" && hasChildren ? "[]" : ""}
          </span>
        </td>
        <td className="px-4 py-2.5 text-center">
          {field.required ? (
            <span className="text-red-600 font-bold text-xs">Required</span>
          ) : (
            <span className="text-muted-foreground text-xs">Optional</span>
          )}
        </td>
        {/* X12 Mapping Column */}
        <td className="px-4 py-2.5">
          {field.x12Mapping ? (
            <code className="text-xs font-mono bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{field.x12Mapping}</code>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-xs">
          <p>{field.description}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {field.example && (
              <span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-foreground">
                e.g. {field.example}
              </span>
            )}
            {field.enum && (
              <span className="text-xs text-muted-foreground">
                Enum: {field.enum.join(" | ")}
              </span>
            )}
            {field.maxLength && (
              <span className="text-xs text-muted-foreground">max: {field.maxLength}</span>
            )}
            {field.pattern && (
              <span className="text-xs font-mono text-muted-foreground">pattern: {field.pattern}</span>
            )}
            {field.format && (
              <span className="text-xs text-muted-foreground">format: {field.format}</span>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && expanded && field.children!.map((child, idx) => (
        <FieldRow key={`${field.name}-${idx}`} field={child} depth={depth + 1} />
      ))}
    </>
  )
}

// ---- Main Component ----
export default function ApiDocsTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedSpec, setSelectedSpec] = useState<ApiMessageSpec | null>(null)
  const [activeDocTab, setActiveDocTab] = useState<"schema" | "sample" | "response">("schema")

  const filteredSpecs = apiSpecs.filter((spec) => {
    const matchesSearch =
      spec.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spec.ediEquivalent.includes(searchTerm)
    const matchesCat = selectedCategory === "all" || spec.category === selectedCategory
    return matchesSearch && matchesCat
  })

  // ---- List View ----
  if (!selectedSpec) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">API Documentation</h2>
          <p className="text-muted-foreground">
            JSON REST API reference for API-integrated trading partners. Each message type maps to an EDI X12 equivalent with full field-level mapping.
          </p>
        </div>

        {/* Auth & Base URL Info */}
        <Card className="p-4 bg-muted/30 border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Base URL</p>
              <code className="text-sm font-mono text-foreground bg-secondary px-2 py-1 rounded">https://api.unis-edi.com</code>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Authentication</p>
              <p className="text-foreground">OAuth2 Bearer Token</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Content-Type</p>
              <code className="text-sm font-mono text-foreground bg-secondary px-2 py-1 rounded">application/json</code>
            </div>
          </div>
        </Card>

        {/* Search and Category Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by message name, code, or EDI equivalent (e.g. 204, 214)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredSpecs.length} message type{filteredSpecs.length !== 1 ? "s" : ""} available
        </p>

        {/* Message Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSpecs.map((spec) => (
            <Card
              key={spec.id}
              className="p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setSelectedSpec(spec); setActiveDocTab("schema") }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-foreground">{spec.code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      spec.direction === "inbound" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {spec.direction}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">{spec.name}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-orange-50 text-xs font-mono text-orange-700 font-semibold">
                  EDI {spec.ediEquivalent}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{spec.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded font-mono font-medium ${
                  spec.endpoint.method === "POST" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                }`}>
                  {spec.endpoint.method}
                </span>
                <code className="font-mono text-foreground">{spec.endpoint.path}</code>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ---- Detail View ----
  const requiredFields = selectedSpec.requestSchema.reduce((count, f) => {
    const countChildren = (field: JsonField): number => {
      let c = field.required ? 1 : 0
      if (field.children) field.children.forEach((ch) => (c += countChildren(ch)))
      return c
    }
    return count + countChildren(f)
  }, 0)

  const totalFields = selectedSpec.requestSchema.reduce((count, f) => {
    const countAll = (field: JsonField): number => {
      let c = 1
      if (field.children) field.children.forEach((ch) => (c += countAll(ch)))
      return c
    }
    return count + countAll(f)
  }, 0)

  const x12MappedCount = selectedSpec.requestSchema.reduce((count, f) => {
    const countMapped = (field: JsonField): number => {
      let c = field.x12Mapping ? 1 : 0
      if (field.children) field.children.forEach((ch) => (c += countMapped(ch)))
      return c
    }
    return count + countMapped(f)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Back Button + Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => setSelectedSpec(null)} className="bg-transparent">
          &larr; Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-foreground">{selectedSpec.code}</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              selectedSpec.direction === "inbound" ? "bg-cyan-100 text-cyan-700" : "bg-purple-100 text-purple-700"
            }`}>
              {selectedSpec.direction}
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-50 text-xs font-mono text-orange-700 font-semibold">EDI {selectedSpec.ediEquivalent}</span>
            <span className="px-2 py-0.5 rounded bg-secondary text-xs text-muted-foreground">{selectedSpec.version}</span>
          </div>
          <p className="text-muted-foreground mt-1">{selectedSpec.name}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{selectedSpec.description}</p>

      {/* Endpoint */}
      <Card className="p-4 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Endpoint</p>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded font-mono font-bold text-sm ${
            selectedSpec.endpoint.method === "POST" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
          }`}>
            {selectedSpec.endpoint.method}
          </span>
          <code className="font-mono text-foreground text-sm">https://api.unis-edi.com{selectedSpec.endpoint.path}</code>
        </div>
      </Card>

      {/* Headers */}
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Request Headers</p>
        <div className="space-y-2">
          {selectedSpec.headers.map((h, i) => (
            <div key={i} className="flex items-start gap-4 text-sm">
              <code className="font-mono font-medium text-foreground min-w-[160px]">{h.name}</code>
              <code className="font-mono text-muted-foreground min-w-[200px]">{h.value}</code>
              <span className="text-muted-foreground">{h.description}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="px-4 py-2 rounded-lg bg-muted/30 text-sm">
          <span className="text-muted-foreground">Total Fields: </span>
          <span className="font-semibold text-foreground">{totalFields}</span>
        </div>
        <div className="px-4 py-2 rounded-lg bg-red-50 text-sm">
          <span className="text-red-700">Required: </span>
          <span className="font-semibold text-red-700">{requiredFields}</span>
        </div>
        <div className="px-4 py-2 rounded-lg bg-muted/30 text-sm">
          <span className="text-muted-foreground">Optional: </span>
          <span className="font-semibold text-foreground">{totalFields - requiredFields}</span>
        </div>
        <div className="px-4 py-2 rounded-lg bg-orange-50 text-sm">
          <span className="text-orange-700">X12 Mapped: </span>
          <span className="font-semibold text-orange-700">{x12MappedCount}/{totalFields}</span>
        </div>
      </div>

      {/* Tabs: Schema / Sample / Response */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "schema" as const, label: "Request Schema" },
          { id: "sample" as const, label: "Sample Payload" },
          { id: "response" as const, label: "Response Example" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveDocTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeDocTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Schema Table */}
      {activeDocTab === "schema" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Field</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground w-24">Type</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-foreground w-24">Required</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-orange-700 w-48">X12 Mapping</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {selectedSpec.requestSchema.map((field, idx) => (
                  <FieldRow key={idx} field={field} depth={0} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sample Payload */}
      {activeDocTab === "sample" && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
            <span className="text-sm font-medium text-foreground">Request Body</span>
            <Button
              variant="outline"
              className="h-7 text-xs bg-transparent"
              onClick={() => navigator.clipboard.writeText(selectedSpec.samplePayload)}
            >
              Copy
            </Button>
          </div>
          <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto leading-relaxed bg-muted/20">
            {selectedSpec.samplePayload}
          </pre>
        </Card>
      )}

      {/* Response Example */}
      {activeDocTab === "response" && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
            <span className="text-sm font-medium text-foreground">200 OK - Success Response</span>
            <Button
              variant="outline"
              className="h-7 text-xs bg-transparent"
              onClick={() => navigator.clipboard.writeText(selectedSpec.responseExample)}
            >
              Copy
            </Button>
          </div>
          <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto leading-relaxed bg-muted/20">
            {selectedSpec.responseExample}
          </pre>
        </Card>
      )}
    </div>
  )
}
