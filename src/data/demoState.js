export const DEMO_STATE = {
  institution: {
    name: 'University Examination Council',
    code: 'UEC-2024',
    type: 'UNIVERSITY' // SCHOOL, UNIVERSITY, CERTIFICATION, INSTITUTIONAL, CUSTOM
  },
  assessment: {
    title: 'B.Sc. Mathematics & Spatial Vectors',
    code: 'BSC-MATH-IV-2024',
    paper: 'Paper IV',
    totalMarks: 100,
    totalQuestions: 10,
    sections: [
      { id: 'A', name: 'Section A — Short Answer', questions: [1,2,3,4], maxMarksPerQ: [5,5,5,5], totalMarks: 20 },
      { id: 'B', name: 'Section B — Problem Solving', questions: [5,6,7], maxMarksPerQ: [15,15,10], totalMarks: 40 },
      { id: 'C', name: 'Section C — Long Answer', questions: [8,9,10], maxMarksPerQ: [15,15,10], totalMarks: 40 }
    ],
    assessmentTypes: ['School Examination', 'University Examination', 'Certification', 'Institutional Assessment', 'Custom Assessment'],
    evaluationRules: {
      strictSequentialMarking: false,
      allowPartialMarks: true,
      minimumPassPercentage: 40,
      autoSubmitOnComplete: true,
      requireStepLevelMarks: true
    },
    moderationRules: {
      varianceThresholdPercent: 10,
      triggerOnTotalDiscrepancy: true,
      triggerOnUncheckedPages: true,
      autoResolveMinorVariances: false,
      requireHeadExaminerForMajorVariances: true
    },
    qualityThresholds: {
      aiConfidenceThreshold: 85.0,
      ocrClarityMinimum: 80.0,
      maximumReviewSignals: 2,
      anomalySeverityThreshold: 'MEDIUM'
    }
  },
  markingScheme: {
    // For each question, step-level criteria
    questions: {
      1: { title: 'Vector Addition & Properties', maxMarks: 5, steps: [
        { id: 'S1.1', description: 'Definition of vector addition', marks: 2 },
        { id: 'S1.2', description: 'Commutative property proof', marks: 2 },
        { id: 'S1.3', description: 'Associative property proof', marks: 1 }
      ] },
      2: { title: 'Dot Product Application', maxMarks: 5, steps: [
        { id: 'S2.1', description: 'Formula statement', marks: 1 },
        { id: 'S2.2', description: 'Angle calculation between vectors', marks: 3 },
        { id: 'S2.3', description: 'Final simplification', marks: 1 }
      ] },
      3: { title: 'Cross Product Computation', maxMarks: 5, steps: [
        { id: 'S3.1', description: 'Determinant setup', marks: 2 },
        { id: 'S3.2', description: 'Cofactor expansion', marks: 2 },
        { id: 'S3.3', description: 'Correct vector result', marks: 1 }
      ] },
      4: { title: 'Boundary Parameterization', maxMarks: 5, steps: [
        { id: 'S4.1', description: 'Theorem Statement', marks: 2 },
        { id: 'S4.2', description: 'Vector Null Identity Lemma 3.2', marks: 1 },
        { id: 'S4.3', description: 'Boundary Integration', marks: 1 },
        { id: 'S4.4', description: 'Final Simplification', marks: 1 }
      ] },
      5: { title: 'Gauss Divergence Theorem Proof', maxMarks: 15, steps: [
        { id: 'S5.1', description: 'Statement of Theorem', marks: 3 },
        { id: 'S5.2', description: 'Setup of Volume Integral', marks: 4 },
        { id: 'S5.3', description: 'Setup of Surface Integral', marks: 4 },
        { id: 'S5.4', description: 'Equivalence Proof Steps', marks: 4 }
      ] },
      6: { title: 'Surface Integral Evaluation', maxMarks: 15, steps: [
        { id: 'S6.1', description: 'Parametrization of Surface', marks: 5 },
        { id: 'S6.2', description: 'Normal Vector Calculation', marks: 5 },
        { id: 'S6.3', description: 'Integration Evaluation', marks: 5 }
      ] }, // THIS IS THE UNCHECKED QUESTION
      7: { title: 'Line Integral & Green\'s Theorem', maxMarks: 10, steps: [
        { id: 'S7.1', description: 'Identification of P and Q', marks: 2 },
        { id: 'S7.2', description: 'Partial Derivatives', marks: 4 },
        { id: 'S7.3', description: 'Double Integral Computation', marks: 4 }
      ] },
      8: { title: 'Stokes Theorem Application', maxMarks: 15, steps: [
        { id: 'S8.1', description: 'Curl of Vector Field', marks: 5 },
        { id: 'S8.2', description: 'Surface Normal and ds', marks: 5 },
        { id: 'S8.3', description: 'Evaluation of Flux', marks: 5 }
      ] },
      9: { title: 'Eigenvalue Problem', maxMarks: 15, steps: [
        { id: 'S9.1', description: 'Characteristic Equation', marks: 5 },
        { id: 'S9.2', description: 'Finding Eigenvalues', marks: 5 },
        { id: 'S9.3', description: 'Finding Eigenvectors', marks: 5 }
      ] },
      10: { title: 'Transformation Matrix', maxMarks: 10, steps: [
        { id: 'S10.1', description: 'Basis Vectors Identification', marks: 3 },
        { id: 'S10.2', description: 'Transformation Application', marks: 4 },
        { id: 'S10.3', description: 'Matrix Construction', marks: 3 }
      ] }
    }
  },
  candidates: [
    {
      id: 'ACAD-8839-A',
      name: 'Candidate A',
      scriptId: 'SCR-8839-A',
      totalLeaves: 12,
      aiCategory: 'HIGH_MATCH', // 82% of scripts
      evaluationState: 'IN_PROGRESS', // PENDING, IN_PROGRESS, CHECKED, VERIFIED, RESULT_READY
      marks: {
        // Per question awarded marks - these are what the examiner enters
        1: 5, 2: 4, 3: 5, 4: 4, // Section A = 18/20
        5: 13, 6: null, 7: 8, // Section B: Q6 is UNCHECKED! Q5+Q7=21, total should be 21 but recorded as 21
        8: 14, 9: 12, 10: 8 // Section C = 34/40. BUT recorded section total = 33 (DISCREPANCY!)
      },
      sectionTotals: {
        A: { recorded: 18, computed: 18, verified: true },
        B: { recorded: 21, computed: null, verified: false }, // null because Q6 not checked
        C: { recorded: 33, computed: 34, verified: false } // DISCREPANCY: 33 recorded but 34 computed
      },
      grandTotal: { recorded: 72, computed: null, verified: false },
      leaves: [
        { id: 'L01', questions: [1], status: 'CHECKED' },
        { id: 'L02', questions: [2], status: 'CHECKED' },
        { id: 'L03', questions: [3], status: 'CHECKED' },
        { id: 'L04', questions: [4], status: 'CHECKED' },
        { id: 'L05', questions: [5], status: 'CHECKED' },
        { id: 'L06', questions: [6], status: 'ALERT' }, // UNCHECKED!
        { id: 'L07', questions: [7], status: 'CHECKED' },
        { id: 'L08', questions: [8], status: 'PENDING' },
        { id: 'L09', questions: [], status: 'PENDING' },
        { id: 'L10', questions: [9], status: 'PENDING' },
        { id: 'L11', questions: [10], status: 'PENDING' },
        { id: 'L12', questions: [], status: 'PENDING' }
      ],
      anomalySignals: [
        { type: 'SCORING_PATTERN', description: 'Consistent high scoring across all sections - review signal', severity: 'LOW' }
      ]
    },
    {
      id: 'ACAD-8840-B',
      name: 'Candidate B',
      scriptId: 'SCR-8840-B',
      totalLeaves: 10,
      aiCategory: 'PARTIAL_MATCH',
      evaluationState: 'CHECKED',
      marks: {
        1: 3, 2: 3, 3: 2, 4: 2,
        5: 8, 6: 10, 7: 5,
        8: 10, 9: 7, 10: 5
      },
      sectionTotals: {
        A: { recorded: 10, computed: 10, verified: true },
        B: { recorded: 23, computed: 23, verified: true },
        C: { recorded: 22, computed: 22, verified: true }
      },
      grandTotal: { recorded: 55, computed: 55, verified: true },
      leaves: [
        { id: 'L01', questions: [1, 2], status: 'CHECKED' },
        { id: 'L02', questions: [3, 4], status: 'CHECKED' },
        { id: 'L03', questions: [5], status: 'CHECKED' },
        { id: 'L04', questions: [6], status: 'CHECKED' },
        { id: 'L05', questions: [7], status: 'CHECKED' },
        { id: 'L06', questions: [8], status: 'CHECKED' },
        { id: 'L07', questions: [9], status: 'CHECKED' },
        { id: 'L08', questions: [10], status: 'CHECKED' },
        { id: 'L09', questions: [], status: 'CHECKED' },
        { id: 'L10', questions: [], status: 'CHECKED' }
      ],
      anomalySignals: [
        { type: 'MARGINAL_STEPS', description: 'Steps skipped but final answers correct', severity: 'MEDIUM' }
      ]
    },
    {
      id: 'ACAD-8841-C',
      name: 'Candidate C',
      scriptId: 'SCR-8841-C',
      totalLeaves: 8,
      aiCategory: 'REVIEW_REQUIRED',
      evaluationState: 'VERIFIED',
      marks: {
        1: 2, 2: 1, 3: 2, 4: 0,
        5: 5, 6: 5, 7: 3,
        8: 8, 9: 6, 10: 3
      },
      sectionTotals: {
        A: { recorded: 5, computed: 5, verified: true },
        B: { recorded: 13, computed: 13, verified: true },
        C: { recorded: 17, computed: 17, verified: true }
      },
      grandTotal: { recorded: 35, computed: 35, verified: true },
      leaves: [
        { id: 'L01', questions: [1, 2, 3, 4], status: 'CHECKED' },
        { id: 'L02', questions: [5], status: 'CHECKED' },
        { id: 'L03', questions: [6], status: 'CHECKED' },
        { id: 'L04', questions: [7], status: 'CHECKED' },
        { id: 'L05', questions: [8], status: 'CHECKED' },
        { id: 'L06', questions: [9], status: 'CHECKED' },
        { id: 'L07', questions: [10], status: 'CHECKED' },
        { id: 'L08', questions: [], status: 'CHECKED' }
      ],
      anomalySignals: [
        { type: 'POOR_HANDWRITING', description: 'OCR confidence low due to illegible handwriting', severity: 'HIGH' },
        { type: 'UNUSUAL_FORMATTING', description: 'Answers written outside designated margins', severity: 'MEDIUM' }
      ]
    }
  ],
  // AI categorisation summary
  categorisation: {
    highMatch: { count: 41, percent: 82, label: 'HIGH MATCH' },
    partialMatch: { count: 7, percent: 14, label: 'PARTIAL MATCH' },
    review: { count: 2, percent: 4, label: 'REVIEW REQUIRED' },
    totalScripts: 50
  },
  // Examiner info
  examiner: {
    id: 'EXM-204',
    name: 'Dr. Evaluator',
    role: 'HUMAN EXAMINER',
    scriptsAssigned: 50,
    scriptsCompleted: 38,
    averagePace: '12 min/script'
  },
  // Integrity checks
  integrityChecks: [
    { id: 'IC-01', label: 'All Questions Checked', status: 'FAIL', detail: 'Q06 not evaluated' },
    { id: 'IC-02', label: 'All Marks Recorded', status: 'FAIL', detail: 'Q06 mark missing' },
    { id: 'IC-03', label: 'Marks Valid', status: 'PASS', detail: 'All recorded marks within range' },
    { id: 'IC-04', label: 'Section A Total', status: 'PASS', detail: '18/20 verified' },
    { id: 'IC-05', label: 'Section B Total', status: 'BLOCKED', detail: 'Cannot verify - Q06 missing' },
    { id: 'IC-06', label: 'Section C Total', status: 'FAIL', detail: 'Recorded 33 ≠ Computed 34 (−1.0 M Break)' },
    { id: 'IC-07', label: 'Grand Total', status: 'BLOCKED', detail: 'Cannot verify - dependencies unresolved' },
    { id: 'IC-08', label: 'Review Signals', status: 'WARNING', detail: '1 scoring pattern signal' }
  ],
  // Moderation case
  moderationCase: {
    id: 'MOD-2024-041',
    triggerQuestion: 4,
    reason: 'Section C total discrepancy: Q04 awarded 4.0M, recorded in section as 3.0M',
    originalMark: 4,
    recordedInSection: 3,
    status: 'RESOLVED',
    resolution: 'Ledger corrected. Section C total updated from 33 to 34.',
    moderator: 'Head Examiner Panel'
  },
  // Evaluation summary (for result stage)
  evaluationSummary: {
    questionsEvaluated: '10 / 10',
    marksAwarded: '72 / 100',
    integrityChecks: 'Complete',
    reviewSignals: '1',
    moderation: 'Resolved',
    totals: 'Verified',
    result: 'READY'
  },
  // Institutional dashboard
  institutionalDashboard: {
    evaluation: { received: 50, checked: 38, pending: 12, completion: 76 },
    quality: { uncheckedAnswers: 3, missingMarks: 2, totalDiscrepancies: 1, reviewSignals: 4 },
    moderation: { open: 1, pending: 2, resolved: 15 },
    results: { verified: 32, pending: 6, ready: 32 }
  },
  // Document intelligence pipeline
  documentIntelligence: {
    ocrConfidence: 99.4,
    pagesProcessed: 12,
    questionsIdentified: 10,
    answerRegionsDetected: 10,
    handwritingClarity: 97.8,
    diagramsDetected: 3
  },
  // Evidence tether for Q04 (the question visible in examiner view)
  evidenceTether: {
    questionId: 4,
    confidence: 99.4,
    evidenceLocator: '§4.2 Lemma 3.2 Canonical Proof Verified',
    matchStatus: 'VERIFIED_MATCH',
    candidateAnswer: 'Candidate correctly invoked the divergence theorem and null boundary circulation.',
    rubricCriteria: 'Theorem Statement (2.0 M) + Vector Null Identity Lemma 3.2 (1.0 M) + Boundary (1.0 M) = 4.0 Marks',
    aiRecommendedMark: 4,
    aiMaxMark: 5,
    aiNote: 'Boundary parameterization verified. Final simplification omitted.'
  },
  // Guided demo steps
  guidedDemoSteps: [
    { step: 1, stage: 1, title: 'Institution Upload', description: 'Answer Scripts + Marking Scheme + Assessment Structure uploaded' },
    { step: 2, stage: 2, title: 'Registrar Prepares', description: 'Assessment configuration and document organization' },
    { step: 3, stage: 2, title: 'AI Structures Material', description: 'OCR, page segmentation, question identification' },
    { step: 4, stage: 3, title: 'Assessor Categorises', description: 'Scripts sorted into High Match / Partial / Review' },
    { step: 5, stage: 4, title: 'Examiner Opens Script', description: 'Human examiner selects script from assigned queue' },
    { step: 6, stage: 4, title: 'Examiner Reads & Marks', description: 'Reads answer, checks against criteria, awards marks' },
    { step: 7, stage: 5, title: 'Submit Checked Copy', description: 'Examiner submits the evaluated answer script' },
    { step: 8, stage: 6, title: 'Proctor: Unchecked Q06', description: 'Q06 not evaluated — page rises — submission blocked' },
    { step: 9, stage: 6, title: 'Examiner Resolves Q06', description: 'Missing evaluation completed, page settles back' },
    { step: 10, stage: 6, title: 'Discrepancy Detected', description: 'Q04 mark ≠ section total — integrity break found' },
    { step: 11, stage: 6, title: 'Auditor Review Signal', description: 'Scoring pattern anomaly flagged for human review' },
    { step: 12, stage: 7, title: 'Moderation Opened', description: 'Case enters moderation with full traceability' },
    { step: 13, stage: 7, title: 'Case Resolved', description: 'Moderator corrects ledger, section total updated' },
    { step: 14, stage: 8, title: 'Result Ready', description: 'All checks pass — result verified and available' },
    { step: 15, stage: 9, title: 'Archivist Stores Learning', description: 'Validated interpretation stored as institutional knowledge' },
    { step: 16, stage: 9, title: 'Institutional Intelligence', description: 'System zooms out to dashboard and anomaly terrain' },
    { step: 17, stage: 9, title: 'Evaluation DNA', description: 'Knowledge feeds future evaluations — cycle complete' }
  ]
};
