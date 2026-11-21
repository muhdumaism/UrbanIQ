"use client";
export function CitizenSignOut() {
  return (
    <button
      type="button"
      className="btn-outline btn-sm"
      onClick={async () => {
        await fetch("/api/citizen/logout", { method: "POST" });
        window.location.assign("/");
      }}
    >
      Sign out
    </button>
  );
}
