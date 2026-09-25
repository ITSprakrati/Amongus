// Honest, human-readable marking-scheme parsing status.
// `parsing` is result_data.parsing from GET /documents/status/{id}, written by the backend
// after OCR (backend/services/marking_scheme_parser.py). Nothing here is inferred client-side.

export function describeParsing(parsing) {
  if (!parsing) return { tone: 'pending', text: 'Marking scheme: processing…' };
  if (parsing.status === 'PARSED') {
    const n = parsing.question_count;
    return {
      tone: 'ok',
      text: `Marking scheme: ${n} question${n === 1 ? '' : 's'} parsed` +
        (parsing.reused_existing ? ' (matching assessment re-activated)' : '')
    };
  }
  return {
    tone: 'unavailable',
    text: `Marking scheme: parsing unavailable, using provisioned assessment${parsing.reason ? ' — ' + parsing.reason : ''}`
  };
}

// Poll the document job until the backend has written result_data.parsing (or the job fails / times out).
export async function watchMarkingSchemeParsing(jobId, onUpdate, { intervalMs = 1500, timeoutMs = 90000 } = {}) {
  const started = Date.now();
  onUpdate(describeParsing(null));
  while (Date.now() - started < timeoutMs) {
    try {
      const st = await window.EvalOS.apiClient.getDocumentStatus(jobId);
      if (st.status === 'FAILED') {
        const d = { tone: 'unavailable', text: 'Marking scheme: processing failed, using provisioned assessment' };
        onUpdate(d);
        return d;
      }
      if (st.status === 'READY' && st.result_data?.parsing) {
        window.EvalOS.state.realSession = window.EvalOS.state.realSession || {};
        window.EvalOS.state.realSession.markingSchemeParsing = st.result_data.parsing;
        const d = describeParsing(st.result_data.parsing);
        onUpdate(d);
        return d;
      }
    } catch (e) {
      console.warn('Marking scheme status poll failed', e);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  const d = { tone: 'pending', text: 'Marking scheme: still processing (timed out waiting)' };
  onUpdate(d);
  return d;
}
