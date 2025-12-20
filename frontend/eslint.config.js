//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: ['.output/**', 'dist/**', 'routeTree.gen.ts', 'eslint.config.js', 'prettier.config.js'],
  },
  ...tanstackConfig,
]
