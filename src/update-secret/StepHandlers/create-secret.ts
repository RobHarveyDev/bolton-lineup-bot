import RotationHandler from './rotation-handler'
import { SecretsManagerRotationEvent } from 'aws-lambda'
import { PutSecretValueCommand } from '@aws-sdk/client-secrets-manager'

export default class CreateSecret extends RotationHandler {
  async handle (event: SecretsManagerRotationEvent): Promise<void> {
    const url = process.env.FOTMOB_TOKEN_URL

    if (url === undefined) {
      throw new Error('FOTMOB_TOKEN_URL is not set.')
    }

    console.log('Getting token...')
    console.time('token-request')
    const response = await fetch(url)
    console.timeEnd('token-request')

    if (!response.ok) {
      throw new Error(`HTTP Error [${response.status}] returned from FotMob`)
    }

    const storeSecretCommand = new PutSecretValueCommand({
      SecretId: event.SecretId,
      ClientRequestToken: event.ClientRequestToken,
      SecretString: await response.text(),
      VersionStages: ['AWSPENDING']
    })

    console.log('Creating new secret version...')
    console.time('create-secret')
    await this.secretsClient.send(storeSecretCommand)
    console.timeEnd('create-secret')
  }
}