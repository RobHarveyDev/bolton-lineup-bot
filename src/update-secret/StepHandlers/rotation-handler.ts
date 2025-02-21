import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { SecretsManagerRotationEvent } from 'aws-lambda'

export default abstract class RotationHandler {
  constructor (protected secretsClient: SecretsManagerClient) {}

  public abstract handle(event: SecretsManagerRotationEvent): Promise<void>
}