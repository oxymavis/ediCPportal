"use client"

interface IntegrationStep {
  id: number
  name: string
  shortName: string
  module: string
  status: "completed" | "active" | "blocked"
  completedAt?: string
  actionLabel?: string
  actionHint?: string
}

interface IntegrationLifecyclePipelineProps {
  steps: IntegrationStep[]
  currentStepId: number
  progress: number
  integrationType?: "api" | "edi"
  onNavigate?: (tab: string) => void
  onActionClick?: () => void
  variant?: "full" | "compact"
  partnerName?: string
}

const STEP_DEFINITIONS = [
  { id: 1, name: "Trading Partner Setup", shortName: "Partner", module: "partners" },
  { id: 2, name: "Connection Testing", shortName: "Connect", module: "connection-testing" },
  { id: 3, name: "Integration Validation", shortName: "Validate", module: "connection-testing" },
  { id: 4, name: "Go Live", shortName: "Live", module: "transactions" },
]
const TOTAL_LIFECYCLE_STEPS = STEP_DEFINITIONS.length

const ACTION_LABELS_EDI: Record<number, { label: string; hint: string }> = {
  1: { label: "Edit Partner Info", hint: "Complete partner profile and exchange specifications" },
  2: { label: "Test Connection", hint: "Verify connectivity and exchange sample messages" },
  3: { label: "View Test Results", hint: "Validate document mapping with test transactions" },
  4: { label: "Go Live", hint: "All tests passed, enable the live integration" },
}

const ACTION_LABELS_API: Record<number, { label: string; hint: string }> = {
  1: { label: "Edit Partner Info", hint: "Complete partner profile and API credentials" },
  2: { label: "Test API", hint: "Send test API request and validate response" },
  3: { label: "View Test Results", hint: "Validate message format with test payloads" },
  4: { label: "Go Live", hint: "All tests passed, enable the live integration" },
}

export function buildIntegrationSteps(
  currentStepId: number,
  completionDates?: Record<number, string>,
  integrationType: "api" | "edi" = "edi"
): IntegrationStep[] {
  const actionLabels = integrationType === "api" ? ACTION_LABELS_API : ACTION_LABELS_EDI

  return STEP_DEFINITIONS.map((def) => {
    let status: "completed" | "active" | "blocked" = "blocked"
    if (def.id < currentStepId) status = "completed"
    else if (def.id === currentStepId) status = "active"

    return {
      ...def,
      status,
      completedAt: completionDates?.[def.id],
      actionLabel: def.id === currentStepId ? actionLabels[def.id]?.label : undefined,
      actionHint: def.id === currentStepId ? actionLabels[def.id]?.hint : undefined,
    }
  })
}

export function getProgressFromStep(currentStepId: number): number {
  if (currentStepId >= TOTAL_LIFECYCLE_STEPS) return 100
  return Math.max(0, Math.round(((currentStepId - 1) / (TOTAL_LIFECYCLE_STEPS - 1)) * 100))
}

export function getStepLabel(stepId: number): string {
  if (stepId > TOTAL_LIFECYCLE_STEPS) return "Live"
  return STEP_DEFINITIONS.find(s => s.id === stepId)?.shortName || `Step ${stepId}`
}

export default function IntegrationLifecyclePipeline({
  steps,
  currentStepId,
  progress,
  integrationType,
  onNavigate,
  onActionClick,
  variant = "full",
  partnerName,
}: IntegrationLifecyclePipelineProps) {
  if (variant === "compact") {
    return <CompactPipeline steps={steps} currentStepId={currentStepId} progress={progress} />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Integration Lifecycle</h4>
          {partnerName && (
            <p className="text-xs text-muted-foreground">
              {partnerName}
              {integrationType && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  integrationType === "api" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                }`}>
                  {integrationType === "api" ? "API" : "EDI"}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <div className="w-24 bg-secondary rounded-full h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-foreground">{progress}%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`h-0.5 flex-1 ${
                    step.status === "completed" || step.status === "active"
                      ? "bg-primary"
                      : "bg-border"
                  }`} />
                )}
                <button
                  onClick={() => {
                    if (step.status !== "blocked" && step.module && onNavigate) {
                      onNavigate(step.module)
                    }
                  }}
                  disabled={step.status === "blocked"}
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    step.status === "completed"
                      ? "bg-primary text-primary-foreground"
                      : step.status === "active"
                        ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "bg-secondary text-muted-foreground"
                  } ${step.status !== "blocked" ? "cursor-pointer hover:scale-110" : "cursor-not-allowed"}`}
                >
                  {step.status === "completed" ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                  {step.status === "active" && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping opacity-50" />
                  )}
                </button>
                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 ${
                    step.status === "completed" ? "bg-primary" : "bg-border"
                  }`} />
                )}
              </div>

              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-medium leading-tight ${
                  step.status === "active"
                    ? "text-primary"
                    : step.status === "completed"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}>
                  {step.name}
                </p>
                {step.status === "completed" && step.completedAt && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.completedAt}</p>
                )}
                {step.status === "active" && step.actionHint && (
                  <p className="text-[10px] text-primary/70 mt-0.5 max-w-[120px] mx-auto">{step.actionHint}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Current step action CTA */}
      {steps.find(s => s.status === "active") && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{currentStepId}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Current: {steps.find(s => s.status === "active")?.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {steps.find(s => s.status === "active")?.actionHint}
            </p>
          </div>
          {steps.find(s => s.status === "active") && (
            <button
              onClick={() => {
                if (onActionClick) {
                  onActionClick()
                  return
                }
                const active = steps.find(s => s.status === "active")
                if (active?.module && onNavigate) {
                  onNavigate(active.module)
                }
              }}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors shrink-0"
            >
              {steps.find(s => s.status === "active")?.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function CompactPipeline({
  steps,
  currentStepId,
  progress,
}: {
  steps: IntegrationStep[]
  currentStepId: number
  progress: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {steps.map((step) => (
          <div
            key={step.id}
            title={`${step.name}${step.status === "active" ? " (current)" : ""}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              step.status === "completed"
                ? "bg-primary"
                : step.status === "active"
                  ? "bg-primary ring-1 ring-primary ring-offset-1 ring-offset-background"
                  : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="w-16 bg-secondary rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground w-7 text-right">{progress}%</span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        Step {currentStepId > TOTAL_LIFECYCLE_STEPS ? TOTAL_LIFECYCLE_STEPS : currentStepId}/{TOTAL_LIFECYCLE_STEPS}
      </span>
    </div>
  )
}

export type { IntegrationStep }
