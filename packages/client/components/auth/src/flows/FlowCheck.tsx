import { Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useNavigate } from "@revolt/routing";

import { FlowActions, FlowTitle, showDevMocks } from "./Flow";
import { MailProvider } from "./MailProvider";

/**
 * Keep track of email within the same session
 */
let email = "postmaster@localhost";

/**
 * Which email was sent: an address check or a password reset link
 */
let kind: "verify" | "reset" = "verify";

/**
 * Persist email information temporarily
 */
export function setFlowCheckEmail(
  e: string,
  sent: "verify" | "reset" = "verify",
) {
  email = e;
  kind = sent;
}

/**
 * Flow to tell the user to check their email
 */
export default function FlowCheck() {
  const navigate = useNavigate();

  return (
    <>
      <FlowTitle
        subtitle={
          <Show
            when={kind === "reset"}
            fallback={
              <Trans>
                We've sent you a verification email. Please allow up to 10
                minutes for it to arrive.
              </Trans>
            }
          >
            <Trans>
              If an account uses this address, we've sent it a link to choose a
              new password. Please allow up to 10 minutes for it to arrive.
            </Trans>
          </Show>
        }
      >
        <Trans>Check your email</Trans>
      </FlowTitle>
      <FlowActions back="/login/auth">
        <Show when={email}>
          <MailProvider email={email} />
        </Show>
      </FlowActions>
      {showDevMocks() && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            background: "white",
            color: "black",
            cursor: "pointer",
          }}
          onClick={() => {
            navigate("/login/verify/abc", { replace: true });
          }}
        >
          Mock Verify
        </div>
      )}
    </>
  );
}
