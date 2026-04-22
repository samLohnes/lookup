import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      {
        ...reactRefresh.configs.vite,
        rules: {
          'react-refresh/only-export-components': [
            'error',
            {
              allowConstantExport: true,
              // Radix UI re-exports: these are components but the plugin can't
              // infer that from bare `export const X = Primitive.Y` assignments.
              allowExportNames: [
                'Dialog', 'DialogTrigger', 'DialogPortal', 'DialogClose',
                'Popover', 'PopoverTrigger',
              ],
            },
          ],
        },
      },
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
