import {createServer} from 'http'
import {hostname} from 'os'
import open from 'open'
import {generateKeyPairSync, privateDecrypt} from 'crypto'
import url from 'url'

const {publicKey, privateKey} = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: 'top secret'
  }
})
const server = createServer((req, res) => {
  const queryObject = url.parse(req.url!, true).query
  const encodedKey = queryObject.payload
  if (encodedKey === undefined) {
    res.end()
  } else {
    console.log(`encoded key is ${encodedKey}`)
    // TODO convert string to Buffer
    //  privateDecrypt(privateKey, encodedKey)
  }
})
function buildUrl(port: number, publicKey: string): string {
  const redirectUrl = `http://localhost:${port}/callback`
  const url = new URL('https://community.sonarsource.com//user-api-key/new')

  url.searchParams.append('auth_redirect', redirectUrl)
  url.searchParams.append('application_name', 'sonar-update-center-action')
  url.searchParams.append('client_id', hostname())
  url.searchParams.append('scopes', 'write')
  url.searchParams.append('public_key', publicKey)
  url.searchParams.append('nonce', '1')
  return url.href
}
server.listen(0, async () => {
  const addressInfo = server.address()
  if (addressInfo === null || typeof addressInfo === 'string') {
    throw new Error(`Unexpected address info: ${addressInfo}`)
  } else {
    const port = addressInfo.port
    await open(buildUrl(port, publicKey))
  }
})
