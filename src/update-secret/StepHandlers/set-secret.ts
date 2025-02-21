import RotationHandler from './rotation-handler'
import { SecretsManagerRotationEvent } from 'aws-lambda'

export default class SetSecret extends RotationHandler {
  async handle (event: SecretsManagerRotationEvent): Promise<void> {
    return
  }
}