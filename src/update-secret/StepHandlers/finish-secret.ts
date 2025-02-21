import RotationHandler from './rotation-handler'
import { SecretsManagerRotationEvent } from 'aws-lambda'
import { DescribeSecretCommand, UpdateSecretVersionStageCommand } from '@aws-sdk/client-secrets-manager'

export default class FinishSecret extends RotationHandler {
  async handle (event: SecretsManagerRotationEvent): Promise<void> {

    const describeSecretCommand = new DescribeSecretCommand({
      SecretId: event.SecretId
    })
    const secret = await this.secretsClient.send(describeSecretCommand)

    if (secret.VersionIdsToStages === undefined) {
      throw new Error()
    }

    let currentVersion: string|undefined = undefined

    for (const [version, stages] of Object.entries(secret.VersionIdsToStages)) {
      if (stages.includes('AWSCURRENT')) {
        currentVersion = version
      }
    }

    const updateStageCommand = new UpdateSecretVersionStageCommand({
      SecretId: event.SecretId,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: event.ClientRequestToken,
      RemoveFromVersionId: currentVersion
    })

    await this.secretsClient.send(updateStageCommand)
  }
}