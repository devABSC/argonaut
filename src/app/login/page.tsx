"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "../actions/auth";

const empty: AuthState = {};

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [inState, inAction, inPending] = useActionState(signIn, empty);
  const [upState, upAction, upPending] = useActionState(signUp, empty);

  const isSignup = mode === "signup";
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
            <h2>Launch your <span className="grad">workspace.</span></h2>
            <p className="tagline">Business Made Easy</p>
          </div>
        </section>

        {/* Right: console */}
        <section className="console">
          <div className="console__bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>

          <div className="card">
            <p className="eyebrow"><span className="live" />Encrypted Connection</p>
            <h1>{isSignup ? "Create account" : "Sign in"}</h1>

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

            <p className="toggle">
              {isSignup ? "Already aboard? " : "No account yet? "}
              <button type="button" className="link" onClick={() => setMode(isSignup ? "signin" : "signup")}>
                {isSignup ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
