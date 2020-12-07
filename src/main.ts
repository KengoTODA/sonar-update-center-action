import * as core from '@actions/core'
import {parseFile, write} from 'promisified-properties'
import {update} from './update'
import {
  checkoutSourceRepo,
  commitAndPush,
  fork,
  generateRandomBranchName
} from './github'
import {join} from 'path'
import {createHash} from 'crypto'
import {readFile} from 'fs'
import {promisify} from 'util'

async function md5sum(path: string): Promise<string> {
  return createHash('md5')
    .update(await promisify(readFile)(path, 'utf-8'), 'utf8')
    .digest('hex')
}

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token')
    const forked = await fork(githubToken)
    const rootDir = await checkoutSourceRepo(githubToken, forked.owner)
    // TODO make sure that the input does not contains file-separator to avoid directory traversal
    const path = core.getInput('prop-file')
    const propFile = join(rootDir, path)

    const description = core.getInput('description')
    const minimalSupportedVersion = core.getInput(
      'minimal-supported-sq-version'
    )
    const latestSupportedVersion = core.getInput('latest-supported-sq-version')
    const changelogUrl = core.getInput('changelog-url')
    const downloadUrl = core.getInput('download-url')
    const publicVersion = core.getInput('public-version')
    if (!publicVersion || publicVersion.includes(',')) {
      throw new Error(`Unsupproted publicVersion found: ${publicVersion}`)
    }

    const sourceHash = md5sum(propFile)
    const prop = await parseFile(propFile)
    await write(prop, propFile)
    const formattedHash = md5sum(propFile)
    const branch = generateRandomBranchName()
    if (sourceHash !== formattedHash) {
      // this is the first usage, so commit the format change to ease PR review
      await commitAndPush(
        githubToken,
        forked.owner,
        forked.repo,
        path,
        rootDir,
        `format the properties file for automation`,
        branch
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

    await commitAndPush(
      githubToken,
      forked.owner,
      forked.repo,
      path,
      rootDir,
      `update properties file to release ${mavenArtifactId} ${publicVersion}`,
      branch
    )
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
