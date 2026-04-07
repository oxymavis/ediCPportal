"use client"

function stripPemBlock(value: string): string | null {
  const match = value.match(/-----BEGIN [^-]+-----\s*([\s\S]*?)\s*-----END [^-]+-----/)
  if (!match) return null
  return match[1].replace(/\s+/g, "")
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function normalizeCertificateTextInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const pemBody = stripPemBlock(trimmed)
  if (pemBody) return pemBody
  return trimmed.replace(/\s+/g, "")
}

export async function deriveCertificateBase64(file: File | null, rawContent?: string): Promise<string | undefined> {
  const normalizedRaw = normalizeCertificateTextInput(rawContent || "")
  if (normalizedRaw) return normalizedRaw
  if (!file) return undefined

  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const decodedText = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const normalizedText = normalizeCertificateTextInput(decodedText)
    if (normalizedText) return normalizedText
  } catch {
    // Fall through to binary Base64 encoding.
  }

  return bytesToBase64(bytes)
}
