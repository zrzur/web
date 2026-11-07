import {
  ProfileCornerActions,
  ProfileMessage,
  ProfilePrimaryActions,
} from "./ProfileActions";
import { ProfileBadges } from "./ProfileBadges";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileBio } from "./ProfileBio";
import { ProfileCard, ProfileSection, ProfileSkeleton } from "./ProfileCard";
import { ProfileCommands } from "./ProfileCommands";
import { ProfileIdentity } from "./ProfileIdentity";
import { ProfileJoined } from "./ProfileJoined";
import { ProfileNote } from "./ProfileNote";
import { ProfileOwner } from "./ProfileOwner";
import { ProfileRoles } from "./ProfileRoles";
import { ProfileBody, ProfileSections } from "./ProfileSections";
import { ProfileStatus } from "./ProfileStatus";

export const Profile = {
  Actions: ProfilePrimaryActions,
  CornerActions: ProfileCornerActions,
  Message: ProfileMessage,
  Badges: ProfileBadges,
  Banner: ProfileBanner,
  Bio: ProfileBio,
  Body: ProfileBody,
  Card: ProfileCard,
  Note: ProfileNote,
  Section: ProfileSection,
  Skeleton: ProfileSkeleton,
  Sections: ProfileSections,
  Identity: ProfileIdentity,
  Joined: ProfileJoined,
  Roles: ProfileRoles,
  Status: ProfileStatus,
  Owner: ProfileOwner,
  Commands: ProfileCommands,
};
