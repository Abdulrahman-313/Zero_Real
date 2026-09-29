/** Clerk theming to match the Zero Real palette, radius and fonts. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1C7C6C",
    colorText: "#16222D",
    colorTextSecondary: "#52606D",
    colorBackground: "#FAFAF7",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#16222D",
    colorDanger: "#B42318",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-plex)",
  },
  elements: {
    card: "bg-paper border border-line shadow-xl",
    headerTitle: "font-display text-navy",
    formButtonPrimary: "bg-teal hover:bg-teal-dark text-white",
    footerActionLink: "text-teal hover:text-teal-dark",
  },
} as const;
