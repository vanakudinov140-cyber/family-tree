const AVATAR_PALETTES = [
  {
    from: "#E8DFD0",
    to: "#D4E0D8",
    foreground: "#2D4A3E",
  },
  {
    from: "#EDE4D4",
    to: "#D9E5DC",
    foreground: "#1B4332",
  },
  {
    from: "#E2DDD3",
    to: "#D8E2DA",
    foreground: "#3D5A4C",
  },
  {
    from: "#F0E8DA",
    to: "#DCE6DF",
    foreground: "#2F4F44",
  },
  {
    from: "#E9E2D6",
    to: "#D5DFD7",
    foreground: "#35594A",
  },
];

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
}

export function getInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.trim().charAt(0);
  const lastInitial = lastName.trim().charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase();
}

export function getAvatarPalette(id: string) {
  return AVATAR_PALETTES[hashString(id) % AVATAR_PALETTES.length];
}
