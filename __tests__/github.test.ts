import {fork} from '../src/github'

const token = process.env.GITHUB_TOKEN
if (!token) {
  throw new Error('No GITHUB_TOKEN env var found')
}

test('fork() does nothing if the forked repo already exists', async () => {
  const resp = await fork(token)
  console.log(JSON.stringify(resp))
})
