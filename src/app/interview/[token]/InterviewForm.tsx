"use client";

import { useActionState } from "react";
import { submitAnswers, type InviteState } from "../../actions/interview";

const empty: InviteState = {};

export default function InterviewForm({
  token, questions, deadline,
}: {
  token: string;
  questions: { id: string; item: string; candidateAnswer: string | null }[];
  deadline: string;
}) {
  const [state, action, pending] = useActionState(submitAnswers, empty);

  if (state.ok) {
    return (
      <p style={{ marginTop: 20, color: "var(--text)", fontSize: ".95rem", lineHeight: 1.6 }}>
        Thank you — your answers have been sent. You can close this page.
      </p>
    );
  }

  return (
    <form action={action} style={{ marginTop: 20 }}>
      <input type="hidden" name="token" value={token} />

      {questions.map((q, i) => (
        <div className="field" key={q.id} style={{ marginBottom: 18 }}>
          <label htmlFor={`a_${q.id}`}>{i + 1}. {q.item}</label>
          <textarea
            id={`a_${q.id}`}
            name={`a_${q.id}`}
            rows={4}
            defaultValue={q.candidateAnswer ?? ""}
            placeholder="Your answer"
          />
        </div>
      ))}

      {state.error && (
        <p style={{ color: "var(--red, #ff6b6b)", fontSize: ".9rem", marginBottom: 12 }}>{state.error}</p>
      )}

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? "Sending…" : "Send my answers"}
      </button>

      <p style={{ marginTop: 12, color: "var(--muted)", fontSize: ".82rem" }}>
        You can submit once. This link closes on {deadline}.
      </p>
    </form>
  );
}
