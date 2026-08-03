"use client";

import { useActionState } from "react";
import { changeOwnPassword, type ChangeState } from "../actions/changepw";
import { signOut } from "../actions/auth";
import { RULES_TEXT } from "@/lib/password-strength";

const empty: ChangeState = {};

export default function ChangePasswordForm({ forced, name }: { forced: boolean; name: string }) {
  const [state, action, pending] = useActionState(changeOwnPassword, empty);

  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="current">Current password</label>
          <input className="input" id="current" name="current" type="password" required autoComplete="current-password" />
        </div>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input className="input" id="password" name="password" type="password" required minLength={12} autoComplete="new-password" />
          <p className="hintline">{RULES_TEXT}</p>
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input className="input" id="confirm" name="confirm" type="password" required autoComplete="new-password" />
        </div>

        {state.error && <p className="err">{state.error}</p>}

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Please wait…" : "Change password →"}
        </button>
      </form>

      <p className="toggle">
        {forced ? `Signed in as ${name}. ` : ""}
        <form action={signOut} style={{ display: "inline", margin: 0 }}>
          <button type="submit" className="link">Sign out instead</button>
        </form>
      </p>
    </>
  );
}
