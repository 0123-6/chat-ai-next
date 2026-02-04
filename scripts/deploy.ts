import {execSync} from 'child_process'
import {cpSync, existsSync, rmSync} from 'fs'
import {resolve} from 'path'

// 配置
const config = {
  server: 'jiangjiang0123.cn',
  user: 'root',
  remotePath: '/var/front-end/next',
  pm2AppName: 'next前端',
}

// 颜色输出
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[✓]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[✗]\x1b[0m ${msg}`),
  step: (step: number, total: number, msg: string) =>
    console.log(`\x1b[33m[${step}/${total}]\x1b[0m ${msg}`),
}

// 执行命令（静默模式）
function exec(cmd: string, cwd?: string): boolean {
  try {
    execSync(cmd, {cwd, stdio: 'pipe', encoding: 'utf-8'})
    return true
  } catch {
    return false
  }
}

// 执行命令（显示输出）
function execWithOutput(cmd: string, cwd?: string): boolean {
  try {
    execSync(cmd, {cwd, stdio: 'inherit', encoding: 'utf-8'})
    return true
  } catch {
    return false
  }
}

const sshTarget = `${config.user}@${config.server}`

// SSH 执行远程命令
function sshExec(cmd: string): boolean {
  return exec(`ssh -o StrictHostKeyChecking=no ${sshTarget} "${cmd.replace(/"/g, '\\"')}"`)
}

// SCP 上传文件（显示进度）
function scpUpload(localPath: string, remotePath: string): boolean {
  // -C 压缩传输
  const scpCmd = `scp -o StrictHostKeyChecking=no -C "${localPath}" ${sshTarget}:"${remotePath}"`
  return execWithOutput(scpCmd)
}

async function deploy() {
  const totalSteps = 6
  const rootDir = resolve(__dirname, '..')
  const nextDir = resolve(rootDir, '.next')
  const standaloneDir = resolve(nextDir, 'standalone')
  const staticDir = resolve(nextDir, 'static')
  const standaloneStaticDir = resolve(standaloneDir, '.next', 'static')
  const tarFile = resolve(rootDir, 'deploy.tar.gz')

  console.log('\n========== 开始部署 ==========\n')

  // 步骤 1: 构建
  log.step(1, totalSteps, '构建项目...')
  if (!execWithOutput('pnpm run build', rootDir)) {
    log.error('构建失败')
    process.exit(1)
  }
  log.success('构建完成')

  // 步骤 2: 复制 static 文件夹
  log.step(2, totalSteps, '复制静态资源...')
  if (!existsSync(staticDir)) {
    log.error('.next/static 文件夹不存在')
    process.exit(1)
  }
  try {
    cpSync(staticDir, standaloneStaticDir, {recursive: true})
    log.success('静态资源复制完成')
  } catch (e) {
    log.error(`复制失败: ${e}`)
    process.exit(1)
  }

  // 步骤 3: 打包压缩（加速上传）
  log.step(3, totalSteps, '打包压缩文件...')
  const tarCmd = `tar -czf "${tarFile}" -C "${standaloneDir}" .`
  if (!exec(tarCmd)) {
    log.error('打包失败')
    process.exit(1)
  }
  log.success('打包完成')

  // 步骤 4: 上传压缩包
  log.step(4, totalSteps, '上传到服务器（输入密码后等待上传）...')
  if (!scpUpload(tarFile, '/tmp/deploy.tar.gz')) {
    log.error('上传失败')
    rmSync(tarFile, {force: true})
    process.exit(1)
  }
  rmSync(tarFile, {force: true}) // 删除本地压缩包
  log.success('上传完成')

  // 步骤 5: 服务器解压部署
  log.step(5, totalSteps, '服务器解压部署...')
  const deployCmd = `rm -rf ${config.remotePath} && mkdir -p ${config.remotePath} && tar -xzf /tmp/deploy.tar.gz -C ${config.remotePath} && rm /tmp/deploy.tar.gz`
  if (!sshExec(deployCmd)) {
    log.error('服务器部署失败')
    process.exit(1)
  }
  log.success('服务器部署完成')

  // 步骤 6: 重启服务
  log.step(6, totalSteps, '重启 PM2 服务...')
  if (!sshExec(`pm2 reload '${config.pm2AppName}'`)) {
    log.error('PM2 重启失败')
    process.exit(1)
  }
  log.success('服务已重启')

  console.log('\n========== 部署完成 ==========\n')
}

deploy().catch(e => {
  log.error(`部署失败: ${e}`)
  process.exit(1)
})
