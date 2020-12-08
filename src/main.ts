import * as core from '@actions/core'
import {parseFile, write} from 'promisified-properties'
import {update} from './update'
import {checkoutSourceRepo, commit, createBranch, fork} from './github'
import {join} from 'path'
import {createHash} from 'crypto'
import {readFile} from 'fs'
import {promisify} from 'util'
import {debug} from 'console'

async function md5sum(path: string): Promise<string> {
  return createHash('md5')
    .update(await promisify(readFile)(path, 'utf-8'), 'utf8')
    .digest('hex')
}

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token', {required: true})
    const forked = await fork(githubToken)
    const rootDir = await checkoutSourceRepo(githubToken, forked.owner)
    const path = core.getInput('prop-file', {
      required: true
    })
    if (path.includes('/') || path.includes('\\')) {
      throw new Error(
        'prop-file input should be file name without "/" nor "\\"'
      )
    }
    const propFile = join(rootDir, path)

    const description = core.getInput('description', {
      required: true
    })
    const minimalSupportedVersion = core.getInput(
      'minimal-supported-sq-version',
      {required: true}
    )
    const latestSupportedVersion = core.getInput('latest-supported-sq-version')
    const changelogUrl = core.getInput('changelog-url', {required: true})
    const downloadUrl = core.getInput('download-url', {required: true})
    const publicVersion = core.getInput('public-version', {required: true})
    if (!publicVersion || publicVersion.includes(',')) {
      throw new Error(`Unsupproted publicVersion found: ${publicVersion}`)
    }

    const sourceHash = md5sum(propFile)
    const prop = await parseFile(propFile)
    await write(prop, propFile)
    const formattedHash = md5sum(propFile)
    let ref = 'heads/master'
    if (sourceHash !== formattedHash) {
      debug(
        'This is the first run for this sonarqube plugin, so commit the format change first to ease the PR review...'
      )
      ref = await commit(
        githubToken,
        forked.owner,
        forked.repo,
        path,
        rootDir,
        `format the properties file for automation`,
        ref
      )
    }
    const mavenArtifactId = prop.get('defaults.mavenArtifactId')
    if (!mavenArtifactId) {
      throw new Error(
        'No defaults.mavenArtifactId found in the properties file'
      )
    }

    const updatedProp = await update(
      githubToken,
      prop,
      description,
      publicVersion,
      `[${minimalSupportedVersion},${latestSupportedVersion}]`,
      changelogUrl,
      downloadUrl
    )
    await write(updatedProp, propFile)

    ref = await commit(
      githubToken,
      forked.owner,
      forked.repo,
      path,
      rootDir,
      `update properties file to release ${mavenArtifactId} ${publicVersion}`,
      ref
    )
    createBranch(githubToken, forked.owner, forked.repo, ref)
    const skip = core.getInput('skip-creating-pull-request')
    if (!skip) {
      // TODO create a PR, and post to the SQ forum
    }
    core.setOutput('prop-file', propFile)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
