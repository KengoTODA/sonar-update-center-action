import nock from 'nock'
import {
  dropAdditionalVer,
  replacePatch,
  searchLatestMinorVersion
} from '../src/sonarqube'
import releases from './fixtures/sonarqube-releases.json'

const token = process.env.GITHUB_TOKEN
if (!token) {
  throw new Error('No GITHUB_TOKEN env var found')
}

test('dropAdditionalVer() drops the trailing version after the patch version', () => {
  expect(dropAdditionalVer('8.5.1.38104')).toBe('8.5.1')
})

test('replacePatch() replaces the patch version with wildcard', () => {
  expect(replacePatch('1.0.0')).toBe('1.0.*')
})

test('searchLatestMinorVersion()', async () => {
  nock.disableNetConnect()
  const scope = nock('https://api.github.com')
    .get('/repos/SonarSource/sonarqube/releases')
    .reply(200, releases)
  expect(await searchLatestMinorVersion(token)).toBe('8.5.*')
})
