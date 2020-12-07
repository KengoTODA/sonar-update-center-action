import * as core from '@actions/core'
import {parseFile, write} from 'promisified-properties'
import {update} from './update'
import {checkoutSourceRepo, commitAndPush, fork} from './github'
import {join} from 'path'

async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token')
    const forked = await fork(githubToken)
    const {branch, rootDir} = await checkoutSourceRepo(
      githubToken,
      forked.owner
    )
    const propFile = join(rootDir, core.getInput('prop-file'))

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

    const prop = await parseFile(propFile)
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
      propFile,
      rootDir,
      branch,
      mavenArtifactId,
      publicVersion
    )
    const skip = core.getInput('skip-creating-pull-request')
    if (!skip) {
      // TODO create a PR, and post to the SQ forum
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
