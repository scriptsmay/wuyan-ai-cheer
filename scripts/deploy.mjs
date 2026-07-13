// Cross-shell CloudBase Web deploy.
// Sets MSYS_NO_PATHCONV so Git Bash's MSYS layer stops rewriting the leading
// "/" in --deploy-path into "C:/Program Files/Git/...". On cmd/PowerShell there
// is no such translation, and the var is simply ignored — safe everywhere.
//
// install/build commands and framework come from cloudbaserc.json
// (installCommand/buildCommand empty => skip cloud build, upload local dist).
import { spawnSync } from 'node:child_process'

const args = [
  'app',
  'deploy',
  'wuyan-ai-cheer',
  '--env-id',
  'trial-sh-d1gqznm4577d6a062',
  '--output-dir',
  './dist',
  '--deploy-path',
  '/',
  '--force'
]

const result = spawnSync('tcb', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, MSYS_NO_PATHCONV: '1' }
})

process.exit(result.status ?? 1)
