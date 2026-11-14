# Rollen und Berechtigungen

## So werden Berechtigungen berechnet {#how-permissions-are-calculated}

1. Der Servereigentümer darf alles. Ebenso ein Mitglied, dem seine Rollen oder die Standardberechtigungen des Servers **Administrator** geben: Keine Kanaleinstellung und kein Timeout nimmt ihm etwas, und ein Kanal kann niemanden zum Administrator machen.
2. Sonst beginne bei den **Standardberechtigungen** des Servers (`@everyone`).
3. Addiere die Berechtigungen jeder Rolle des Mitglieds (`allow`), dann entferne, was Rollen verweigern, von der niedrigsten zur höchsten Rolle.
4. Wende in einem Kanal die Standard-Überschreibung des Kanals an, dann die der Rollen, auf dieselbe Art.
5. Ein Mitglied im **Timeout** behält nur „Kanal sehen“ und „Ältere Nachrichten lesen“.

Berechtigungen sind eine 64-Bit-Zahl; jede Berechtigung ist ein Bit. Nimm in JavaScript `BigInt`: Eine einfache Zahl kann nicht jedes Bit genau halten.

@@0

Jede Interaktion nennt dir die Berechtigungen der Person (`user_permissions_string`) und deines Bots (`app_permissions_string`) in diesem Kanal, du musst sie also selten selbst berechnen.

## Berechtigungsnamen {#permission-strings}

Endpunkte in dieser Referenz nennen Berechtigungen wie „Mitglieder Timeouten“. In einem Fehler steht dieselbe Berechtigung als `TimeoutMembers`, die erste Spalte der Tabelle unten. Addiere Werte, um mehrere zu senden: „Mitglieder kicken“ (`64`) und „Mitglieder sperren“ (`128`) ergeben `192`.

## Threads und Foren {#threads-and-forums}

`CreateThreads`, `SendMessageInThreads` und `CreateForumPosts` sind für `@everyone` standardmäßig an. Verbiete sie an einer Rolle oder einem Kanal, dann können diese Personen nur lesen. Sie werden am übergeordneten Kanal gelesen, zusätzlich zu Nachrichten senden.

## Rang {#ranking}

Rollen haben einen **Rang**; eine kleinere Zahl steht höher. Ein Bot kann nur Mitglieder und Rollen unter **seiner höchsten Rolle** bearbeiten, vergeben, entziehen, kicken, bannen oder mit Timeout belegen. Sonst antwortet der Server `NotElevated`. Bitte die Admins, die Rolle deines Bots höher zu setzen, wenn er moderiert.

## Berechtigungsbits {#permission-bits}

@@1

## Referenz {#reference}

@@2
