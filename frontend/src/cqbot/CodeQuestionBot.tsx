import { useEffect, useState, type FormEvent } from "react";
import {
  createSubmission,
  getCsvExportUrl,
  getAuthMe,
  getAuthUrl,
  getGrades,
  logout,
  verifyRepo,
  submitAnswers,
} from "./api";
import type { AnswerSubmission, Grade, SubmissionResponse } from "./types";
import "./CodeQuestionBot.css";

type Stage = "submit" | "questions" | "submitted";
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const isValidRepoUrl = (value: string): boolean => {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value);
};

export default function CodeQuestionBot() {
  const [repoUrl, setRepoUrl] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authLogin, setAuthLogin] = useState<string | null>(null);
  const [isInstructor, setIsInstructor] = useState(false);
  const [stage, setStage] = useState<Stage>("submit");
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitPhase, setSubmitPhase] = useState<
    "idle" | "verifying" | "generating"
  >("idle");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pasteCounts, setPasteCounts] = useState<Record<string, number>>({});
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [activeTimers, setActiveTimers] = useState<Record<string, number | null>>({});
  const [invalidAnswers, setInvalidAnswers] = useState<Set<string>>(new Set());
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAuthMe()
      .then((response) => {
        if (!mounted) return;
        if (response.authenticated) {
          setAuthStatus("authenticated");
          setAuthLogin(response.github_login ?? null);
          setIsInstructor(Boolean(response.is_instructor));
        } else {
          setAuthStatus("unauthenticated");
        }
      })
      .catch(() => {
        if (mounted) setAuthStatus("unauthenticated");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidRepoUrl(repoUrl)) {
      setError("Enter a valid GitHub repo URL (https://github.com/user/repo).");
      return;
    }

    try {
      setSubmitPhase("verifying");
      await verifyRepo(repoUrl);
      setSubmitPhase("generating");
      const result = await createSubmission(repoUrl);
      setSubmission(result);
      setStage("questions");
      const seededAnswers = result.questions.reduce<Record<string, string>>(
        (acc, question) => {
          acc[question.id] = "";
          return acc;
        },
        {}
      );
      setAnswers(seededAnswers);
      const seededTimers = result.questions.reduce<Record<string, number>>(
        (acc, question) => {
          acc[question.id] = 0;
          return acc;
        },
        {}
      );
      setTimeSpent(seededTimers);
      setPasteCounts(
        result.questions.reduce<Record<string, number>>((acc, question) => {
          acc[question.id] = 0;
          return acc;
        }, {})
      );
      setActiveTimers(
        result.questions.reduce<Record<string, number | null>>((acc, question) => {
          acc[question.id] = null;
          return acc;
        }, {})
      );
      setFocusLossCount(0);
      setInvalidAnswers(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit repo.");
    } finally {
      setSubmitPhase("idle");
    }
  };

  const handleReset = () => {
    setRepoUrl("");
    setSubmission(null);
    setStage("submit");
    setError(null);
    setAnswers({});
    setSubmitError(null);
    setPasteCounts({});
    setFocusLossCount(0);
    setTimeSpent({});
    setActiveTimers({});
    setSubmitPhase("idle");
    setInvalidAnswers(new Set());
    setGrades([]);
    setIsLoadingGrades(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setAuthStatus("unauthenticated");
      setAuthLogin(null);
      setIsInstructor(false);
      handleReset();
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setInvalidAnswers((current) => {
      if (!current.has(questionId)) return current;
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
  };

  const handleSubmitAnswers = async () => {
    if (!submission) return;
    setSubmitError(null);

    const emptyIds = submission.questions
      .filter((question) => !answers[question.id]?.trim())
      .map((question) => question.id);

    if (emptyIds.length > 0) {
      setInvalidAnswers(new Set(emptyIds));
      setSubmitError("Please answer all questions before submitting.");
      return;
    }

    const now = Date.now();
    const effectiveTimeSpent = { ...timeSpent };
    Object.entries(activeTimers).forEach(([questionId, start]) => {
      if (start) {
        effectiveTimeSpent[questionId] =
          (effectiveTimeSpent[questionId] ?? 0) + (now - start);
      }
    });

    const payload: AnswerSubmission[] = submission.questions.map((question) => ({
      submission_id: submission.submission_id,
      question_id: question.id,
      answer_text: answers[question.id] ?? "",
      time_spent_ms: effectiveTimeSpent[question.id] ?? 0,
      paste_attempts: pasteCounts[question.id] ?? 0,
      focus_loss_count: focusLossCount,
      typing_stats: null,
    }));

    setIsSubmittingAnswers(true);
    localStorage.removeItem(`cqbot:answers:${repoUrl}`);

    try {
      await submitAnswers(payload);
      setStage("submitted");
      setIsLoadingGrades(true);

      let attempts = 0;
      const maxAttempts = 60;
      const poll = () => {
        if (attempts >= maxAttempts) {
          setIsLoadingGrades(false);
          return;
        }
        attempts++;
        getGrades(submission.submission_id)
          .then((gradesList) => {
            if (gradesList.length >= submission.questions.length) {
              setGrades(gradesList);
              setIsLoadingGrades(false);
            } else {
              setTimeout(poll, 2000);
            }
          })
          .catch(() => {
            setTimeout(poll, 2000);
          });
      };
      setTimeout(poll, 3000);
    } catch (err) {
      console.error("Answer submission failed:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit answers."
      );
    } finally {
      setIsSubmittingAnswers(false);
    }
  };

  const handlePaste = (questionId: string) => {
    setPasteCounts((current) => ({
      ...current,
      [questionId]: (current[questionId] ?? 0) + 1,
    }));
  };

  const handleFocus = (questionId: string) => {
    setActiveTimers((current) => {
      if (current[questionId]) return current;
      return { ...current, [questionId]: Date.now() };
    });
  };

  const handleBlur = (questionId: string) => {
    setActiveTimers((current) => {
      const start = current[questionId];
      if (!start) return current;
      const elapsed = Date.now() - start;
      setTimeSpent((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] ?? 0) + elapsed,
      }));
      return { ...current, [questionId]: null };
    });
  };

  const syncKey = stage === "questions" ? `cqbot:answers:${repoUrl}` : null;

  useEffect(() => {
    if (!syncKey || !submission) return;
    const cached = localStorage.getItem(syncKey);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as {
        answers?: Record<string, string>;
        timeSpent?: Record<string, number>;
      };
      if (parsed.answers) setAnswers((c) => ({ ...c, ...parsed.answers }));
      if (parsed.timeSpent) setTimeSpent((c) => ({ ...c, ...parsed.timeSpent }));
    } catch {
      localStorage.removeItem(syncKey);
    }
  }, [syncKey, submission]);

  useEffect(() => {
    if (!syncKey) return;
    localStorage.setItem(syncKey, JSON.stringify({ answers, timeSpent }));
  }, [answers, timeSpent, syncKey]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setFocusLossCount((count) => count + 1);
      }
    };
    window.addEventListener("blur", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const exportUrl = getCsvExportUrl();
  const isSubmitting = submitPhase !== "idle";
  const submitLabel =
    submitPhase === "verifying"
      ? "Verifying repo..."
      : submitPhase === "generating"
      ? "Preparing questions..."
      : "Generate questions";

  /* ---- Loading state ---- */
  if (authStatus === "loading") {
    return (
      <div className="cqbot">
        <div className="cqbot-auth">
          <h2>Checking your session…</h2>
          <p>Verifying GitHub sign-in status.</p>
        </div>
      </div>
    );
  }

  /* ---- Unauthenticated ---- */
  if (authStatus === "unauthenticated") {
    return (
      <div className="cqbot">
        <div className="cqbot-auth">
          <p className="cqbot-eyebrow">CodeQuestionBot</p>
          <h2>Sign in to continue.</h2>
          <p>
            We use GitHub to confirm your identity and request read access to the
            repo you submit.
          </p>
          <a className="cqbot-link-btn" href={getAuthUrl()}>
            Sign in with GitHub
          </a>
        </div>
      </div>
    );
  }

  /* ---- Authenticated ---- */
  return (
    <div className="cqbot">
      {/* Header */}
      <div className="cqbot-header">
        <div>
          <p className="cqbot-eyebrow">CodeQuestionBot</p>
          <h2>Explain your code with confidence.</h2>
        </div>
        <div className="cqbot-header-right">
          {authLogin && <span>Signed in as {authLogin}</span>}
          <button className="cqbot-ghost-btn" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="cqbot-hero">
        <p className="cqbot-subhead">
          Submit a GitHub repo and get a focused, code-specific question set.
        </p>
      </div>

      {/* Panel */}
      <div className="cqbot-panel">
        {/* Submit stage */}
        {stage === "submit" && (
          <form className="cqbot-repo-form" onSubmit={handleSubmit}>
            <label htmlFor="cqbot-repo-url">GitHub repository URL</label>
            <input
              id="cqbot-repo-url"
              name="cqbot-repo-url"
              type="url"
              placeholder="https://github.com/yourname/your-repo"
              value={repoUrl}
              onChange={(event) => {
                setRepoUrl(event.target.value);
                setError(null);
              }}
              required
            />
            {error && <p className="cqbot-error">{error}</p>}
            <button className="cqbot-primary-btn" type="submit" disabled={isSubmitting}>
              {submitLabel}
            </button>
          </form>
        )}

        {/* Questions stage */}
        {stage === "questions" && submission && (
          <div className="cqbot-questions-state">
            <div className="cqbot-questions-header">
              <div>
                <p className="cqbot-eyebrow">Questions ready</p>
                <h2>Answer each prompt in your own words.</h2>
                <p className="cqbot-subhead">
                  Repo: <span className="cqbot-mono">{repoUrl}</span>
                </p>
              </div>
              <div>
                <p className="cqbot-subhead">Be precise and reference the code shown.</p>
                {focusLossCount > 0 && (
                  <p className="cqbot-warning">
                    Keep this tab active. Focus lost {focusLossCount}{" "}
                    {focusLossCount === 1 ? "time" : "times"}.
                  </p>
                )}
              </div>
            </div>

            <div className="cqbot-question-list">
              {submission.questions.map((question, index) => (
                <article className="cqbot-question-card" key={question.id}>
                  <header className="cqbot-question-meta">
                    <span className="cqbot-badge">Q{index + 1}</span>
                    <span className="cqbot-mono">
                      {question.file_path}:{question.line_start}-{question.line_end}
                    </span>
                  </header>
                  <h3>{question.text}</h3>
                  <pre className="cqbot-snippet">{question.excerpt}</pre>
                  <label htmlFor={`cqbot-answer-${question.id}`}>Your answer</label>
                  <textarea
                    id={`cqbot-answer-${question.id}`}
                    name={`cqbot-answer-${question.id}`}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      handleAnswerChange(question.id, event.target.value)
                    }
                    onPaste={(event) => {
                      event.preventDefault();
                      handlePaste(question.id);
                    }}
                    onFocus={() => handleFocus(question.id)}
                    onBlur={() => handleBlur(question.id)}
                    rows={5}
                    placeholder="Explain your reasoning here..."
                    className={
                      invalidAnswers.has(question.id)
                        ? "cqbot-textarea-error"
                        : undefined
                    }
                  />
                  {pasteCounts[question.id] ? (
                    <p className="cqbot-warning">Paste is disabled for responses.</p>
                  ) : null}
                </article>
              ))}
            </div>

            {submitError && <p className="cqbot-error">{submitError}</p>}

            <div className="cqbot-actions">
              <button className="cqbot-ghost-btn" type="button" onClick={handleReset}>
                Start over
              </button>
              <button
                className="cqbot-primary-btn"
                type="button"
                onClick={handleSubmitAnswers}
                disabled={isSubmittingAnswers}
              >
                {isSubmittingAnswers ? "Submitting answers..." : "Submit answers"}
              </button>
            </div>
          </div>
        )}

        {/* Submitted stage */}
        {stage === "submitted" && (
          <div className="cqbot-submitted">
            <div>
              <h2>Answers submitted.</h2>
              {isLoadingGrades ? (
                <p className="cqbot-subhead">Grading in progress… please wait.</p>
              ) : grades.length > 0 && submission ? (
                (() => {
                  const totalScore = grades.reduce((sum, g) => sum + g.score, 0);
                  const maxScore = grades.length * 5;
                  const pct = Math.round((totalScore / maxScore) * 100);
                  const avgConfidence = Math.round(
                    (grades.reduce((sum, g) => sum + g.confidence, 0) /
                      grades.length) *
                      100
                  );
                  const level =
                    pct >= 80
                      ? "Excellent"
                      : pct >= 60
                      ? "Good"
                      : pct >= 40
                      ? "Needs Improvement"
                      : "Insufficient";
                  const levelClass =
                    pct >= 80
                      ? "cqbot-level-excellent"
                      : pct >= 60
                      ? "cqbot-level-good"
                      : pct >= 40
                      ? "cqbot-level-fair"
                      : "cqbot-level-low";

                  return (
                    <div>
                      <div className="cqbot-score-summary">
                        <div className={`cqbot-score-ring ${levelClass}`}>
                          <span className="cqbot-score-pct">{pct}%</span>
                        </div>
                        <div className="cqbot-score-details">
                          <h3 className="cqbot-score-level">{level}</h3>
                          <p className="cqbot-subhead">
                            {totalScore} / {maxScore} points across {grades.length}{" "}
                            questions
                          </p>
                          <p className="cqbot-subhead" style={{ fontSize: "0.85rem" }}>
                            Average grading confidence: {avgConfidence}%
                          </p>
                        </div>
                      </div>

                      <div className="cqbot-question-list" style={{ marginTop: 20 }}>
                        {submission.questions.map((question, index) => {
                          const grade = grades[index];
                          return (
                            <article className="cqbot-question-card" key={question.id}>
                              <header className="cqbot-question-meta">
                                <span className="cqbot-badge">Q{index + 1}</span>
                                {grade && (
                                  <span
                                    className={`cqbot-badge cqbot-score-badge ${
                                      grade.score >= 4
                                        ? "cqbot-score-high"
                                        : grade.score >= 3
                                        ? "cqbot-score-mid"
                                        : "cqbot-score-low"
                                    }`}
                                  >
                                    {grade.score} / 5
                                  </span>
                                )}
                              </header>
                              <h3>{question.text}</h3>
                              <pre className="cqbot-snippet">{question.excerpt}</pre>
                              <p style={{ color: "#cbd5e1" }}>
                                <strong>Your answer:</strong>{" "}
                                {answers[question.id]}
                              </p>
                              {grade && (
                                <div className="cqbot-grade-feedback">
                                  <p>
                                    <strong>Feedback:</strong> {grade.rationale}
                                  </p>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="cqbot-subhead">
                  Thanks for completing the question set. Your responses are now being
                  graded.
                </p>
              )}
            </div>
            <div className="cqbot-actions">
              <button
                className="cqbot-primary-btn"
                type="button"
                onClick={handleReset}
              >
                Submit another repo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructor tools */}
      {isInstructor && (
        <div className="cqbot-panel cqbot-instructor-panel">
          <div>
            <p className="cqbot-eyebrow">Instructor tools</p>
            <h2>Export grades as CSV.</h2>
            <p className="cqbot-subhead">
              Download a current snapshot of submissions, scores, and integrity flags.
            </p>
          </div>
          <a className="cqbot-ghost-btn" href={exportUrl} style={{ textAlign: "center", textDecoration: "none" }}>
            Download CSV export
          </a>
        </div>
      )}
    </div>
  );
}

