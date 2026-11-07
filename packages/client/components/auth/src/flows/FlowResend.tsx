import { Trans } from "@lingui/solid/macro";

import { useApi } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useNavigate } from "@revolt/routing";

import { FlowActions, FlowTitle } from "./Flow";
import { setFlowCheckEmail } from "./FlowCheck";
import { Fields, Form, SubmitButton } from "./Form";

/**
 * Flow for resending email verification
 */
export default function FlowResend() {
  const api = useApi();
  const navigate = useNavigate();
  const { config } = useInstance();

  /**
   * Resend email verification
   * @param data Form Data
   */
  async function resend(data: FormData) {
    const email = data.get("email") as string;
    const captcha = data.get("captcha") as string;

    await api.post("/auth/account/reverify", {
      email,
      captcha,
    });

    setFlowCheckEmail(email);
    navigate("/login/check", { replace: true });
  }

  return (
    <>
      <FlowTitle
        subtitle={
          <Trans>Enter your email and we'll send you a fresh link.</Trans>
        }
      >
        <Trans>Resend verification</Trans>
      </FlowTitle>
      <Form
        onSubmit={resend}
        captcha={config.features.captcha.key}
        actions={
          <FlowActions back="/login/auth">
            <SubmitButton>
              <Trans>Resend</Trans>
            </SubmitButton>
          </FlowActions>
        }
      >
        <Fields fields={["email"]} />
      </Form>
    </>
  );
}
