import * as core from '@actions/core'
import {parseFile, write} from 'promisified-properties'
import {update} from './update'
import {createTopic} from './discourse'
import {
  checkoutSourceRepo,
  commit,
  createBranch,
  createPullRequest,
  fork
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
      core.debug(
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
    const branch = await createBranch(
      githubToken,
      forked.owner,
      forked.repo,
      ref
    )
    core.setOutput('prop-file', propFile)

    const skip = core.getInput('skip-creating-pull-request')
    if (skip) {
      core.info('Skipped creating pull request.')
    } else {
      const prUrl = await createPullRequest(
        githubToken,
        forked.owner,
        branch,
        `${mavenArtifactId} ${publicVersion}`,
        changelogUrl
      )
      core.info(`PR has been created, visit ${prUrl} to confirm.`)
      const skipAnnounce = core.getInput('skip-announcing')
      if (skipAnnounce) {
        core.info('Skipped creating announcement at Discourse.')
      } else {
        const discourseUsername = core.getInput('discourse-username', {
          required: true
        })
        const discourseApiKey = core.getInput('discourse-api-key', {
          required: true
        })
        const sonarCloudUrl = core.getInput('sonar-cloud-url', {required: true})
        const announceBody = `Hi,

        We are announcing new ${mavenArtifactId} ${publicVersion}.
        
        Detailed changelog: ${encodeURI(changelogUrl)}
        Download URL: ${encodeURI(downloadUrl)}
        SonarCloud: ${encodeURI(sonarCloudUrl)}
        PR for metadata: ${encodeURI(prUrl)}
        
        Thanks in advance!
        <!-- this topic was created by sonar-update-center-action -->`
        const topicUrl = await createTopic(
          discourseApiKey,
          discourseUsername,
          mavenArtifactId,
          publicVersion,
          announceBody
        )
        core.info(`Announce has been created, visit ${topicUrl} to confirm.`)
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
