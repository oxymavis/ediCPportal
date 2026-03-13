// Constants for EDI Portal

export const EDI_DOCUMENT_TYPES = {
  "940": "Purchase Order",
  "943": "Warehouse Stock Transfer Receipt",
  "944": "Inventory Inquiry/Advice",
  "945": "Warehouse Shipping Advice",
  "950": "Purchase Order Change Request - Buyer Initiated",
  "997": "Functional Acknowledgement",
} as const

export const PROTOCOLS = [
  { id: "https", label: "HTTPS", description: "Secure HTTP Protocol" },
  { id: "as2", label: "AS2", description: "Applicability Statement 2" },
  { id: "sftp", label: "SFTP", description: "SSH File Transfer Protocol" },
  { id: "ftp", label: "FTP", description: "File Transfer Protocol" },
] as const

export const SYNC_FREQUENCIES = [
  "Continuous",
  "Real-time",
  "Hourly",
  "Daily",
  "Weekly",
  "Monthly",
  "On-demand",
] as const

export const NOTIFICATION_TYPES = {
  warning: { color: "orange", icon: "AlertCircle" },
  error: { color: "red", icon: "AlertCircle" },
  success: { color: "green", icon: "CheckCircle" },
  info: { color: "blue", icon: "Clock" },
} as const
