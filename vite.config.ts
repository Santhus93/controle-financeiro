import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em produção (GitHub Pages) o app fica em https://santhus93.github.io/controle-financeiro/
// Em desenvolvimento continua em http://localhost:5173/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/controle-financeiro/' : '/',
}))
