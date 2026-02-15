import type {
  AnswerBatchResponse,
  AnswerResponse,
  AnswerSubmission,
  AuthMeResponse,
  Grade,
  GradesResponse,
  Question,
  RepoVerifyResponse,
  SubmissionResponse,
} from "./types";

/** All codequestionbot API calls go through /cqbot which the Vite proxy rewrites to the Flask backend */
const API_BASE = "/cqbot";

const USE_MOCKS = false;
const MOCK_QUESTION_COUNT = 5;

const buildMockQuestions = (count: number): Question[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-question-${index + 1}`,
    text: `Mock question ${index + 1}: What does this function do?`,
    file_path: "src/example.py",
    line_start: 1,
    line_end: 12,
    excerpt: "def example():\n    return 'hello'\n",
  }));
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    if (data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return response.statusText || "Request failed";
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as T;
};

export const getAuthMe = async (): Promise<AuthMeResponse> => {
  if (USE_MOCKS) {
    return { authenticated: true, github_login: "mock-user", is_instructor: false };
  }
  return fetchJson<AuthMeResponse>(`${API_BASE}/auth/me`);
};

export const logout = async (): Promise<void> => {
  if (USE_MOCKS) {
    return;
  }
  await fetchJson(`${API_BASE}/auth/logout`, { method: "POST" });
};

export const verifyRepo = async (repoUrl: string): Promise<RepoVerifyResponse> => {
  if (USE_MOCKS) {
    return { ok: true, owner: "mock-user", name: "mock-repo" };
  }

  return fetchJson<RepoVerifyResponse>(`${API_BASE}/repos/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
};

export const createSubmission = async (
  repoUrl: string
): Promise<SubmissionResponse> => {
  if (USE_MOCKS) {
    return {
      submission_id: "mock-submission",
      status: "ready",
      questions: buildMockQuestions(MOCK_QUESTION_COUNT),
    };
  }

  return fetchJson<SubmissionResponse>(`${API_BASE}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
};

export const submitAnswers = async (
  answers: AnswerSubmission[]
): Promise<AnswerResponse[]> => {
  if (USE_MOCKS) {
    return answers.map((_, index) => ({
      answer_id: `mock-answer-${index + 1}`,
      grade_id: `mock-grade-${index + 1}`,
      score: 4,
    }));
  }

  const payload = await fetchJson<AnswerBatchResponse>(
    `${API_BASE}/answers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
    }
  );

  return payload.answers;
};

export const getGrades = async (submissionId: string): Promise<Grade[]> => {
  if (USE_MOCKS) {
    return [
      { answer_id: "mock-1", score: 4, rationale: "Good explanation.", confidence: 0.85 },
    ];
  }
  const response = await fetchJson<GradesResponse>(
    `${API_BASE}/submissions/${submissionId}/grades`
  );
  return response.grades;
};

export const getCsvExportUrl = (): string => {
  return `${API_BASE}/exports/submissions.csv`;
};

export const getAuthUrl = (): string => {
  return `${API_BASE}/auth/github`;
};

