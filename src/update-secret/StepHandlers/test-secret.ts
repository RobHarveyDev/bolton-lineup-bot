import RotationHandler from './rotation-handler'
import { SecretsManagerRotationEvent } from 'aws-lambda'
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

export default class TestSecret extends RotationHandler {
  async handle (event: SecretsManagerRotationEvent): Promise<void> {
    const url = process.env.FOTMOB_TEST_URL

    if (url === undefined) {
      console.error('FOTMOB_TEST_URL is not set.')
      return
    }

    const getSecretCommand = new GetSecretValueCommand({
      SecretId: event.SecretId,
      VersionStage: 'AWSPENDING'
    })

    console.log('Getting pending secret...')
    console.time('get-secret')
    const secretResponse = await this.secretsClient.send(getSecretCommand)
    console.timeEnd('get-secret')

    if (secretResponse.SecretString === undefined) {
      throw new Error('Secret is undefined.')
    }

    let headers: Record<string, string>

    try {
      headers = JSON.parse(secretResponse.SecretString)
    } catch (e) {
      throw new Error('Secret is not valid JSON')
    }

    console.log('Testing new secret...')
    console.time('test-secret')
    const response = await fetch(url, { headers })
    console.timeEnd('test-secret')

    if (!response.ok) {
      console.log('Token Failed')
      throw new Error('Token is not valid.')
    }

    console.log('Token Passed.')

    return
  }
}