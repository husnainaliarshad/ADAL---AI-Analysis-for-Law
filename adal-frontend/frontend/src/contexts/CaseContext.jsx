import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getCases, createCase, getCase } from '../api/caseApi'
import { setActiveCaseId } from '../api/chatApi'
import { setActiveCaseIdForFiles } from '../api/files'

const CaseContext = createContext(null)

export function CaseProvider({ children }) {
  const [caseId, setCaseId] = useState(null)
  const [cases, setCases] = useState([])
  const [caseContext, setCaseContext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ctxLoading, setCtxLoading] = useState(false)

  const loadCases = useCallback(async () => {
    setLoading(true)
    try { setCases(await getCases()) } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadCases() }, [loadCases])

  const selectCase = useCallback(async (id) => {
    setCaseId(id)
    setActiveCaseId(id)           // Chat routes to case agent
    setActiveCaseIdForFiles(id)    // Documents filter by case
    if (!id) {
      setCaseContext(null)
      return
    }
    setCtxLoading(true)
    try {
      const ctx = await getCase(id)
      setCaseContext(ctx)
    } catch (e) { console.error(e); setCaseContext(null) }
    setCtxLoading(false)
  }, [])

  const handleCreate = useCallback(async (form) => {
    const c = await createCase(form)
    setCases(prev => [c, ...prev])
    await selectCase(c.id)
    return c
  }, [selectCase])

  const activeDocumentIds = useMemo(() => {
    if (!caseContext?.documents) return null
    return new Set(caseContext.documents.map(d => d.id))
  }, [caseContext])

  return (
    <CaseContext.Provider value={{
      caseId, cases, caseContext, loading, ctxLoading, selectCase, loadCases, createCase: handleCreate, activeDocumentIds,
    }}>
      {children}
    </CaseContext.Provider>
  )
}

export function useCase() {
  const ctx = useContext(CaseContext)
  if (!ctx) throw new Error('useCase must be used within CaseProvider')
  return ctx
}
