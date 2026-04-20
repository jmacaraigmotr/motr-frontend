import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

function xanoGroupsPlugin(): Plugin {
  const backendApisDir = resolve(__dirname, '../backend/apis')
  const outputFile = resolve(__dirname, 'src/api/groups.ts')

  function generate() {
    if (!existsSync(backendApisDir)) {
      console.warn(`[xano-groups] backend APIs directory not found at ${backendApisDir}; skipping group generation`)
      return
    }
    const entries: [string, string][] = []

    for (const dir of readdirSync(backendApisDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue

      let content: string
      try {
        content = readFileSync(resolve(backendApisDir, dir.name, 'api_group.xs'), 'utf-8')
      } catch {
        continue
      }

      const canonical = content.match(/canonical\s*=\s*"([^"]+)"/)?.[1]
      if (canonical) entries.push([dir.name, canonical])
    }

    const lines = entries.map(([key, val]) => `  ${key}: '${val}',`).join('\n')

    writeFileSync(
      outputFile,
      `// AUTO-GENERATED — do not edit manually.\n` +
      `// Re-generated on every \`npm run dev\` or \`npm run build\`.\n` +
      `// Source of truth: backend/apis/*/api_group.xs\n\n` +
      `export const API_GROUPS = {\n${lines}\n} as const\n\n` +
      `export type ApiGroupKey = keyof typeof API_GROUPS\n`,
    )
  }

  return {
    name: 'xano-groups',
    buildStart() {
      generate()
    },
    configureServer(server) {
      if (!existsSync(backendApisDir)) return
      server.watcher.add(backendApisDir)
      server.watcher.on('change', (file) => {
        if (file.endsWith('api_group.xs')) {
          generate()
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [xanoGroupsPlugin(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
