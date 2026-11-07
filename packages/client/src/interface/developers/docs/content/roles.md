# Roles and permissions

## How permissions are calculated

1. The server owner can do everything.
2. Otherwise start from the server's **default permissions** (`@everyone`).
3. Add the permissions of every role the member has (`allow`), then remove what roles deny, from the lowest to the highest ranked role.
4. In a channel, apply the channel's default override, then the role overrides, the same way.
5. A member in **timeout** keeps only View Channel and Read Message History.

Permissions are a 64-bit number; each permission is one bit. Use `BigInt` in JavaScript: a plain number cannot hold every bit exactly.

```js
const SEND_MESSAGE = 1n << 22n;
const canSend =
  (BigInt(interaction.user_permissions_string) & SEND_MESSAGE) === SEND_MESSAGE;
```

Every interaction tells you the permissions of the person who used it (`user_permissions_string`) and of your bot (`app_permissions_string`) in that channel, so you rarely need to compute them yourself.

## Permission strings {#permission-strings}

Endpoints in this reference name permissions such as Timeout Members. In an error the same permission is written `TimeoutMembers`, the first column of the table below. Add values to send several: Kick Members (`64`) and Ban Members (`128`) are `192`.

## Threads and forums {#threads-and-forums}

`CreateThreads`, `SendMessageInThreads` and `CreateForumPosts` are on for `@everyone` by default. Deny them on a role, or on a channel, and those people can only read. They are read on the parent channel, on top of Send Messages.

## Ranking {#ranking}

Roles have a **rank**; a lower number ranks higher. A bot can only edit, give, take, kick, ban or time out members and roles that rank **below its own highest role**. Otherwise the server answers `NotElevated`. Ask server admins to move your bot's role up if your bot moderates.

## Permission bits {#permission-bits}

```permissions

```

## Reference

```endpoints roles

```
