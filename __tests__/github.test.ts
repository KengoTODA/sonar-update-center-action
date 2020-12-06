import {checkoutSourceRepo, fork} from '../src/github'

const token = process.env.GITHUB_TOKEN
if (!token) {
  throw new Error('No GITHUB_TOKEN env var found')
}

test('fork() does nothing if the forked repo already exists', async () => {
  const resp = await fork(token)
})

test(
  'checkoutSourceRepo() can perform Git commands without error',
  async () => {
    const {owner} = await fork(token)
    await checkoutSourceRepo(token, owner)
  },
  5 * 60 * 1000
)
