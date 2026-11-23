import { useClient } from "@revolt/client";

import { botDmsOn } from "./botLinks";

/** Whether bots can be started in DMs on this server (`features.bot_dms`) */
export function useBotDms() {
  const client = useClient();
  return () => botDmsOn(client());
}
