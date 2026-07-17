import { redirect } from "next/navigation";

// Settings became Profile — keep old links (and Instagram OAuth redirects) working.
export default function SettingsRedirect() {
  redirect("/profile");
}
