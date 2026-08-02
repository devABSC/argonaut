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
            <p>Turning Your Vision Into Reality</p>
          </div>
        </section>

        {/* Right: console */}
        <section className="console">
          <div className="console__bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>

          <div className="card">
            <div className="brandrow">
              <span className="wordmark">
                <span className="hero-mark">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <ellipse cx="12" cy="4.6" rx="5.4" ry="1.5" stroke="#06070B" strokeWidth="1.3" />
                    <path d="M12 7.2c-3.5 0-6.1 2.6-6.1 6 0 1.2.3 2.1.9 3 .2.3.5.5.9.5h1.2c.3 0 .6-.2.8-.5.6-.8 1.4-1.3 2.3-1.3s1.7.5 2.3 1.3c.2.3.5.5.8.5h1.2c.4 0 .7-.2.9-.5.6-.9.9-1.8.9-3 0-3.4-2.6-6-6.1-6z" fill="#06070B" />
                    <path d="M9.2 12.3c1.7-.8 3.9-.8 5.6 0-.4.9-1.6 1.5-2.8 1.5s-2.4-.6-2.8-1.5z" fill="#38E8FF" />
                  </svg>
                </span>
                Argonaut
              </span>
            </div>

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
