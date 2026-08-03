"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "../actions/auth";
import { requestReset, confirmReset, type ResetState } from "../actions/password";

const empty: AuthState = {};
const emptyReset: ResetState = { stage: "request" };

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [inState, inAction, inPending] = useActionState(signIn, empty);
  const [upState, upAction, upPending] = useActionState(signUp, empty);
  const [reqState, reqAction, reqPending] = useActionState(requestReset, emptyReset);
  const [cfmState, cfmAction, cfmPending] = useActionState(confirmReset, emptyReset);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  // Once a code has been issued we move to the verify step and stay there.
  const verifying = reqState.stage === "verify" || cfmState.stage === "verify";
  const action = isSignup ? upAction : inAction;
  const state = isSignup ? upState : inState;
  const pending = isSignup ? upPending : inPending;

  return (
    <main className="login-page">
      <div className="split">
        {/* Left: rocket visual */}
        <section className="visual">
          <div className="visual__img" />
          <div className="visual__grid" />
          <div className="visual__grad" />
          <div className="visual__caption">
            <p className="visual__eyebrow"><span className="live" />Mission control</p>
            <h2>Launch your workspace.</h2>
            <p className="tagline">Business Made Easy</p>
          </div>
        </section>

        {/* Right: console */}
        <section className="console">
          <div className="console__bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>

          <div className="card">
            <p className="eyebrow"><span className="live" />Encrypted Connection</p>
            <h1>{isForgot ? (verifying ? "Enter your code" : "Reset password") : isSignup ? "Create account" : "Sign in"}</h1>

            {isForgot ? (
              verifying ? (
                <form action={cfmAction}>
                  <div className="field">
                    <label htmlFor="r-email">Email</label>
                    <input className="input" id="r-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="r-code">6-digit code</label>
                    <input
                      className="input" id="r-code" name="code" inputMode="numeric" pattern="\\d{6}"
                      maxLength={6} placeholder="000000" required autoComplete="one-time-code"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="r-pass">New password</label>
                    <input className="input" id="r-pass" name="password" type="password" required autoComplete="new-password" />
                  </div>
                  <div className="field">
                    <label htmlFor="r-confirm">Confirm password</label>
                    <input className="input" id="r-confirm" name="confirm" type="password" required autoComplete="new-password" />
                  </div>

                  {cfmState.error && <p className="err">{cfmState.error}</p>}
                  {(cfmState.notice || reqState.notice) && (
                    <p className="notice">{cfmState.notice || reqState.notice}</p>
                  )}

                  <button className="btn" type="submit" disabled={cfmPending}>
                    {cfmPending ? "Please wait…" : "Change password →"}
                  </button>
                </form>
              ) : (
                <form action={reqAction}>
                  <div className="field">
                    <label htmlFor="f-email">Email</label>
                    <input className="input" id="f-email" name="email" type="email" placeholder="you@domain.com" required autoComplete="email" />
                  </div>

                  {reqState.error && <p className="err">{reqState.error}</p>}
                  {reqState.notice && <p className="notice">{reqState.notice}</p>}

                  <button className="btn" type="submit" disabled={reqPending}>
                    {reqPending ? "Please wait…" : "Email me a code →"}
                  </button>
                </form>
              )
            ) : (
            <form action={action}>
              {isSignup && (
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input className="input" id="name" name="name" type="text" placeholder="Ada Lovelace" autoComplete="name" required />
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email</label>
                <input className="input" id="email" name="email" type="email" placeholder="you@domain.com" autoComplete="email" required />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input className="input" id="password" name="password" type="password" placeholder="••••••••••" autoComplete={isSignup ? "new-password" : "current-password"} required />
              </div>

              {!isSignup && (
                <div className="row">
                  <label className="check"><input type="checkbox" defaultChecked /> Keep me signed in</label>
                </div>
              )}

              {state.error && <p className="err">{state.error}</p>}
              {state.notice && <p className="notice">{state.notice}</p>}

              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Please wait…" : isSignup ? "Create account →" : "Enter workspace →"}
              </button>
            </form>
            )}

            <p className="toggle">
              {isForgot ? (
                <button type="button" className="link" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              ) : (
                <>
                  {isSignup ? "Already aboard? " : "No account yet? "}
                  <button type="button" className="link" onClick={() => setMode(isSignup ? "signin" : "signup")}>
                    {isSignup ? "Sign in" : "Create one"}
                  </button>
                  {!isSignup && (
                    <>
                      {" · "}
                      <button type="button" className="link" onClick={() => setMode("forgot")}>
                        Forgot password?
                      </button>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
