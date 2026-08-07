// A profile is "complete" once the core onboarding fields are filled. We derive
// this from the fields themselves rather than a separate flag — no extra column,
// and the onboarding form makes all of these required. unitPreference always has
// a value (defaults to METRIC), so it can't signal completeness.
export type ProfileFields = {
  height: number | null;
  weight: number | null;
  goalWeight: number | null;
  birthday: Date | null;
  gender: string | null;
  activityLevel: string | null;
};

export function isProfileComplete(profile: ProfileFields | null): boolean {
  return (
    profile != null &&
    profile.height != null &&
    profile.weight != null &&
    profile.goalWeight != null &&
    profile.birthday != null &&
    profile.gender != null &&
    profile.activityLevel != null
  );
}
