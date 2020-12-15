"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const os_1 = require("os");
const open_1 = __importDefault(require("open"));
const crypto_1 = require("crypto");
const url_1 = __importDefault(require("url"));
const { publicKey, privateKey } = crypto_1.generateKeyPairSync('rsa', {
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
});
const server = http_1.createServer((req, res) => {
    const queryObject = url_1.default.parse(req.url, true).query;
    const encodedKey = queryObject.payload;
    if (encodedKey === undefined) {
        res.end();
    }
    else {
        console.log(`encoded key is ${encodedKey}`);
        // TODO convert string to Buffer
        //  privateDecrypt(privateKey, encodedKey)
    }
});
function buildUrl(port, publicKey) {
    const redirectUrl = `http://localhost:${port}/callback`;
    const url = new URL('https://meta.discourse.org/user-api-key/new');
    url.searchParams.append('auth_redirect', redirectUrl);
    url.searchParams.append('application_name', 'sonar-update-center-action');
    url.searchParams.append('client_id', os_1.hostname());
    url.searchParams.append('scopes', 'write');
    url.searchParams.append('public_key', publicKey);
    url.searchParams.append('nonce', '1');
    console.log(`redirect URL is ${url.href}`);
    return url.href;
}
server.listen(0, () => __awaiter(void 0, void 0, void 0, function* () {
    const addressInfo = server.address();
    if (addressInfo === null || typeof addressInfo === 'string') {
        throw new Error(`Unexpected address info: ${addressInfo}`);
    }
    else {
        const port = addressInfo.port;
        const url = buildUrl(port, publicKey);
        try {
            yield open_1.default(url);
        }
        catch (e) {
            console.error(`Failed to launch browser. %s`, e.stack);
        }
    }
}));
