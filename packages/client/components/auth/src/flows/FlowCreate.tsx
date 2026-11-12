import { Trans } from "@lingui/solid/macro";
import { Show } from "solid-js";
import type { API } from "@zrzur/sdk/solid";

import { useApi, useClientLifecycle } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useNavigate, useParams } from "@revolt/routing";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { FlowActions, FlowTitle, showDevMocks } from "./Flow";
import { setFlowCheckEmail } from "./FlowCheck";
import { Fields, Form, SubmitButton } from "./Form";
import { SignUpConsent } from "./SignUpConsent";

/**
 * Reassurance shown while typing an email address to sign up with
 */
function EmailPrivacyHint() {
  return (
    <>
      <Symbol size={20}>lock</Symbol>
      <div>
        <strong>
          <Trans>Your email stays private</Trans>
        </strong>
        <p>
          <Trans>
            We only use it to verify your account and help you get back in if
            you're ever locked out. We'll never sell it or send you spam.
          </Trans>
        </p>
        <a
          href="https://zrzur.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1} // redundant for kb nav -> another link in footer
        >
          <Trans>Privacy policy</Trans>
        </a>
      </div>
    </>
  );
}

/**
 * Flow for creating a new account
 */
export default function FlowCreate() {
  const api = useApi();
  const navigate = useNavigate();
  const { code } = useParams();
  const modals = useModals();
  const { login } = useClientLifecycle();
  const { config } = useInstance();
  /**
   * Create an account
   * @param data Form Data
   */
  async function create(data: FormData) {
    const email = data.get("email") as string;
    const password = data.get("new-password") as string;
    const captcha = data.get("captcha") as string;
    const invite = data.get("invite") as string;

    // the month and year of birth are asked at the first entry, not here
    const body: API.DataCreateAccount = {
      email,
      password,
      captcha,
      ...(invite ? { invite } : {}),
    };

    await api.post("/auth/account/create", body);

    if (!config.features.email) {
      await login(
        {
          email,
          password,
        },
        modals,
      );
      navigate("/login/auth", { replace: true });
    } else {
      setFlowCheckEmail(email);
      navigate("/login/check", { replace: true });
    }
  }

  return (
    <>
      <FlowTitle
        subtitle={<Trans>Set up your account and make yourself at home.</Trans>}
      >
        <Trans>Create account</Trans>
      </FlowTitle>
      <Form
        onSubmit={create}
        captcha={config.features.captcha.key}
        actions={
          <FlowActions back="/login/auth">
            <SubmitButton>
              <Trans>Create account</Trans>
            </SubmitButton>
          </FlowActions>
        }
      >
        <Fields
          fields={[
            { field: "email", hint: <EmailPrivacyHint /> },
            "new-password",
          ]}
        />
        <Show when={config.features.invite_only}>
          <Fields fields={[{ field: "invite", value: code }]} />
        </Show>
        <SignUpConsent />
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
            setFlowCheckEmail("insert@zrzur.com");
            navigate("/login/check", { replace: true });
          }}
        >
          Mock Submission
        </div>
      )}
    </>
  );
}
