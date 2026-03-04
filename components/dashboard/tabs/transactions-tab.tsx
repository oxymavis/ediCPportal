"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import TransactionDetailModal from "../modals/transaction-detail-modal"

export default function TransactionsTab() {
  const [transactions] = useState([
    // 204 - Motor Carrier Load Tender
    {
      id: "TRX-204-001",
      type: "204",
      typeName: "Motor Carrier Load Tender",
      partner: "XPO Logistics",
      partnerId: "XPO001",
      status: "completed",
      date: "2024-01-20",
      time: "08:15:30",
      direction: "outbound",
      size: "3.2 KB",
      records: 156,
      controlNumber: "000001001",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "9876543210987",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*9876543210987  *240120*0815*U*00401*000001001*0*P*>~
GS*SM*1234567890*9876543210*20240120*081530*1*X*004010~
ST*204*0001~
B2**XPOL**123456789**PP~
B2A*00~
L11*PO-2024-001*PO~
L11*REF-789456*SI~
MS3*XPOL*B*M~
NTE**FRAGILE - HANDLE WITH CARE~
G62*64*20240125~
G62*10*20240127~
AT5*TL**25000*L~
PLD*1~
LX*1~
NTE*OTH*PICKUP INSTRUCTIONS: USE DOCK 5~
L11*ITEM-001*SK~
AT8*G*L*15000*500~
LAD*PLT*10***~
N1*SH*ABC Manufacturing*93*ABCMFG001~
N3*100 Industrial Park Drive~
N4*Chicago*IL*60601*US~
G61*SH*John Smith*TE*312-555-1234~
N1*CN*XYZ Distribution Center*93*XYZDC001~
N3*500 Warehouse Blvd~
N4*Los Angeles*CA*90001*US~
G61*DC*Jane Doe*TE*213-555-5678~
SE*26*0001~
GE*1*1~
IEA*1*000001001~`,
      logs: [
        { timestamp: "2024-01-20T08:15:30Z", level: "info", message: "Load tender document created" },
        { timestamp: "2024-01-20T08:15:31Z", level: "info", message: "Validating shipment details" },
        { timestamp: "2024-01-20T08:15:32Z", level: "info", message: "Carrier XPO Logistics assigned" },
        { timestamp: "2024-01-20T08:15:33Z", level: "success", message: "Document transmitted to carrier successfully" },
      ],
      errors: [],
    },
    // 210 - Freight Invoice
    {
      id: "TRX-210-001",
      type: "210",
      typeName: "Freight Invoice",
      partner: "FedEx Freight",
      partnerId: "FDX001",
      status: "completed",
      date: "2024-01-19",
      time: "14:22:45",
      direction: "inbound",
      size: "4.1 KB",
      records: 203,
      controlNumber: "000001002",
      senderQualifier: "01",
      senderId: "9012345678901",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*9012345678901  *01*1234567890123  *240119*1422*U*00401*000001002*0*P*>~
GS*IM*9012345678*1234567890*20240119*142245*2*X*004010~
ST*210*0001~
B3*INV-2024-001234**20240119*N*PP*FDX-PRO-789**20240119~
B3A*11~
N9*BM*BOL-2024-0456~
N9*PO*PO-2024-001~
G62*86*20240115~
N1*BT*ABC Company Inc*93*ABCCOMP~
N3*100 Main Street~
N4*New York*NY*10001*US~
N1*SH*Origin Warehouse*93*ORIGWH~
N3*200 Shipping Lane~
N4*Newark*NJ*07101*US~
N1*CN*Destination Center*93*DESTCTR~
N3*300 Receiving Road~
N4*Philadelphia*PA*19101*US~
LX*1~
L5*1*ELECTRONICS**UN*16~
L0*1*15000*FR*8500*G*50*B***~
L1*1**2500.00*FR*****M1000*1500.00~
L1*1**150.00*FSC*****FUEL~
L1*1**75.00*MIN*****HANDLING~
L3*25000*G*2725.00*FR*****~
SE*23*0001~
GE*1*2~
IEA*1*000001002~`,
      logs: [
        { timestamp: "2024-01-19T14:22:45Z", level: "info", message: "Freight invoice received from FedEx" },
        { timestamp: "2024-01-19T14:22:46Z", level: "info", message: "Parsing invoice details" },
        { timestamp: "2024-01-19T14:22:47Z", level: "info", message: "Matching to original shipment BOL-2024-0456" },
        { timestamp: "2024-01-19T14:22:48Z", level: "success", message: "Invoice validated and posted to AP" },
      ],
      errors: [],
    },
    // 214 - Shipment Status
    {
      id: "TRX-214-001",
      type: "214",
      typeName: "Shipment Status",
      partner: "UPS",
      partnerId: "UPS001",
      status: "completed",
      date: "2024-01-18",
      time: "16:45:12",
      direction: "inbound",
      size: "1.8 KB",
      records: 78,
      controlNumber: "000001003",
      senderQualifier: "01",
      senderId: "8765432109876",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*8765432109876  *01*1234567890123  *240118*1645*U*00401*000001003*0*P*>~
GS*QM*8765432109*1234567890*20240118*164512*3*X*004010~
ST*214*0001~
B10*1Z999AA10123456784*PO-2024-002*UPS001~
L11*REF-456789*SI~
MS3*UPS*M*LT~
LX*1~
AT7*X6*NS***20240118*1230*LT~
MS1*Chicago*IL*US~
AT8*G*L*25*1~
LX*2~
AT7*AF*NS***20240118*1630*LT~
MS1*Indianapolis*IN*US~
AT8*G*L*25*1~
SE*14*0001~
GE*1*3~
IEA*1*000001003~`,
      logs: [
        { timestamp: "2024-01-18T16:45:12Z", level: "info", message: "Status update received from UPS" },
        { timestamp: "2024-01-18T16:45:13Z", level: "info", message: "Package 1Z999AA10123456784 - In transit" },
        { timestamp: "2024-01-18T16:45:14Z", level: "success", message: "Tracking status updated" },
      ],
      errors: [],
    },
    // 810 - Invoice
    {
      id: "TRX-810-001",
      type: "810",
      typeName: "Invoice",
      partner: "Walmart",
      partnerId: "WMT001",
      status: "completed",
      date: "2024-01-17",
      time: "10:30:22",
      direction: "outbound",
      size: "5.6 KB",
      records: 285,
      controlNumber: "000001004",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "5678901234567",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*5678901234567  *240117*1030*U*00401*000001004*0*P*>~
GS*IN*1234567890*5678901234*20240117*103022*4*X*004010~
ST*810*0001~
BIG*20240117*INV-2024-5678*20240110*PO-WMT-2024-001~
NTE*GEN*Payment due within 30 days~
REF*VR*VENDOR-ABC-123~
REF*DP*001~
N1*ST*Walmart Store #1234*92*1234~
N3*100 Retail Drive~
N4*Bentonville*AR*72712*US~
N1*BT*Walmart Accounts Payable*92*AP001~
N3*702 SW 8th Street~
N4*Bentonville*AR*72716*US~
N1*VN*ABC Supplier Inc*93*ABCSUPP~
N3*500 Vendor Lane~
N4*Dallas*TX*75201*US~
ITD*01*3*2**30*****NET 30~
IT1*1*100*EA*25.99**UP*012345678901*VN*SKU-001~
PID*F****Widget A - Blue~
IT1*2*50*EA*49.99**UP*012345678902*VN*SKU-002~
PID*F****Widget B - Red~
IT1*3*200*EA*12.50**UP*012345678903*VN*SKU-003~
PID*F****Widget C - Green~
TDS*749850~
CAD*M****PREPAID~
CTT*3~
SE*25*0001~
GE*1*4~
IEA*1*000001004~`,
      logs: [
        { timestamp: "2024-01-17T10:30:22Z", level: "info", message: "Invoice document generated" },
        { timestamp: "2024-01-17T10:30:23Z", level: "info", message: "Calculating totals: $7,498.50" },
        { timestamp: "2024-01-17T10:30:24Z", level: "info", message: "Transmitting to Walmart EDI gateway" },
        { timestamp: "2024-01-17T10:30:25Z", level: "success", message: "Invoice accepted by trading partner" },
      ],
      errors: [],
    },
    // 832 - Price/Sales Catalog
    {
      id: "TRX-832-001",
      type: "832",
      typeName: "Price/Sales Catalog",
      partner: "Amazon",
      partnerId: "AMZ001",
      status: "completed",
      date: "2024-01-16",
      time: "09:15:00",
      direction: "outbound",
      size: "12.3 KB",
      records: 567,
      controlNumber: "000001005",
      senderQualifier: "ZZ",
      senderId: "MYCOMPANY",
      receiverQualifier: "ZZ",
      receiverId: "AMAZON",
      raw: `ISA*00*          *00*          *ZZ*MYCOMPANY      *ZZ*AMAZON         *240116*0915*U*00401*000001005*0*P*>~
GS*SC*MYCOMPANY*AMAZON*20240116*091500*5*X*004010~
ST*832*0001~
BCT*PC*CATALOG-2024-Q1**20240116*20240401~
REF*CT*ELECTRONICS~
N1*SE*ABC Electronics Inc*93*ABCELEC~
N1*BY*Amazon Vendor Central*92*AMZVC~
LIN**UP*012345678901*VN*ELEC-001~
G53*A~
PID*F****Wireless Bluetooth Headphones~
PID*F*08***Premium noise-cancelling wireless headphones~
CTP*RS*RES*79.99*1*EA~
CTP*WS*WHL*45.00*1*EA~
G39***100*EA~
LIN**UP*012345678902*VN*ELEC-002~
G53*A~
PID*F****USB-C Charging Cable 6ft~
PID*F*08***Fast charging USB-C to USB-C cable~
CTP*RS*RES*19.99*1*EA~
CTP*WS*WHL*8.50*1*EA~
G39***500*EA~
LIN**UP*012345678903*VN*ELEC-003~
G53*A~
PID*F****Portable Power Bank 20000mAh~
PID*F*08***High capacity portable charger~
CTP*RS*RES*49.99*1*EA~
CTP*WS*WHL*22.00*1*EA~
G39***250*EA~
CTT*3~
SE*30*0001~
GE*1*5~
IEA*1*000001005~`,
      logs: [
        { timestamp: "2024-01-16T09:15:00Z", level: "info", message: "Product catalog export initiated" },
        { timestamp: "2024-01-16T09:15:02Z", level: "info", message: "Processing 3 product entries" },
        { timestamp: "2024-01-16T09:15:03Z", level: "success", message: "Catalog transmitted to Amazon Vendor Central" },
      ],
      errors: [],
    },
    // 846 - Inventory Inquiry/Advice
    {
      id: "TRX-846-001",
      type: "846",
      typeName: "Inventory Inquiry/Advice",
      partner: "Target",
      partnerId: "TGT001",
      status: "completed",
      date: "2024-01-15",
      time: "07:00:00",
      direction: "outbound",
      size: "8.7 KB",
      records: 412,
      controlNumber: "000001006",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "4567890123456",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*4567890123456  *240115*0700*U*00401*000001006*0*P*>~
GS*IB*1234567890*4567890123*20240115*070000*6*X*004010~
ST*846*0001~
BIA*00*SI*INV-RPT-20240115*20240115~
N1*WH*Main Distribution Center*93*DC001~
N3*1000 Logistics Parkway~
N4*Memphis*TN*38118*US~
N1*SU*ABC Supplier*93*ABCSUP~
LIN*1*UP*012345678901*VN*PROD-001~
PID*F****Winter Jacket - Large - Navy~
QTY*33*500*EA~
QTY*QH*450*EA~
QTY*QO*50*EA~
REF*LT*LOT-2024-001~
DTM*036*20240115~
LIN*2*UP*012345678902*VN*PROD-002~
PID*F****Winter Jacket - Medium - Navy~
QTY*33*350*EA~
QTY*QH*320*EA~
QTY*QO*30*EA~
REF*LT*LOT-2024-002~
DTM*036*20240115~
LIN*3*UP*012345678903*VN*PROD-003~
PID*F****Winter Jacket - Small - Navy~
QTY*33*200*EA~
QTY*QH*200*EA~
QTY*QO*0*EA~
REF*LT*LOT-2024-003~
DTM*036*20240115~
CTT*3*1050~
SE*30*0001~
GE*1*6~
IEA*1*000001006~`,
      logs: [
        { timestamp: "2024-01-15T07:00:00Z", level: "info", message: "Daily inventory report generated" },
        { timestamp: "2024-01-15T07:00:02Z", level: "info", message: "Reporting 1,050 units across 3 SKUs" },
        { timestamp: "2024-01-15T07:00:03Z", level: "success", message: "Inventory advice sent to Target" },
      ],
      errors: [],
    },
    // 850 - Purchase Order
    {
      id: "TRX-850-001",
      type: "850",
      typeName: "Purchase Order",
      partner: "Costco",
      partnerId: "COS001",
      status: "completed",
      date: "2024-01-14",
      time: "11:20:33",
      direction: "inbound",
      size: "6.2 KB",
      records: 298,
      controlNumber: "000001007",
      senderQualifier: "01",
      senderId: "3456789012345",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*3456789012345  *01*1234567890123  *240114*1120*U*00401*000001007*0*P*>~
GS*PO*3456789012345*1234567890*20240114*112033*7*X*004010~
ST*850*0001~
BEG*00*SA*PO-COS-2024-0789**20240114~
REF*DP*001~
REF*IA*ACCT-789456~
PER*BD*John Buyer*TE*425-555-1234*EM*jbuyer@costco.com~
FOB*PP***OR*ORIGIN~
ITD*01*3*2**30**30*****NET 30~
DTM*002*20240128~
DTM*063*20240201~
N1*ST*Costco Warehouse #123*92*WH123~
N3*1001 Warehouse Blvd~
N4*Seattle*WA*98101*US~
N1*BT*Costco Wholesale Corp*92*COSWHL~
N3*999 Lake Drive~
N4*Issaquah*WA*98027*US~
PO1*1*1000*EA*15.99*PE*UP*012345678901*VN*GADGET-A~
PID*F****Electronic Gadget Model A~
PO1*2*500*EA*29.99*PE*UP*012345678902*VN*GADGET-B~
PID*F****Electronic Gadget Model B~
PO1*3*2000*EA*7.50*PE*UP*012345678903*VN*ACCESS-C~
PID*F****Accessory Pack C~
CTT*3~
AMT*TT*45985.00~
SE*25*0001~
GE*1*7~
IEA*1*000001007~`,
      logs: [
        { timestamp: "2024-01-14T11:20:33Z", level: "info", message: "Purchase order received from Costco" },
        { timestamp: "2024-01-14T11:20:34Z", level: "info", message: "Order total: $45,985.00" },
        { timestamp: "2024-01-14T11:20:35Z", level: "info", message: "Checking inventory availability" },
        { timestamp: "2024-01-14T11:20:36Z", level: "success", message: "Order accepted and queued for fulfillment" },
      ],
      errors: [],
    },
    // 855 - Purchase Order Acknowledgment
    {
      id: "TRX-855-001",
      type: "855",
      typeName: "Purchase Order Ack",
      partner: "Costco",
      partnerId: "COS001",
      status: "completed",
      date: "2024-01-14",
      time: "12:05:18",
      direction: "outbound",
      size: "4.8 KB",
      records: 215,
      controlNumber: "000001008",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "3456789012345",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*3456789012345  *240114*1205*U*00401*000001008*0*P*>~
GS*PR*1234567890*3456789012345*20240114*120518*8*X*004010~
ST*855*0001~
BAK*00*AC*PO-COS-2024-0789*20240114****20240128~
REF*VR*VENDOR-ABC~
N1*ST*Costco Warehouse #123*92*WH123~
N1*VN*ABC Company*93*ABCCOMP~
PO1*1*1000*EA*15.99*PE*UP*012345678901*VN*GADGET-A~
PID*F****Electronic Gadget Model A~
ACK*IA*1000*EA*068*20240128~
PO1*2*500*EA*29.99*PE*UP*012345678902*VN*GADGET-B~
PID*F****Electronic Gadget Model B~
ACK*IA*500*EA*068*20240128~
PO1*3*2000*EA*7.50*PE*UP*012345678903*VN*ACCESS-C~
PID*F****Accessory Pack C~
ACK*IB*1500*EA*068*20240128~
ACK*IR*500*EA*068*20240205*ZZ*BACKORDER~
CTT*3~
SE*19*0001~
GE*1*8~
IEA*1*000001008~`,
      logs: [
        { timestamp: "2024-01-14T12:05:18Z", level: "info", message: "Generating PO acknowledgment" },
        { timestamp: "2024-01-14T12:05:19Z", level: "info", message: "Line 1: 1000 units accepted" },
        { timestamp: "2024-01-14T12:05:19Z", level: "info", message: "Line 2: 500 units accepted" },
        { timestamp: "2024-01-14T12:05:19Z", level: "warning", message: "Line 3: 500 units on backorder" },
        { timestamp: "2024-01-14T12:05:20Z", level: "success", message: "POA transmitted to Costco" },
      ],
      errors: [],
    },
    // 856 - Advance Ship Notice
    {
      id: "TRX-856-001",
      type: "856",
      typeName: "Advance Ship Notice",
      partner: "Home Depot",
      partnerId: "HD001",
      status: "completed",
      date: "2024-01-13",
      time: "15:45:22",
      direction: "outbound",
      size: "7.4 KB",
      records: 342,
      controlNumber: "000001009",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "6789012345678",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*6789012345678  *240113*1545*U*00401*000001009*0*P*>~
GS*SH*1234567890*6789012345*20240113*154522*9*X*004010~
ST*856*0001~
BSN*00*SHIPMENT-2024-001*20240113*1545*0001~
DTM*011*20240113~
DTM*017*20240115~
HL*1**S~
TD1*PLT*15~
TD5*B*2*FEDX*M~
TD3*TL**TRAILER-123~
REF*BM*BOL-2024-001~
REF*CN*PRO-FEDX-789~
N1*SF*ABC Warehouse*93*ABCWH~
N3*100 Shipping Lane~
N4*Atlanta*GA*30301*US~
N1*ST*Home Depot Store #456*92*HD456~
N3*200 Retail Road~
N4*Charlotte*NC*28201*US~
HL*2*1*O~
PRF*PO-HD-2024-0456~
HL*3*2*P~
MAN*GM*00012345678900000001~
HL*4*3*I~
LIN**UP*012345678901*VN*TOOL-001~
SN1**50*EA~
PID*F****Power Drill 18V~
HL*5*3*I~
LIN**UP*012345678902*VN*TOOL-002~
SN1**100*EA~
PID*F****Drill Bit Set 50pc~
CTT*5*150~
SE*32*0001~
GE*1*9~
IEA*1*000001009~`,
      logs: [
        { timestamp: "2024-01-13T15:45:22Z", level: "info", message: "ASN generated for shipment SHIPMENT-2024-001" },
        { timestamp: "2024-01-13T15:45:23Z", level: "info", message: "15 pallets, 150 units total" },
        { timestamp: "2024-01-13T15:45:24Z", level: "info", message: "Carrier: FedEx, PRO: PRO-FEDX-789" },
        { timestamp: "2024-01-13T15:45:25Z", level: "success", message: "ASN transmitted to Home Depot" },
      ],
      errors: [],
    },
    // 940 - Warehouse Shipping Order
    {
      id: "TRX-940-001",
      type: "940",
      typeName: "Warehouse Shipping Order",
      partner: "SPS Commerce",
      partnerId: "SPS001",
      status: "completed",
      date: "2024-01-12",
      time: "14:30:22",
      direction: "inbound",
      size: "2.4 KB",
      records: 145,
      controlNumber: "000001010",
      senderQualifier: "01",
      senderId: "9012345678901",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*9012345678901  *01*1234567890123  *240112*1430*U*00401*000001010*0*P*>~
GS*OW*9012345678*1234567890*20240112*143022*10*X*004010~
ST*940*0001~
W05*N*123456*SPS001*WAREHOUSE-A~
N1*WH*Main Warehouse*93*WH001~
N3*500 Storage Drive~
N4*Dallas*TX*75201*US~
N1*SF*ABC Company*93*ABCCO~
N3*100 Corporate Blvd~
N4*Houston*TX*77001*US~
N1*ST*Customer XYZ*93*CUSTXYZ~
N3*200 Delivery Lane~
N4*Austin*TX*78701*US~
G62*10*20240115~
NTE*GEN*Rush order - ship priority~
LX*1~
W01*100*EA*VN*ITEM-001*UP*012345678901~
N9*LI*LINE-001~
G69*Blue Widget Premium~
LX*2~
W01*50*EA*VN*ITEM-002*UP*012345678902~
N9*LI*LINE-002~
G69*Red Widget Standard~
W76*2*150~
SE*24*0001~
GE*1*10~
IEA*1*000001010~`,
      logs: [
        { timestamp: "2024-01-12T14:30:22Z", level: "info", message: "Shipping order received from SPS Commerce" },
        { timestamp: "2024-01-12T14:30:23Z", level: "info", message: "Order contains 2 line items, 150 units" },
        { timestamp: "2024-01-12T14:30:24Z", level: "info", message: "Warehouse WH001 assigned" },
        { timestamp: "2024-01-12T14:30:25Z", level: "success", message: "Order queued for warehouse processing" },
      ],
      errors: [],
    },
    // 943 - Warehouse Stock Transfer Shipment Advice
    {
      id: "TRX-943-001",
      type: "943",
      typeName: "Warehouse Stock Transfer",
      partner: "SPS Commerce",
      partnerId: "SPS001",
      status: "completed",
      date: "2024-01-11",
      time: "08:20:15",
      direction: "outbound",
      size: "1.5 KB",
      records: 67,
      controlNumber: "000001011",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "9012345678901",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*9012345678901  *240111*0820*U*00401*000001011*0*P*>~
GS*SW*1234567890*9012345678*20240111*082015*11*X*004010~
ST*943*0001~
W06*X*TRANSFER-001*20240111*123456~
N1*WH*Source Warehouse*93*WH001~
N3*500 Storage Drive~
N4*Dallas*TX*75201*US~
N1*DE*Destination Warehouse*93*WH002~
N3*600 Logistics Ave~
N4*Phoenix*AZ*85001*US~
W27*K*BOL-TRANS-001*TRUCK-456~
LX*1~
W12*CC*200*EA*VN*ITEM-001~
N9*LT*LOT-2024-A1~
LX*2~
W12*CC*100*EA*VN*ITEM-002~
N9*LT*LOT-2024-B1~
W14*2~
SE*18*0001~
GE*1*11~
IEA*1*000001011~`,
      logs: [
        { timestamp: "2024-01-11T08:20:15Z", level: "info", message: "Stock transfer shipment advice created" },
        { timestamp: "2024-01-11T08:20:16Z", level: "info", message: "Transfer from WH001 to WH002" },
        { timestamp: "2024-01-11T08:20:17Z", level: "success", message: "Advice transmitted to SPS Commerce" },
      ],
      errors: [],
    },
    // 944 - Warehouse Stock Transfer Receipt Advice
    {
      id: "TRX-944-001",
      type: "944",
      typeName: "Warehouse Stock Receipt",
      partner: "Target",
      partnerId: "TGT001",
      status: "error",
      date: "2024-01-10",
      time: "09:22:10",
      direction: "inbound",
      size: "3.1 KB",
      records: 234,
      controlNumber: "000001012",
      senderQualifier: "01",
      senderId: "5678901234567",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*5678901234567  *01*1234567890123  *240110*0922*U*00401*000001012*0*P*>~
GS*SR*5678901234*1234567890*20240110*092210*12*X*004010~
ST*944*0001~
W17*X*RECEIPT-001*20240110*456789~
N1*WH*Receiving Warehouse*93*WH002~
N3*600 Logistics Ave~
N4*Phoenix*AZ*85001*US~
N1*SF*Origin Warehouse*93*WH001~
W08*X*BOL-TRANS-001~
LX*1~
W07*200*EA*VN*ITEM-001~
N9*LT*LOT-2024-A1~
W20*NC*200~
LX*2~
W07*95*EA*VN*ITEM-002~
N9*LT*LOT-2024-B1~
W20*NC*95~
W20*DM*5~
SE*18*0001~
GE*1*12~
IEA*1*000001012~`,
      logs: [
        { timestamp: "2024-01-10T09:22:10Z", level: "info", message: "Receipt advice received from Target" },
        { timestamp: "2024-01-10T09:22:11Z", level: "warning", message: "Quantity discrepancy detected on line 2" },
        { timestamp: "2024-01-10T09:22:12Z", level: "error", message: "Validation failed: Expected 100 units, received 95" },
      ],
      errors: [
        { code: "EDI-QTY-001", severity: "error", segment: "W07", position: "14", message: "Quantity mismatch on item ITEM-002", details: "Expected 100 EA based on transfer document, received only 95 EA. 5 units marked as damaged (DM)." },
        { code: "EDI-VAL-002", severity: "warning", segment: "W20", position: "16", message: "Damaged goods reported", details: "5 units of ITEM-002 received in damaged condition. Review required before inventory adjustment." },
      ],
    },
    // 945 - Warehouse Shipping Advice
    {
      id: "TRX-945-001",
      type: "945",
      typeName: "Warehouse Shipping Advice",
      partner: "Walmart",
      partnerId: "WMT001",
      status: "processing",
      date: "2024-01-09",
      time: "10:15:45",
      direction: "outbound",
      size: "1.8 KB",
      records: 89,
      controlNumber: "000001013",
      senderQualifier: "01",
      senderId: "1234567890123",
      receiverQualifier: "01",
      receiverId: "9876543210987",
      raw: `ISA*00*          *00*          *01*1234567890123  *01*9876543210987  *240109*1015*U*00401*000001013*0*P*>~
GS*SW*1234567890*9876543210*20240109*101545*13*X*004010~
ST*945*0001~
W06*N*SHIP-ADV-001*20240109*ORDER-12345~
N1*WH*Main Warehouse*93*WH001~
N3*500 Storage Drive~
N4*Dallas*TX*75201*US~
N1*DE*Walmart DC #789*92*WMTDC789~
N3*1000 Distribution Way~
N4*Bentonville*AR*72712*US~
W27*M*BOL-2024-0109*CARRIER-XYZ~
LX*1~
W12*CC*100*EA*VN*ITEM-001~
LX*2~
W12*CC*50*EA*VN*ITEM-002~
W14*2~
SE*16*0001~
GE*1*13~
IEA*1*000001013~`,
      logs: [
        { timestamp: "2024-01-09T10:15:45Z", level: "info", message: "Warehouse shipping advice created" },
        { timestamp: "2024-01-09T10:15:46Z", level: "info", message: "Processing shipment to Walmart DC" },
      ],
      errors: [],
    },
    // 947 - Warehouse Inventory Adjustment Advice
    {
      id: "TRX-947-001",
      type: "947",
      typeName: "Warehouse Inventory Adj",
      partner: "Amazon",
      partnerId: "AMZ001",
      status: "completed",
      date: "2024-01-08",
      time: "16:45:33",
      direction: "outbound",
      size: "2.9 KB",
      records: 178,
      controlNumber: "000001014",
      senderQualifier: "ZZ",
      senderId: "MYCOMPANY",
      receiverQualifier: "ZZ",
      receiverId: "AMAZON",
      raw: `ISA*00*          *00*          *ZZ*MYCOMPANY      *ZZ*AMAZON         *240108*1645*U*00401*000001014*0*P*>~
GS*IJ*MYCOMPANY*AMAZON*20240108*164533*14*X*004010~
ST*947*0001~
W15*A*ADJ-2024-001*20240108*CYCLE-COUNT~
N1*WH*FBA Warehouse*93*FBA001~
N3*1234 Fulfillment Drive~
N4*Seattle*WA*98101*US~
LX*1~
W19*1*10*EA*VN*FBA-SKU-001~
W20*PS*100~
W20*QA*110~
N9*LI*Count variance - found additional units~
LX*2~
W19*1*-5*EA*VN*FBA-SKU-002~
W20*PS*50~
W20*QA*45~
N9*LI*Count variance - damaged units removed~
LX*3~
W19*3*25*EA*VN*FBA-SKU-003~
W20*PS*200~
W20*QA*225~
N9*LI*Received unprocessed returns~
W14*3~
SE*22*0001~
GE*1*14~
IEA*1*000001014~`,
      logs: [
        { timestamp: "2024-01-08T16:45:33Z", level: "info", message: "Inventory adjustment advice generated" },
        { timestamp: "2024-01-08T16:45:34Z", level: "info", message: "3 SKUs adjusted after cycle count" },
        { timestamp: "2024-01-08T16:45:35Z", level: "success", message: "Adjustment advice transmitted to Amazon FBA" },
      ],
      errors: [],
    },
    // 997 - Functional Acknowledgment
    {
      id: "TRX-997-001",
      type: "997",
      typeName: "Functional Ack",
      partner: "SPS Commerce",
      partnerId: "SPS001",
      status: "completed",
      date: "2024-01-07",
      time: "12:00:05",
      direction: "inbound",
      size: "0.5 KB",
      records: 12,
      controlNumber: "000001015",
      senderQualifier: "01",
      senderId: "9012345678901",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*9012345678901  *01*1234567890123  *240107*1200*U*00401*000001015*0*P*>~
GS*FA*9012345678*1234567890*20240107*120005*15*X*004010~
ST*997*0001~
AK1*OW*10~
AK2*940*0001~
AK5*A~
AK9*A*1*1*1~
SE*6*0001~
GE*1*15~
IEA*1*000001015~`,
      logs: [
        { timestamp: "2024-01-07T12:00:05Z", level: "info", message: "Functional acknowledgment received" },
        { timestamp: "2024-01-07T12:00:06Z", level: "success", message: "940 document (GS 10) accepted by trading partner" },
      ],
      errors: [],
    },
    // API Integration - JSON Purchase Order
    {
      id: "TRX-API-001",
      type: "PO",
      typeName: "Purchase Order (API)",
      partner: "Amazon",
      partnerId: "AMZ001",
      status: "completed",
      date: "2024-01-21",
      time: "14:30:00",
      direction: "inbound",
      size: "1.2 KB",
      records: 1,
      controlNumber: "API-PO-20240121-001",
      senderQualifier: "API",
      senderId: "AMAZON-VC",
      receiverQualifier: "API",
      receiverId: "UNIS-API",
      integrationType: "api" as const,
      channel: "REST API",
      raw: `{
  "header": {
    "messageId": "API-PO-20240121-001",
    "messageType": "PurchaseOrder",
    "sender": "AMAZON-VC",
    "receiver": "UNIS-API",
    "timestamp": "2024-01-21T14:30:00Z"
  },
  "purchaseOrder": {
    "poNumber": "PO-AMZ-2024-5678",
    "orderDate": "2024-01-21",
    "shipTo": {
      "name": "Amazon FC - PHX6",
      "address": "4750 W Mohave St",
      "city": "Phoenix", "state": "AZ", "zip": "85043"
    },
    "lineItems": [
      { "line": 1, "sku": "SKU-001", "qty": 500, "unitPrice": 12.99 },
      { "line": 2, "sku": "SKU-002", "qty": 200, "unitPrice": 24.50 }
    ],
    "totalAmount": 11395.00
  }
}`,
      logs: [
        { timestamp: "2024-01-21T14:30:00Z", level: "info", message: "API purchase order received via REST endpoint" },
        { timestamp: "2024-01-21T14:30:01Z", level: "info", message: "JSON schema validation passed" },
        { timestamp: "2024-01-21T14:30:02Z", level: "success", message: "Order mapped and processed successfully" },
      ],
      errors: [],
    },
    // API Integration - JSON ASN
    {
      id: "TRX-API-002",
      type: "ASN",
      typeName: "Advance Ship Notice (API)",
      partner: "Costco Wholesale",
      partnerId: "COST001",
      status: "error",
      date: "2024-01-20",
      time: "09:45:15",
      direction: "outbound",
      size: "2.1 KB",
      records: 1,
      controlNumber: "API-ASN-20240120-001",
      senderQualifier: "API",
      senderId: "UNIS-API",
      receiverQualifier: "API",
      receiverId: "COSTCO-API",
      integrationType: "api" as const,
      channel: "REST API",
      raw: `{
  "header": {
    "messageId": "API-ASN-20240120-001",
    "messageType": "AdvanceShipNotice",
    "sender": "UNIS-API",
    "receiver": "COSTCO-API",
    "timestamp": "2024-01-20T09:45:15Z"
  },
  "shipNotice": {
    "shipmentId": "SHP-2024-0120",
    "shipDate": "2024-01-20",
    "carrier": "UPS",
    "trackingNumber": "1Z999AA10123456784",
    "items": [
      { "sku": "COST-SKU-100", "qty": 1000, "lotNumber": "LOT-2024-A" }
    ]
  }
}`,
      logs: [
        { timestamp: "2024-01-20T09:45:15Z", level: "info", message: "API ASN created for Costco" },
        { timestamp: "2024-01-20T09:45:16Z", level: "error", message: "API response: 422 Unprocessable Entity - missing required field 'destination.warehouseCode'" },
      ],
      errors: [
        { code: "API-VAL-001", severity: "error", segment: "shipNotice", position: "destination", message: "Missing required field: warehouseCode", details: "Costco API requires 'destination.warehouseCode' in ASN payload. Add the warehouse code and retry." },
      ],
    },
    // 997 - Functional Acknowledgment with Errors
    {
      id: "TRX-997-002",
      type: "997",
      typeName: "Functional Ack",
      partner: "Walmart",
      partnerId: "WMT001",
      status: "error",
      date: "2024-01-06",
      time: "09:30:15",
      direction: "inbound",
      size: "0.8 KB",
      records: 18,
      controlNumber: "000001016",
      senderQualifier: "01",
      senderId: "9876543210987",
      receiverQualifier: "01",
      receiverId: "1234567890123",
      raw: `ISA*00*          *00*          *01*9876543210987  *01*1234567890123  *240106*0930*U*00401*000001016*0*P*>~
GS*FA*9876543210*1234567890*20240106*093015*16*X*004010~
ST*997*0001~
AK1*IN*4~
AK2*810*0001~
AK3*IT1*15**8~
AK4*3*234*7*XY~
AK5*R*5~
AK9*R*1*1*0~
SE*9*0001~
GE*1*16~
IEA*1*000001016~`,
      logs: [
        { timestamp: "2024-01-06T09:30:15Z", level: "info", message: "Functional acknowledgment received" },
        { timestamp: "2024-01-06T09:30:16Z", level: "error", message: "810 document (GS 4) rejected by Walmart" },
        { timestamp: "2024-01-06T09:30:17Z", level: "error", message: "Error in IT1 segment at position 15: Invalid qualifier" },
      ],
      errors: [
        { code: "997-AK3-01", severity: "error", segment: "IT1", position: "15", message: "Segment syntax error", details: "The IT1 segment at position 15 contains a syntax error (error code 8). Element IT103 has an invalid data element." },
        { code: "997-AK4-01", severity: "error", segment: "IT1*3", position: "15", message: "Invalid code value", details: "Element IT103 value 'XY' is not a valid Unit of Measure code (error code 7). Expected codes: EA, CA, BX, etc." },
      ],
    },
  ])

  const [selectedTrx, setSelectedTrx] = useState<any>(null)
  
  // Filter states
  const [searchKeyword, setSearchKeyword] = useState("")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedDirection, setSelectedDirection] = useState<string>("all")
  const [selectedPartner, setSelectedPartner] = useState<string>("all")
  const [selectedIntegrationType, setSelectedIntegrationType] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const docTypes = [
    { code: "204", name: "Motor Carrier Load Tender" },
    { code: "210", name: "Freight Invoice" },
    { code: "214", name: "Shipment Status" },
    { code: "810", name: "Invoice" },
    { code: "832", name: "Price/Sales Catalog" },
    { code: "846", name: "Inventory Inquiry/Advice" },
    { code: "850", name: "Purchase Order" },
    { code: "855", name: "Purchase Order Ack" },
    { code: "856", name: "Advance Ship Notice" },
    { code: "940", name: "Warehouse Shipping Order" },
    { code: "943", name: "Warehouse Stock Transfer" },
    { code: "944", name: "Warehouse Stock Receipt" },
    { code: "945", name: "Warehouse Shipping Advice" },
    { code: "947", name: "Warehouse Inventory Adj" },
    { code: "997", name: "Functional Ack" },
    { code: "PO", name: "Purchase Order (API)" },
    { code: "ASN", name: "Advance Ship Notice (API)" },
    { code: "INV", name: "Invoice (API)" },
  ]
  const statusOptions = ["completed", "processing", "error", "pending"]
  const directionOptions = ["inbound", "outbound"]
  
  // Get unique partners
  const partners = useMemo(() => {
    const uniquePartners = [...new Set(transactions.map(t => t.partner))]
    return uniquePartners.sort()
  }, [transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(trx => {
      // Keyword search
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const matchesKeyword = 
          trx.id.toLowerCase().includes(keyword) ||
          trx.partner.toLowerCase().includes(keyword) ||
          trx.controlNumber.toLowerCase().includes(keyword) ||
          trx.senderId.toLowerCase().includes(keyword) ||
          trx.receiverId.toLowerCase().includes(keyword) ||
          (trx.typeName && trx.typeName.toLowerCase().includes(keyword))
        if (!matchesKeyword) return false
      }
      
      // Document type filter
      if (selectedType !== "all" && trx.type !== selectedType) return false
      
      // Status filter
      if (selectedStatus !== "all" && trx.status !== selectedStatus) return false
      
      // Direction filter
      if (selectedDirection !== "all" && trx.direction !== selectedDirection) return false
      
      // Partner filter
      if (selectedPartner !== "all" && trx.partner !== selectedPartner) return false

      // Integration type filter
      const trxIntType = (trx as any).integrationType || "edi"
      if (selectedIntegrationType !== "all" && trxIntType !== selectedIntegrationType) return false
      
      // Date range filter
      if (dateFrom && trx.date < dateFrom) return false
      if (dateTo && trx.date > dateTo) return false
      
      return true
    })
  }, [transactions, searchKeyword, selectedType, selectedStatus, selectedDirection, selectedPartner, selectedIntegrationType, dateFrom, dateTo])

  const clearFilters = () => {
    setSearchKeyword("")
    setSelectedType("all")
    setSelectedStatus("all")
    setSelectedDirection("all")
    setSelectedPartner("all")
    setSelectedIntegrationType("all")
    setDateFrom("")
    setDateTo("")
  }

  const hasActiveFilters = searchKeyword || selectedType !== "all" || selectedStatus !== "all" || 
    selectedDirection !== "all" || selectedPartner !== "all" || selectedIntegrationType !== "all" || dateFrom || dateTo

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 text-green-700"
      case "processing":
        return "bg-blue-50 text-blue-700"
      case "error":
        return "bg-red-50 text-red-700"
      case "pending":
        return "bg-amber-50 text-amber-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const getDirectionBadge = (direction: string) => {
    return direction === "inbound" 
      ? "bg-cyan-50 text-cyan-700" 
      : "bg-purple-50 text-purple-700"
  }

  // Get doc type name
  const getDocTypeName = (code: string) => {
    const docType = docTypes.find(d => d.code === code)
    return docType ? docType.name : code
  }

  // Export to Excel function
  const exportToExcel = () => {
    // Create CSV content
    const headers = ["Transaction ID", "Document Type", "Type Name", "Partner", "Direction", "Status", "Date", "Time", "Size", "Records", "Control Number", "Sender ID", "Receiver ID"]
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(trx => [
        trx.id,
        trx.type,
        trx.typeName,
        trx.partner,
        trx.direction,
        trx.status,
        trx.date,
        trx.time,
        trx.size,
        trx.records,
        trx.controlNumber,
        trx.senderId,
        trx.receiverId
      ].map(field => `"${field}"`).join(","))
    ].join("\n")

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Transactions</h2>
          <p className="text-muted-foreground">View and manage EDI and API document transactions</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Integration Type Quick Toggle */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setSelectedIntegrationType("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "all"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedIntegrationType("edi")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "edi"
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EDI (AS2/SFTP)
            </button>
            <button
              onClick={() => setSelectedIntegrationType("api")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedIntegrationType === "api"
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              API (REST)
            </button>
          </div>
          <Button 
            variant="outline" 
            className="gap-2 bg-transparent"
            onClick={exportToExcel}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-muted/50 border border-border text-sm">
        <span className="text-muted-foreground">Showing <span className="font-semibold text-foreground">{filteredTransactions.length}</span> of {transactions.length} transactions</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">EDI: <span className="font-semibold text-blue-700">{transactions.filter(t => !(t as any).integrationType || (t as any).integrationType === "edi").length}</span></span>
        <span className="text-muted-foreground">API: <span className="font-semibold text-emerald-700">{transactions.filter(t => (t as any).integrationType === "api").length}</span></span>
      </div>

      {/* Search and Quick Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* First Row: Search and Quick Actions */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by Transaction ID, Partner, Control Number, Sender/Receiver ID..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="bg-transparent"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" className="bg-transparent" onClick={clearFilters}>
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Document Type Quick Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                selectedType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/10"
              }`}
            >
              All Types
            </button>
            {docTypes.map((type) => (
              <button
                key={type.code}
                onClick={() => setSelectedType(selectedType === type.code ? "all" : type.code)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                  selectedType === type.code
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                }`}
                title={type.name}
              >
                {type.code}
              </button>
            ))}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {statusOptions.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direction */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Direction</Label>
                  <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Directions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Directions</SelectItem>
                      {directionOptions.map(dir => (
                        <SelectItem key={dir} value={dir} className="capitalize">
                          {dir}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Partner */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Trading Partner</Label>
                  <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Partners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners.map(partner => (
                        <SelectItem key={partner} value={partner}>
                          {partner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No transactions found matching your criteria</p>
            {hasActiveFilters && (
              <Button 
                variant="link" 
                className="mt-2"
                onClick={clearFilters}
              >
                Clear filters to see all transactions
              </Button>
            )}
          </Card>
        ) : (
          filteredTransactions.map((trx) => (
            <Card
              key={trx.id}
              className="p-6 cursor-pointer border border-border hover:border-primary/50 hover:shadow-md transition-all"
              onClick={() => setSelectedTrx(trx)}
            >
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                    <p className="font-mono font-semibold text-foreground">{trx.id}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Document Type</p>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{trx.type}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        (trx as any).integrationType === "api"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {(trx as any).integrationType === "api" ? "API" : "EDI"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{getDocTypeName(trx.type)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Trading Partner</p>
                    <p className="font-medium text-foreground text-sm">{trx.partner}</p>
                    {(trx as any).channel && (
                      <p className="text-[10px] text-muted-foreground">{(trx as any).channel}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Direction</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${getDirectionBadge(trx.direction)}`}>
                      {trx.direction}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Size / Records</p>
                    <p className="font-medium text-foreground text-sm">
                      {trx.size} / {trx.records}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <span className={`px-3 py-1 rounded text-xs font-semibold capitalize ${getStatusColor(trx.status)}`}>
                      {trx.status}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground ml-4">→</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                <span>{trx.date} {trx.time}</span>
                <span>ICN: {trx.controlNumber}</span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : trx.status === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                  {trx.status === "completed" ? "Valid" : trx.status === "error" ? "Invalid" : "Validating"}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : "bg-amber-500"}`} />
                  {trx.status === "completed" ? "Delivered" : "Pending"}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${trx.status === "completed" ? "bg-green-500" : trx.status === "error" ? "bg-red-500" : "bg-slate-400"}`} />
                  {trx.status === "completed" ? "Accepted" : trx.status === "error" ? "Rejected" : "N/A"}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTrx && <TransactionDetailModal transaction={selectedTrx} onClose={() => setSelectedTrx(null)} />}
    </div>
  )
}
