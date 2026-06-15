import hasanAliProfile from "../assets/hasan-ali-profile.jpeg";

function buildDisplayName(user) {
  if (!user) return "";
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`.trim();
  }
  return user.first_name || user.last_name || user.username || user.email?.split("@")[0] || "";
}

export function getProfileAvatarSrc(user) {
  const displayName = buildDisplayName(user).trim().toLowerCase();
  if (displayName === "hasan ali") {
    return hasanAliProfile;
  }
  return null;
}
