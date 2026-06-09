# EDI Validation Report

- Spec: `sample-spec.md`
- Spec ID: `7969dfa5ad56`
- Validator Build: `v1`
- Validator Type: `generated_spec`
- Validation Mode: `generated_spec`
- Total Findings: `4`

## Findings

### 1. Error - sample-spec-1
- Source: `generic`
- Segment: `BSN`
- Element: `-`
- 中文: 缺少必填段 BSN。
- English: Required segment BSN is missing.
- Raw Segment Line: `-`
- Raw Segment: `-`

### 2. Error - sample-spec-2
- Source: `generic`
- Segment: `BSN`
- Element: `BSN03`
- 中文: BSN03 缺失，无法校验 CCYYMMDD 格式。
- English: BSN03 is missing, so CCYYMMDD format cannot be validated.
- Raw Segment Line: `-`
- Raw Segment: `-`

### 3. Error - sample-spec-3
- Source: `generic`
- Segment: `DTM`
- Element: `DTM*011`
- 中文: 缺少必填限定段 DTM*011。
- English: Required qualified segment DTM*011 is missing.
- Raw Segment Line: `-`
- Raw Segment: `-`

### 4. Error - sample-spec-4
- Source: `generic`
- Segment: `LIN`
- Element: `LIN02`
- 中文: 缺少段 LIN，无法校验 LIN02 的取值。
- English: Segment LIN is missing, so LIN02 cannot be validated.
- Raw Segment Line: `-`
- Raw Segment: `-`
