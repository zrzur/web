# Feature Matrix
Comparison of implemented features across Zrzur's clients.

| Category | Subcategory | Feature |   | Revite | Frontend | Android | iOS | Priority |
|---|---|---|---|:-:|:-:|:-:|:-:|:-:|
| Authorisation | Login |   | Log into an account | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Create an account | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Send password reset | ✅ | ✅ | ❌ | ✅ | P0 Must |
|   |   |   | Resend email verification | ✅ | ✅ | ❌ | ✅ | P0 Must |
|   |   |   | Confirm password reset | ✅ | ✅ | ❌ | ❌ | Unapplicable |
|   |   |   | Confirm email verification | ✅ | ✅ | ⛔ | ❌ | Unapplicable |
|   |   |   | Confirm account deletion | ✅ | ✅ | ⛔ | ❌ | Unapplicable |
|   | Multi-Factor Authentication |   | Use Password | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Use TOTP | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Use Recovery | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   | Session Lifecycle |   | Spec Compliant | ⛔ | ✅ | ✅ | ❌ | P0 Must |
| Home | General | Home | Launch Page | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Saved Notes | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   | Friends | List Friends & Blocked | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | List Pending Requests | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Accept Requests | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Send Requests | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Remove / Block Users | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Unblock Users | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Quick Actions for Users | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   | User Profile | Show Profile | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Mutual Friends | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Mutual Groups | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Mutual Servers | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   | Groups | List Conversations | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Create Group | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Show Group Members | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Edit Settings | ✅ | ✅ | ✅ | ❌ | P0 Must |
| Servers | Server List |   | User Home | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Unread Conversations | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | List Servers | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Reorder Servers | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Create Server | ✅ | ✅ | ✅ | ❌ | P0 Must |
|   |   |   | Join Server | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Revolt Discover | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   | Roles |   | Coloured Usernames | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   | Users |   | Change Server Avatar | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Change Nickname | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   | Settings | Basic Information | Update Information | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update Icon | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update Banner | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update System Message Targets | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update Categories | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Re-order Channels and Categories | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   | Roles | Create Role | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | List Roles | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Delete Role | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update Role Information | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Update Permissions | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   | Customisation | Create Emoji | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | List Emoji | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Delete Emoji | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   | Users | List Members | ✅ | 🚧 | ❌ | ❌ | P2 Best Effort |
|   |   |   | Set Roles | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Create Invite | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | List Invite | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Delete Invite | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   | Bans | List Bans | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Pardon User | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   | Delete Server |   | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
| Channels | Interface | Channel Information | View Channel Description | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Age Gate | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   | Server | Left Sidebar | Server Information | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | View Server Description | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | List Channels | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Channel Categories | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Channel Icons | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   | Member List | View Members | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Hoisted Roles | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   | Messaging (Text Channel) | Read Messages | Load Recent Messages | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Inline Badges | 🚧 | ✅ | ✅ | 🚧 | P1 Preferred |
|   |   |   | Inline Pronouns | ⛔ | ❌ | ❌ | ❌ | Unapplicable |
|   |   |   | Masquerade | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Show Mentions | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Show @ Role/Everyone/Online | ❌ | ✅ | ❌ | ❌ | PX New Feature |
|   |   |   | Show Channel Links | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Show Server Links | ⛔ | ✅ | ❌ | ❌ | P3 Unimportant |
|   |   |   | Show Message Links | ⛔ | ✅ | ❌ | ❌ | P3 Unimportant |
|   |   |   | Show Replies | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Show Reactions | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Attachments | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Embeds | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | System | ✅ | ✅ | ✅ | 🚧 | P1 Preferred |
|   |   |   | Invites | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   | Quick Actions | Reply | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | React | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Copy Text | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Copy Link | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Copy ID | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Mark as unread | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Quote | ✅ | ⛔ | ⛔ | ⛔ | P3 Unimportant |
|   |   |   | Edit | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Delete | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Pin | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   | Read Chat History | Load Older Messages | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Jump to End | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Jump to Message | ✅ | ✅ | ❌ | ✅ | P2 Best Effort |
|   |   |   | Search Messages | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | View Pinned Messages | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   | Message Composition | Send Messages | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Reply to Messages | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Pick Emoji | ✅ | ✅ | ✅ | ✅ | P2 Best Effort |
|   |   |   | Pick GIF | ❌ | 🚧 | ❌ | ❌ | P3 Unimportant |
|   |   |   | Autocomplete Channel | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Autocomplete User | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Autocomplete Emoji | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Send Files | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Preview files to send | ✅ | ✅ | ❌ | ✅ | P1 Preferred |
|   |   |   | Show messages being sent | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Retry sending failed messages | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Show attachments being sent | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Cancel message being sent | ⛔ | ❌ | ❌ | ❌ | P3 Unimportant |
|   | Talking (Voice Channels) | Base Voice | Voice Chats v2 (LiveKit) | ⛔ | 🚧 | ❌ | ❌ | PX New Feature |
|   |   |   | Screen sharing | ⛔ | 🚧 | ❌ | ❌ | PX New Feature |
|   |   |   | Video (webcam) sharing | ⛔ | 🚧 | ❌ | ❌ | PX New Feature |
|   |   | UX features | Volume control | ⛔ | ❌ | ❌ | ❌ | PX New Feature |
|   |   |   | Ignore blocked users | ⛔ | ❌ | ❌ | ❌ | PX New Feature |
|   |   |   | Hide non-video participants | ⛔ | ❌ | ❌ | ❌ | PX New Feature |
|   |   | Moderation | Disconnect members | ⛔ | ❌ | ❌ | ❌ | PX New Feature |
|   |   |   | Server mute members | ⛔ | ❌ | ❌ | ❌ | PX New Feature |
|   | Settings | Basic Information | Update Information | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Set Icon | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Edit Role Permissions | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Edit Group Permissions | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   | Webhooks | List Webhooks | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   |   | Create Webhook | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   |   | Update Webhook Information | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   |   | Delete Webhook | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   |   | Copy Webhook URLs | ⛔ | ✅ | ❌ | ❌ | PX New Feature |
|   |   | Notifications | Filter all, mention notifications | ✅ | ✅ | ❌ | ❌ | P0 Must |
|   |   |   | Mute channels indefinite or period | 🚧 | ✅ | ❌ | ❌ |   |
| Markdown | RSM |   | Basic Styles | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Code Blocks | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Code Formatting | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Block Quotes | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Spoilers | ✅ | ✅ | ❌ | ❌ | P1 Preferred |
|   |   |   | Links | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Headings | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Tables | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Lists | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Text Formatting Extensions | ❌ | 🚧 | ❌ | ❌ | P2 Best Effort |
|   |   |   | Inline Math (KaTeX) | ✅ | ✅ | ⛔ | ⛔ | Unapplicable |
|   |   |   | Block Math (KaTeX) | ✅ | ✅ | ❌ | ❌ | P2 Best Effort |
|   |   |   | Timestamps | ✅ | ✅ | ✅ | ❌ | P2 Best Effort |
|   |   |   | Unicode Emoji | ❌ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   |   | Custom Emoji | ✅ | ✅ | ✅ | 🚧 | P1 Preferred |
| User Safety | Reporting |   | Report Message | ✅ | ✅ | ✅ | ✅ | P0 Must |
|   |   |   | Report Server | ✅ | ✅ | ✅ | ❌ | P0 Must |
|   |   |   | Report User | ✅ | ✅ | ✅ | ❌ | P0 Must |
| Settings | User | Account | Update Username | ✅ | ✅ | ❌ | ✅ | P1 Preferred |
|   |   |   | Update Email | ✅ | ✅ | ❌ | ✅ | P1 Preferred |
|   |   |   | Update Password | ✅ | ✅ | ❌ | ✅ | P1 Preferred |
|   |   |   | Configure MFA Recovery | ✅ | ✅ | ❌ | ✅ | P2 Best Effort |
|   |   |   | Configure MFA TOTP | ✅ | ✅ | ❌ | ✅ | P2 Best Effort |
|   |   |   | Disable Account | ✅ | ✅ | ❌ | ✅ | P0 Must |
|   |   |   | Delete Account | ✅ | ✅ | ❌ | ✅ | P0 Must |
|   |   | Profile | Update Avatar | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Update Background | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   |   | Update Bio | ✅ | ✅ | ✅ | ❌ | P1 Preferred |
|   |   | Sessions | List Sessions | ✅ | ✅ | ✅ | ✅ | P2 Best Effort |
|   |   |   | Delete Session | ✅ | ✅ | ✅ | ✅ | P2 Best Effort |
|   |   |   | Log out all other sessions | ✅ | ✅ | ✅ | ❌ | P2 Best Effort |
|   | Client | Appearance | Customise Theme | ✅ | ✅ | ✅ | ✅ | P2 Best Effort |
|   |   |   | Customise Font | ✅ | ✅ | ⛔ | ⛔ | P3 Unimportant |
|   |   |   | Customise Emoji Pack | ✅ | ✅ | ⛔ | ⛔ | P3 Unimportant |
|   |   | Notifications | Desktop | ✅ | 🚧 | ⛔ | ⛔ | P0 Must |
|   |   |   | Web Push | ✅ | ⛔ | N/A | N/A | P0 Must |
|   |   |   | Desktop Native Push | ⛔ | ⛔ | ⛔ | ⛔ | P3 Unimportant |
|   |   |   | Mobile Native Push | ⛔ | ⛔ | ✅ | ✅ | P0 Must |
|   |   | Language |   | ✅ | 🚧 | ✅ | ✅ | P2 Best Effort |
|   |   | Settings Sync |   | ✅ | ✅ | ✅ | ❌ | P0 Must |
|   |   | Desktop | App | ✅ | ❌ | N/A | N/A | P1 Preferred |
|   |   |   | Start with Computer | ✅ | ❌ | N/A | N/A | P2 Best Effort |
|   |   |   | Minimise to Tray | ✅ | ❌ | N/A | N/A | P2 Best Effort |
|   | Revolt | Bots | Create Bot | ✅ | ✅ | ❌ | ✅ | P3 Unimportant |
|   |   |   | List Bots | ✅ | ✅ | ❌ | ✅ | P3 Unimportant |
|   |   |   | Update Information | ✅ | ✅ | ❌ | ❌ | P3 Unimportant |
|   |   |   | Update Icon | ✅ | ✅ | ❌ | ❌ | P3 Unimportant |
|   |   |   | Invite to Server / Group | ✅ | ✅ | ❌ | ❌ | P3 Unimportant |
|   | Misc | Feedback Information |   | ✅ | ✅ | ✅ | ✅ | P1 Preferred |
|   |   | Changelogs |   | ✅ | ❌ | ✅ | ❌ | P2 Best Effort |
|   |   | Source code |   | ✅ | ✅ | ✅ | ✅ | Unapplicable |
|   |   | Update Indicator |   | ✅ | ❌ | N/A | N/A | P0 Must |
|   |   | Log out |   | ✅ | ✅ | ✅ | ✅ | P0 Must |

<style>#content main {max-width: unset !important;}</style>
