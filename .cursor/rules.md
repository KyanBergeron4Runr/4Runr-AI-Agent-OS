# 🎯 **CURSOR CODER AGENT TASK CARD**

## **GOAL**: Verify presence of Shield, Sentinel, and ML loop without rebuilding.

## **🚨 CRITICAL RULES**:
- **DO NOT create new frameworks or heavy code**; only scan, list, and wire stubs if truly missing.
- **Prefer inventory and audit reports** over guessing.
- **If a component exists, link it in REUSE-MAP.md and stop**.
- **If missing, create a minimal stub** with the exact file paths:
  - `packages/shield/src/index.ts` (if Shield missing)
  - `packages/sentinel/src/index.ts` (if Sentinel missing)  
  - `packages/ml/src/{feedback.ts,trainer.ts,registry.ts}` (if ML missing)
- **Add tests only as placeholders**; mark TODOs clearly.
- **Update ARCHITECTURE/REUSE-MAP.md** with findings.

## **📋 REQUIRED OUTPUTS**:
- ✅ `artifacts/audit-os-scan.json` (already exists)
- ✅ `ARCHITECTURE/REUSE-MAP.md` (updated with findings)
- ✅ Commit titled: "chore(audit): scan + stubs (no rewrites)"

## **🔍 WHAT TO DO**:

### **1. SCAN EXISTING CODEBASE** (DONE ✅)
- Audit scan completed: `artifacts/audit-os-scan.json`
- Found: Shield, Sentinel, ML, Red-Team tests, Contracts, Validation, Idempotency

### **2. VERIFY IMPLEMENTATIONS** (DO THIS)
- Check if `src/sentinel/shield.ts` actually implements Shield
- Check if `src/sentinel/` actually implements Sentinel  
- Check if ML components are real or just references
- Run `npm run test:contracts` to verify tests work

### **3. CREATE STUBS ONLY IF MISSING** (IF NEEDED)
- **NEVER rewrite existing components**
- **ONLY create minimal stubs** for truly missing pieces
- **Use exact file paths** specified above

### **4. UPDATE DOCUMENTATION** (REQUIRED)
- Update `ARCHITECTURE/REUSE-MAP.md` with verification results
- Document what's real vs. what's just referenced

## **🚫 FORBIDDEN ACTIONS**:
- ❌ **Rebuilding** existing systems
- ❌ **Creating new frameworks** 
- ❌ **Replacing** existing validation/security
- ❌ **Duplicating** existing functionality

## **✅ ALLOWED ACTIONS**:
- ✅ **Verifying** existing implementations
- ✅ **Testing** existing functionality
- ✅ **Creating minimal stubs** for missing pieces
- ✅ **Documenting** what exists vs. what's missing
- ✅ **Wiring up** disconnected components

## **🎯 SUCCESS CRITERIA**:
- **Definitive yes/no** on whether Shield/Sentinel/ML already exist
- **JSON artifact** the team and agents can trust
- **Safe stubs** so downstream work can proceed without rework
- **No duplicated systems** and no accidental rewrites

## **📚 REFERENCE FILES**:
- `artifacts/audit-os-scan.json` - Complete scan results
- `ARCHITECTURE/REUSE-MAP.md` - Current component mapping
- `tests/contracts/` - Existing contract tests
- `src/sentinel/` - Sentinel implementation directory
- `packages/middleware/` - Validation and idempotency

## **🔒 REMEMBER**:
**You are an auditor, not a builder. Verify what exists, document what's missing, create minimal stubs if needed. NEVER rebuild working systems.**
