import { Trans } from "@lingui/solid/macro";

import { useApi } from "@revolt/client";
import { useNavigate, useParams } from "@revolt/routing";

import { FlowActions, FlowTitle } from "./Flow";
import { Fields, Form, SubmitButton } from "./Form";

/**
 * Flow for confirming a new password
 */
export default function FlowConfirmReset() {
  const api = useApi();
  const { token } = useParams();
  const navigate = useNavigate();

  /**
   * Confirm new password
   * @param data Form Data
   */
  async function reset(data: FormData) {
    const password = data.get("new-password") as string;

    await api.patch("/auth/account/reset_password", {
      password,
      token,
    });

    navigate("/login/auth", { replace: true });
  }

  return (
    <>
      <FlowTitle
        subtitle={<Trans>Choose a new password for your Zrzur account.</Trans>}
      >
        <Trans>Reset password</Trans>
      </FlowTitle>
      <Form
        onSubmit={reset}
        actions={
          <FlowActions back="/login/auth">
            <SubmitButton>
              <Trans>Reset</Trans>
            </SubmitButton>
          </FlowActions>
        }
      >
        <Fields fields={["new-password"]} />
      </Form>
    </>
  );
}
