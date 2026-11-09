import { JSX } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { CodeBlock } from "./CodeBlock";
import { exampleSource } from "./examples";
import { Note } from "./Markdown";

const RUN = `mkdir my-bot
cd my-bot
# save hello-raw.mjs here, then:
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
node hello-raw.mjs`;

/**
 * First steps. A component rather than a Markdown page, because it embeds
 * the tested example between translated steps.
 */
export function GettingStarted(props: { onNavigate: (href: string) => void }) {
  const link = (href: string, children: JSX.Element) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        props.onNavigate(href);
      }}
    >
      {children}
    </a>
  );

  return (
    <>
      <h1 id="getting-started">
        <Trans>Start your bot</Trans>
      </h1>
      <p>
        <Trans>
          In about ten minutes you will have a bot that answers a slash command
          in your own test server. You need a Zrzur account, a server of your
          own and Node.js 22 or newer. There is nothing to install.
        </Trans>
      </p>

      <h2 id="create-an-application">
        <Trans>1. Create an application</Trans>
      </h2>
      <p>
        <Trans>
          In the Developer Portal, choose New application, give it a name and
          choose Create. The application comes with a bot account.
        </Trans>{" "}
        {link("/developers", <Trans>Open My applications</Trans>)}
      </p>

      <h2 id="copy-the-token">
        <Trans>2. Copy the token</Trans>
      </h2>
      <p>
        <Trans>
          The token appears once, right after you create the application. Copy
          it now. Whoever has the token controls the bot.
        </Trans>
      </p>
      <Note>
        <p>
          <Trans>
            Keep the token in an environment variable or a secret store. Never
            put it in code, in a repository or in a screenshot. If it leaks,
            reset it at once.
          </Trans>
        </p>
      </Note>

      <h2 id="install-the-bot">
        <Trans>3. Install the bot in a test server</Trans>
      </h2>
      <p>
        <Trans>
          On the Overview tab of your application choose Add to a server, and
          pick a server where you have Manage Server.
        </Trans>{" "}
        {link(
          "/developers/docs/applications#install",
          <Trans>More about installing</Trans>,
        )}
      </p>
      <p>
        <Trans>
          Do this before the first run. A bot that is not in the server gets
          403 MissingPermission for its channels, which looks like a missing
          permission.
        </Trans>{" "}
        {link(
          "/developers/docs/errors#not-installed",
          <Trans>Is the bot in that server?</Trans>,
        )}
      </p>

      <h2 id="get-the-sdk">
        <Trans>4. No library needed</Trans>
      </h2>
      <p>
        <Trans>
          Node.js 22 has everything built in: the API is plain HTTP and
          WebSocket. The official library, @zrzur/sdk, cannot be downloaded yet.
        </Trans>{" "}
        {link("/developers/docs/sdk", <Trans>About the SDKs</Trans>)}
      </p>

      <h2 id="first-bot">
        <Trans>5. Write your first bot</Trans>
      </h2>
      <p>
        <Trans>
          Save this as hello-raw.mjs in an empty folder. It registers /hello and
          answers it.
        </Trans>
      </p>
      <CodeBlock
        code={exampleSource("hello-raw.mjs") ?? ""}
        language="javascript"
        title="hello-raw.mjs"
      />

      <h2 id="run-it">
        <Trans>6. Run it</Trans>
      </h2>
      <p>
        <Trans>Set the token, then start the bot:</Trans>
      </p>
      <CodeBlock code={RUN} language="bash" title="Terminal" />
      <p>
        <Trans>
          When the terminal shows ready, type /hello in a channel of your test
          server. The bot answers Hello from Zrzur!
        </Trans>
      </p>

      <h2 id="gateway">
        <Trans>7. Receive events</Trans>
      </h2>
      <p>
        <Trans>
          The bot keeps a WebSocket connection to the gateway. Commands, button
          clicks, new messages and member changes arrive there as events.
        </Trans>{" "}
        {link("/developers/docs/gateway", <Trans>Gateway</Trans>)}
      </p>

      <h2 id="deploy">
        <Trans>8. Build a real bot</Trans>
      </h2>
      <p>
        <Trans>
          This bot stops when the line drops and knows only one command. The
          complete bot has commands, buttons, a form, moderation, saved data,
          error handling and reconnects, in one file.
        </Trans>{" "}
        {link(
          "/developers/docs/tutorial-full-bot",
          <Trans>Build a complete bot</Trans>,
        )}
      </p>

      <h2 id="next-steps">
        <Trans>Next steps</Trans>
      </h2>
      <ul>
        <li>
          {link("/developers/docs/commands", <Trans>Slash commands</Trans>)}
        </li>
        <li>
          {link(
            "/developers/docs/components",
            <Trans>Buttons, menus and forms</Trans>,
          )}
        </li>
        <li>{link("/developers/docs/errors", <Trans>Errors</Trans>)}</li>
        <li>
          {link("/developers/docs/rate-limits", <Trans>Rate limits</Trans>)}
        </li>
      </ul>
    </>
  );
}
