// EDI X12 ↔ JSON conversion utilities

export interface NormalizedX12Document {
  documentType: string
  direction: "inbound" | "outbound"
  sender: string
  receiver: string
  date: string
  time: string
  controlNumber: string
  items: Array<{
    lineNum: number
    productId: string
    quantity: number
    unitPrice: number
  }>
  billToParty?: string
  shipToParty?: string
  [key: string]: any
}

export const ediConverter = {
  /**
   * Parse raw X12 EDI string to structured segments
   */
  parseX12(rawX12: string): string[][] {
    const segments = rawX12.split(/\r?\n/).filter((s) => s.trim())
    return segments.map((seg) => seg.split("|"))
  },

  /**
   * Convert X12 940 (Purchase Order) to normalized JSON
   */
  x12_940_to_json(segments: string[][]): NormalizedX12Document {
    const normalized: NormalizedX12Document = {
      documentType: "940",
      direction: "inbound",
      sender: "",
      receiver: "",
      date: "",
      time: "",
      controlNumber: "",
      items: [],
    }

    for (const segment of segments) {
      if (segment[0] === "ISA") {
        normalized.sender = segment[9]?.trim() || ""
        normalized.receiver = segment[7]?.trim() || ""
      } else if (segment[0] === "GS") {
        normalized.date = segment[4]?.trim() || ""
        normalized.time = segment[5]?.trim() || ""
      } else if (segment[0] === "ST") {
        normalized.controlNumber = segment[2]?.trim() || ""
      } else if (segment[0] === "DTM") {
        if (segment[1] === "017") {
          normalized.date = segment[2]?.substring(0, 8) || ""
          normalized.time = segment[2]?.substring(8) || ""
        }
      } else if (segment[0] === "NAD") {
        if (segment[1] === "BY") {
          normalized.billToParty = segment[3]?.trim() || ""
        } else if (segment[1] === "SU") {
          normalized.shipToParty = segment[3]?.trim() || ""
        }
      } else if (segment[0] === "LIN") {
        const lineNum = Number.parseInt(segment[1] || "0")
        const productId = segment[3]?.trim() || ""
        normalized.items.push({
          lineNum,
          productId,
          quantity: 0,
          unitPrice: 0,
        })
      } else if (segment[0] === "QTY" && normalized.items.length > 0) {
        normalized.items[normalized.items.length - 1].quantity = Number.parseFloat(segment[2] || "0")
      } else if (segment[0] === "PRI" && normalized.items.length > 0) {
        normalized.items[normalized.items.length - 1].unitPrice = Number.parseFloat(segment[3] || "0")
      }
    }

    return normalized
  },

  /**
   * Convert normalized JSON to X12 940 format
   */
  json_to_x12_940(data: NormalizedX12Document): string {
    const segments: string[] = []

    // ISA Segment (Interchange Control Header)
    segments.push(
      `ISA|00|          |00|          |01|${data.receiver.padEnd(15)}|01|${data.sender.padEnd(15)}|${new Date().toISOString().slice(0, 10).replace(/-/g, "")}|${new Date().toISOString().slice(11, 13)}${new Date().toISOString().slice(14, 16)}|^|00|${data.controlNumber.padStart(9, "0")}|0|P|:`,
    )

    // GS Segment (Functional Group Header)
    const date = data.date || new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const time = data.time || new Date().toISOString().slice(11, 19).replace(/:/g, "")
    segments.push(`GS|PO|${data.sender}|${data.receiver}|${date}|${time}|1|X|003050`)

    // ST Segment (Transaction Set Header)
    segments.push(`ST|940|${data.controlNumber}`)

    // BFR Segment (Beginning Forecast)
    segments.push("BFR|001|00")

    // DTM Segment (Date/Time)
    segments.push(`DTM|017|${date}|${time}`)

    // NAD Segments (Name and Address)
    if (data.billToParty) {
      segments.push(`NAD|BY|||${data.billToParty}|9`)
    }
    if (data.shipToParty) {
      segments.push(`NAD|SU|||${data.shipToParty}|9`)
    }

    // LIN/QTY/PRI Segments (Line Items)
    data.items.forEach((item) => {
      segments.push(`LIN|${item.lineNum}|VN|${item.productId}`)
      segments.push(`QTY|1|${item.quantity}`)
      segments.push(`PRI|AAA|${item.unitPrice.toFixed(2)}`)
    })

    // SE Segment (Transaction Set Trailer)
    segments.push(`SE|${segments.length + 1}|${data.controlNumber}`)

    // GE Segment (Functional Group Trailer)
    segments.push("GE|1|1")

    // IEA Segment (Interchange Control Trailer)
    segments.push(`IEA|1|${data.controlNumber}`)

    return segments.join("\n")
  },

  /**
   * Validate X12 document structure
   */
  validateX12(rawX12: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const segments = this.parseX12(rawX12)

    if (segments.length === 0) {
      errors.push("Empty EDI document")
      return { valid: false, errors }
    }

    const firstSeg = segments[0]?.[0]
    const lastSeg = segments[segments.length - 1]?.[0]

    if (firstSeg !== "ISA") {
      errors.push("Document must start with ISA segment")
    }

    if (lastSeg !== "IEA") {
      errors.push("Document must end with IEA segment")
    }

    // Check for required segments
    const hasGS = segments.some((seg) => seg[0] === "GS")
    const hasST = segments.some((seg) => seg[0] === "ST")
    const hasSE = segments.some((seg) => seg[0] === "SE")

    if (!hasGS) errors.push("Missing GS (Functional Group Header) segment")
    if (!hasST) errors.push("Missing ST (Transaction Set Header) segment")
    if (!hasSE) errors.push("Missing SE (Transaction Set Trailer) segment")

    return {
      valid: errors.length === 0,
      errors,
    }
  },
}
