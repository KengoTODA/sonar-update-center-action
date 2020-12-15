import {request} from 'https'

export async function createTopic(token: string, title: string, body: string): Promise<string> {
    const data = JSON.stringify({
        title,
        category: 15, // for plugin development
        raw: body
    })
    // creating a new topic by https://docs.discourse.org/#tag/Topics/paths/~1posts.json/post
    return new Promise((resolve, reject) => {
        const req = request({
            hostname: 'community.sonarsource.com',
            path: '/posts.json',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, res => {
            if (res.statusCode != 200) {
                reject(new Error(`Failed to create a topic in the community forum. The status code is ${JSON.stringify(res.statusCode)} and message is ${res.statusMessage}.`))
            }

            res.on('data', data => {
                const {topic_id, topic_slug} = JSON.parse(data)
                resolve(`https://community.sonarsource.com/t/${topic_slug}/${topic_id}`)
            })
        })
        req.write(data)
        req.end()
    })
}