"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface UNISCertificate {
  id: string
  name: string
  as2Id: string
  serialNumber: string
  type: "Encryption" | "Signing" | "Server" | "Root CA"
  algorithm: string
  keySize: string
  validFrom: string
  validTo: string
  fingerprint: string
}

interface UNISCertificatesSectionProps {
  environment: "production" | "sandbox"
}

export default function UNISCertificatesSection({ environment }: UNISCertificatesSectionProps) {
  const [searchType, setSearchType] = useState<"as2" | "sn">("as2")
  const [searchValue, setSearchValue] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])

  // UNIS certificates data
  const unisCertificates: UNISCertificate[] = useMemo(() => {
    if (environment === "production") {
      return [
        {
          id: "prod-as2-server",
          name: "UNIS AS2 Server Certificate",
          as2Id: "UNIS-PROD-AS2",
          serialNumber: "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00",
          type: "Server",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90",
        },
        {
          id: "prod-as2-encrypt",
          name: "UNIS AS2 Encryption Certificate",
          as2Id: "UNIS-PROD-AS2",
          serialNumber: "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
          type: "Encryption",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1",
        },
        {
          id: "prod-as2-sign",
          name: "UNIS AS2 Signing Certificate",
          as2Id: "UNIS-PROD-AS2",
          serialNumber: "12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0",
          type: "Signing",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2",
        },
        {
          id: "prod-sftp-server",
          name: "UNIS SFTP Server Certificate",
          as2Id: "UNIS-PROD-SFTP",
          serialNumber: "DE:AD:BE:EF:CA:FE:BA:BE:12:34:56:78:9A:BC:DE:F0",
          type: "Server",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3",
        },
        {
          id: "prod-api-server",
          name: "UNIS API Gateway Certificate",
          as2Id: "UNIS-PROD-API",
          serialNumber: "98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA",
          type: "Server",
          algorithm: "SHA384RSA",
          keySize: "4096",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4",
        },
        {
          id: "prod-root-ca",
          name: "UNIS Root CA Certificate",
          as2Id: "UNIS-PROD-CA",
          serialNumber: "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF",
          type: "Root CA",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2020-01-01",
          validTo: "2030-01-01",
          fingerprint: "F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5",
        },
        {
          id: "prod-backup-as2",
          name: "UNIS Backup AS2 Certificate",
          as2Id: "UNIS-PROD-AS2-BK",
          serialNumber: "FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10",
          type: "Encryption",
          algorithm: "SHA256RSA",
          keySize: "4096",
          validFrom: "2024-06-01",
          validTo: "2026-06-01",
          fingerprint: "07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6",
        },
      ]
    } else {
      return [
        {
          id: "sb-as2-server",
          name: "UNIS Sandbox AS2 Server Certificate",
          as2Id: "UNIS-SANDBOX-AS2",
          serialNumber: "SB:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF",
          type: "Server",
          algorithm: "SHA256RSA",
          keySize: "2048",
          validFrom: "2024-01-01",
          validTo: "2025-12-31",
          fingerprint: "SB:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F",
        },
        {
          id: "sb-as2-encrypt",
          name: "UNIS Sandbox AS2 Encryption Certificate",
          as2Id: "UNIS-SANDBOX-AS2",
          serialNumber: "SB:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88",
          type: "Encryption",
          algorithm: "SHA256RSA",
          keySize: "2048",
          validFrom: "2024-01-01",
          validTo: "2025-12-31",
          fingerprint: "SB:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90",
        },
        {
          id: "sb-as2-sign",
          name: "UNIS Sandbox AS2 Signing Certificate",
          as2Id: "UNIS-SANDBOX-AS2",
          serialNumber: "SB:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE",
          type: "Signing",
          algorithm: "SHA256RSA",
          keySize: "2048",
          validFrom: "2024-01-01",
          validTo: "2025-12-31",
          fingerprint: "SB:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1",
        },
        {
          id: "sb-api-server",
          name: "UNIS Sandbox API Gateway Certificate",
          as2Id: "UNIS-SANDBOX-API",
          serialNumber: "SB:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC",
          type: "Server",
          algorithm: "SHA256RSA",
          keySize: "2048",
          validFrom: "2024-01-01",
          validTo: "2025-12-31",
          fingerprint: "SB:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2",
        },
        {
          id: "sb-root-ca",
          name: "UNIS Sandbox Root CA Certificate",
          as2Id: "UNIS-SANDBOX-CA",
          serialNumber: "SB:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE",
          type: "Root CA",
          algorithm: "SHA256RSA",
          keySize: "2048",
          validFrom: "2024-01-01",
          validTo: "2026-01-01",
          fingerprint: "SB:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3",
        },
      ]
    }
  }, [environment])

  // Filter certificates based on search
  const filteredCertificates = useMemo(() => {
    if (!hasSearched || !searchValue.trim()) {
      return []
    }

    const searchLower = searchValue.toLowerCase().trim()
    return unisCertificates.filter(cert => {
      if (searchType === "as2") {
        return cert.as2Id.toLowerCase().includes(searchLower)
      } else {
        return cert.serialNumber.toLowerCase().includes(searchLower)
      }
    })
  }, [unisCertificates, searchValue, searchType, hasSearched])

  const handleSearch = () => {
    setHasSearched(true)
    setSelectedCerts([])
  }

  const handleClearSearch = () => {
    setSearchValue("")
    setHasSearched(false)
    setSelectedCerts([])
  }

  const toggleCertSelection = (certId: string) => {
    setSelectedCerts(prev => 
      prev.includes(certId) 
        ? prev.filter(id => id !== certId)
        : [...prev, certId]
    )
  }

  const selectAllResults = () => {
    if (selectedCerts.length === filteredCertificates.length) {
      setSelectedCerts([])
    } else {
      setSelectedCerts(filteredCertificates.map(c => c.id))
    }
  }

  const handleDownloadSelected = () => {
    const certsToDownload = filteredCertificates.filter(c => selectedCerts.includes(c.id))
    alert(`Downloading ${certsToDownload.length} certificate(s):\n${certsToDownload.map(c => c.name).join('\n')}`)
  }

  const handleDownloadSingle = (cert: UNISCertificate) => {
    alert(`Downloading: ${cert.name}\nAS2 ID: ${cert.as2Id}\nSN: ${cert.serialNumber}`)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Encryption":
        return "bg-blue-100 text-blue-700"
      case "Signing":
        return "bg-purple-100 text-purple-700"
      case "Server":
        return "bg-green-100 text-green-700"
      case "Root CA":
        return "bg-amber-100 text-amber-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <Card className={`p-5 border-2 ${
      environment === "production" 
        ? "bg-blue-50/50 border-blue-200" 
        : "bg-amber-50/50 border-amber-200"
    }`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">UNIS Certificates</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                environment === "production" 
                  ? "bg-green-100 text-green-700" 
                  : "bg-amber-100 text-amber-700"
              }`}>
                {environment.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Search and download UNIS public certificates for the <strong>{environment}</strong> environment
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-foreground">Search by:</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setSearchType("as2"); setHasSearched(false); setSearchValue(""); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  searchType === "as2"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                AS2 ID
              </button>
              <button
                onClick={() => { setSearchType("sn"); setHasSearched(false); setSearchValue(""); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  searchType === "sn"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Serial Number (SN)
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={searchType === "as2" 
                ? "Enter AS2 ID (e.g., UNIS-PROD-AS2, UNIS-SANDBOX-AS2)..." 
                : "Enter Serial Number (e.g., 11:22:33:44 or partial SN)..."
              }
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90">
              Search
            </Button>
            {hasSearched && (
              <Button variant="outline" onClick={handleClearSearch} className="bg-transparent">
                Clear
              </Button>
            )}
          </div>

          {/* Quick Search Hints */}
          {!hasSearched && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Quick search: </span>
              {environment === "production" ? (
                <>
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-PROD-AS2"); }}
                  >
                    UNIS-PROD-AS2
                  </button>
                  |
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-PROD-SFTP"); }}
                  >
                    UNIS-PROD-SFTP
                  </button>
                  |
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-PROD-API"); }}
                  >
                    UNIS-PROD-API
                  </button>
                  |
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-PROD-CA"); }}
                  >
                    UNIS-PROD-CA
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-SANDBOX-AS2"); }}
                  >
                    UNIS-SANDBOX-AS2
                  </button>
                  |
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-SANDBOX-API"); }}
                  >
                    UNIS-SANDBOX-API
                  </button>
                  |
                  <button 
                    className="text-primary hover:underline mx-1"
                    onClick={() => { setSearchType("as2"); setSearchValue("UNIS-SANDBOX-CA"); }}
                  >
                    UNIS-SANDBOX-CA
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{filteredCertificates.length}</span> certificate(s)
                {searchValue && (
                  <span> matching "{searchValue}"</span>
                )}
              </p>
              {filteredCertificates.length > 0 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={selectAllResults}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedCerts.length === filteredCertificates.length ? "Deselect All" : "Select All"}
                  </button>
                  {selectedCerts.length > 0 && (
                    <Button 
                      size="sm" 
                      onClick={handleDownloadSelected}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Download Selected ({selectedCerts.length})
                    </Button>
                  )}
                </div>
              )}
            </div>

            {filteredCertificates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No certificates found matching your search criteria.</p>
                <p className="text-sm mt-1">Try a different {searchType === "as2" ? "AS2 ID" : "Serial Number"}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCertificates.map((cert) => (
                  <div 
                    key={cert.id}
                    className={`p-4 bg-white rounded-lg border transition-colors ${
                      selectedCerts.includes(cert.id) ? "border-primary bg-primary/5" : "hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCerts.includes(cert.id)}
                        onChange={() => toggleCertSelection(cert.id)}
                        className="mt-1 w-4 h-4 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{cert.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(cert.type)}`}>
                            {cert.type}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">AS2 ID: </span>
                            <span className="font-mono text-xs text-foreground">{cert.as2Id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Algorithm: </span>
                            <span className="text-foreground">{cert.algorithm}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">SN: </span>
                            <span className="font-mono text-xs text-foreground">{cert.serialNumber}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valid: </span>
                            <span className="text-foreground">{cert.validFrom} to {cert.validTo}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Key Size: </span>
                            <span className="text-foreground">{cert.keySize} bits</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-transparent shrink-0"
                        onClick={() => handleDownloadSingle(cert)}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <p className="text-xs text-muted-foreground">
          Note: {environment === "production" ? "Production" : "Sandbox"} certificates should only be used in the corresponding environment. 
          Using incorrect certificates may cause connection failures.
        </p>
      </div>
    </Card>
  )
}
