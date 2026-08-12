/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Civic tech theme: dark mode primary, sleek gray neutral basis, vivid warning/emergency colors
        govDark: "#0f172a",
        govMuted: "#1e293b",
        govBorder: "#334155",
        emergencyRed: "#e11d48", // Vivid primary red reserved strictly for emergencies
        warningOrange: "#ea580c" // Potholes/garbage warnings
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"]
      }
    },
  },
  plugins: [],
}
