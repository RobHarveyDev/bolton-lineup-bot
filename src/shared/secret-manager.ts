export default class SecretManager {
  constructor (private port: number = 2773) {}

  public async getSecret<T>(name: string): Promise<T> {
    const url = `http://localhost:${this.port}/secretsmanager/get?secretId=${name}`
    const secretsResponse = await fetch(url, {
      method: "GET",
      headers: {
        "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN!,
      },
    })

    if (!secretsResponse.ok) {
      throw new Error(
        `Error occurred while requesting secret ${name}. Responses status was ${secretsResponse.status}`
      );
    }

    const secretContent = (await secretsResponse.json())
    return JSON.parse(secretContent.SecretString)
  }
}