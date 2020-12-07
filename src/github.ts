import {debug} from '@actions/core'
import {exec} from '@actions/exec'
import {getOctokit} from '@actions/github'
import {tmpdir} from 'os'
import {mkdtemp, readFile} from 'fs'
import {promisify} from 'util'
import {join} from 'path'

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(void 0)
    }, ms)
  })
}

function generateRandomBranchName(): string {
  const random = Math.floor(Math.random() * 2147483647)
  return `sonar-update-center-action-${random}`
}

/**
 * Checkout the default branch with the SonarSource/sonar-update-center-properties repository
 */
export async function checkoutSourceRepo(
  token: string,
  owner: string
): Promise<string> {
  const rootDir = await promisify(mkdtemp)(
    join(tmpdir(), 'sonar-update-center-action-')
  )

  await exec(
    'git',
    [
      'clone',
      `https://${token}@github.com/${owner}/sonar-update-center-properties.git`,
      '.'
    ],
    {
      cwd: rootDir
    }
  )
  await exec(
    'git',
    [
      'remote',
      'add',
      'sonarsource',
      `https://${token}@github.com/SonarSource/sonar-update-center-properties.git`
    ],
    {
      cwd: rootDir
    }
  )
  await exec('git', ['fetch', 'sonarsource'], {
    cwd: rootDir
  })
  // TODO get the name of default branch dynamically
  await exec('git', ['push', 'origin', 'sonarsource/master:master'], {
    cwd: rootDir
  })
  return rootDir
}

/**
 *
 * @param token
 * @returns owner and repo of the forked repository
 */
export async function fork(
  token: string
): Promise<{owner: string; repo: string}> {
  const octokit = getOctokit(token)
  debug(`Forking the SonarSource/sonar-update-center-properties repository...`)
  await octokit.repos.createFork({
    owner: 'SonarSource',
    repo: 'sonar-update-center-properties'
  })
  debug(
    `Forking finished. Confirming the progress of fork process up to five minutes...`
  )

  const authenticated = await octokit.users.getAuthenticated()
  debug(
    `Expecting that the forked repository exists as ${authenticated.data.login}/sonar-update-center-properties.`
  )
  const startTime = Date.now()
  let count = 1
  // wait while GitHub is making the fork up to 5 minutes
  while (Date.now() - startTime < 5 * 60 * 1000) {
    debug(`Trying to check existence of the forked repo (Time: ${count})...`)
    try {
      const resp = await octokit.repos.get({
        owner: authenticated.data.login,
        repo: 'sonar-update-center-properties'
      })
      if (
        resp.data.fork &&
        resp.data.source?.full_name ===
          'SonarSource/sonar-update-center-properties'
      ) {
        debug(`The forked repository has been found successfully.`)
      } else {
        throw new Error(
          `The ${authenticated.data.login}/sonar-update-center-properties repository is not forked from SonarSource/sonar-update-center-properties`
        )
      }

      break
    } catch (error) {
      if (error.name === 'HttpError' && error.status === 404) {
        count++
        await wait(10 * 1000)
        continue
      }

      throw error
    }
  }

  return {
    owner: authenticated.data.login,
    repo: 'sonar-update-center-properties'
  }
}

export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<void> {
  const branch = generateRandomBranchName()
  debug(`creating a branch refs/heads/${branch} with specified sha: ${sha}`)
  const octokit = getOctokit(token)
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha
  })
}

export async function commit(
  token: string,
  owner: string,
  repo: string,
  path: string,
  rootDir: string,
  message: string,
  refOrSha: string
): Promise<string> {
  const octokit = getOctokit(token)
  let commit_sha = refOrSha
  if (refOrSha.startsWith('heads/')) {
    debug(`Finding sha of the parent commit with ref ${refOrSha}...`)
    commit_sha = (await octokit.git.getRef({owner, repo, ref: refOrSha})).data
      .object.sha
  }
  const content = await promisify(readFile)(join(rootDir, path), {
    encoding: 'utf-8'
  })
  debug('Creating a blob...')
  const blob = await octokit.git.createBlob({
    owner,
    repo,
    content,
    encoding: 'utf-8'
  })
  debug(`Creating a tree with the base tree ${commit_sha}...`)
  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: commit_sha,
    tree: [
      {
        path,
        mode: '100644',
        type: 'blob',
        sha: blob.data.sha
      }
    ]
  })
  debug(
    `Creating a commit with tree ${tree.data.sha} and parent ${commit_sha}...`
  )
  const newCommitSha = (
    await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.data.sha,
      parents: [commit_sha]
    })
  ).data.sha
  debug(`Created a commit as ${newCommitSha}`)
  return newCommitSha
}
