import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme ?? "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.colorMode = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("link-hub-theme", theme);
    } catch {}
  }, [theme]);
  return { theme, setTheme };
}
