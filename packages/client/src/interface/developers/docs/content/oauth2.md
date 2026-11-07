# OAuth2

Let people sign in to your website with their Zrzur account. Installing a bot uses the same screen.

## You will need {#you-will-need}

An application, and a website or program that can receive a redirect.

## What it can and cannot do {#scope}

An access token reads who someone is and which servers they are in. It works only on `/oauth2/@me...`. It never acts as the person on the rest of the API.

| Scope                   | Gives                                     |
| ----------------------- | ----------------------------------------- |
| `identify`              | `GET /oauth2/@me`                         |
| `servers.read`          | `GET /oauth2/@me/servers`                 |
| `applications.commands` | Marks that your commands may be added     |
| `bot.install`           | Installs the bot in a server the person picks |

## Steps {#steps}

1. Open your application, tab **OAuth2**. Add your **redirect URIs**, one per line, up to 10: `https://` addresses, or `http://localhost` while you develop. They must match exactly.
2. Make a client secret if your program runs on a server. Without one the app is a public client. It is shown once.
3. For every sign-in, make a random `state` and a random `code_verifier`. Send the person to:

```text
/oauth2/authorize
  ?client_id=YOUR_BOT_ID
  &redirect_uri=https%3A%2F%2Fexample.com%2Fcallback
  &response_type=code
  &scope=identify%20servers.read
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_OF_SHA256_OF_VERIFIER
  &code_challenge_method=S256
```

That path is on the Zrzur app. The **URL generator** on the OAuth2 tab builds this address. PKCE (`code_challenge`) is always required, also with a client secret.

4. The person approves. The browser comes back to your redirect URI with `code` and `state`. Check that `state` is yours.
5. Exchange the code within 10 minutes. It works once.

```bash
curl -X POST "https://api.zrzur.com/oauth2/token" \
  -d grant_type=authorization_code \
  -d client_id=YOUR_BOT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=THE_CODE \
  -d redirect_uri=https://example.com/callback \
  -d code_verifier=YOUR_VERIFIER
```

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "scope": "identify servers.read"
}
```

6. Call the API with it:

```bash
curl "https://api.zrzur.com/oauth2/@me" -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Make the PKCE values {#pkce}

`code_verifier` is a random text of 43 to 128 characters. `code_challenge` is the SHA-256 of that text, encoded as base64url without padding. Keep the verifier until step 5, and send only the challenge in the address.

```js
import { createHash, randomBytes } from "node:crypto";

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
```

## Refresh and revoke {#refresh}

Access tokens last 1 hour, refresh tokens 30 days. Each refresh token works once and comes back new. Using an old one ends the whole chain, as that looks like theft.

```bash
curl -X POST "https://api.zrzur.com/oauth2/token" \
  -d grant_type=refresh_token \
  -d client_id=YOUR_BOT_ID \
  -d refresh_token=YOUR_REFRESH_TOKEN

curl -X POST "https://api.zrzur.com/oauth2/revoke" \
  -d client_id=YOUR_BOT_ID \
  -d token=YOUR_REFRESH_TOKEN
```

Both routes take a form, not JSON. They are not in the OpenAPI document. A person can also withdraw your app in their settings.

## Common errors {#errors}

These routes answer `{ "error": "...", "error_description": "..." }`.

| `error`                  | Cause                                                    | Fix                                  |
| ------------------------ | -------------------------------------------------------- | ------------------------------------ |
| `invalid_request`        | A field is missing, such as `code_verifier`              | Send every field                     |
| `invalid_grant`          | The code is unknown, used or expired, or PKCE is wrong   | Start the sign-in again              |
| `invalid_client`         | The client id or secret is wrong (status `401`)          | Check them                           |
| `invalid_scope`          | More scope than the first grant                          | Ask for less                         |
| `unsupported_grant_type` | Another grant type                                       | Use the two above                    |

## Reference {#reference}

```endpoints oauth2

```

## Next {#next}

- [Applications and tokens](/developers/docs/applications)
- [Keeping tokens safe](/developers/docs/security)
