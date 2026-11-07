import { Trans } from "@lingui/solid/macro";

import { useApi } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useNavigate } from "@revolt/routing";

import { FlowActions, FlowTitle, showDevMocks } from "./Flow";
import { setFlowCheckEmail } from "./FlowCheck";
import { Fields, Form, SubmitButton } from "./Form";

/**
 * Flow for sending password reset
 */
export default function FlowReset() {
  const api = useApi();
  const navigate = useNavigate();
  const { config } = useInstance();

  /**
   * Send password reset
   * @param data Form Data
   */
  async function reset(data: FormData) {
    const email = data.get("email") as string;
    const captcha = data.get("captcha") as string;

    await api.post("/auth/account/reset_password", {
      email,
      captcha,
    });

    setFlowCheckEmail(email, "reset");
    navigate("/login/check", { replace: true });
  }

  return (
    <>
      <FlowTitle
        subtitle={
          <Trans>We'll email you a secure link to choose a new password.</Trans>
        }
      >
        <Trans>Reset password</Trans>
      </FlowTitle>
      <Form
        onSubmit={reset}
        captcha={config.features.captcha.key}
        actions={
          <FlowActions back="/login/auth">
            <SubmitButton>
              <Trans>Reset</Trans>
            </SubmitButton>
          </FlowActions>
        }
      >
        <Fields fields={["email"]} />
      </Form>
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
            navigate("/login/reset/abc", { replace: true });
          }}
        >
          Mock Reset Screen
        </div>
      )}
    </>
  );
}
