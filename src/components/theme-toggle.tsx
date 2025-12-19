"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg border border-input bg-background opacity-50"></div>
    )
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg border border-input bg-background/50 backdrop-blur-sm">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "light" 
            ? "bg-card text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        aria-label="Light mode"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "system" 
            ? "bg-card text-foreground shadow-sm dark:bg-primary dark:text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        aria-label="System mode"
      >
        <Laptop className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-md transition-all ${
          theme === "dark" 
            ? "bg-primary text-primary-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        aria-label="Dark mode"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  )
}
