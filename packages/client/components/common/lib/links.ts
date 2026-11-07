/**
 * Google Play listing — off until Zrzur Android exists.
 * Empty disables Play Store upsells that would send users to Revolt/Stoat apps.
 */
export const PLAY_STORE_URL = "";

/**
 * Public download page (desktop + future mobile). Called from
 * ServerList.tsx (rail Get-app button). Existing PLAY_STORE_URL is Android
 * only and empty; this URL is the website download hub. No secrets.
 */
export const DOWNLOAD_PAGE_URL = "https://zrzur.com/download";
