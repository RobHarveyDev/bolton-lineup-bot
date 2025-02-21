import { SecretsManagerRotationEvent } from 'aws-lambda'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { SecretsManagerRotationEventStep } from 'aws-lambda/trigger/secretsmanager'
import RotationHandler from './StepHandlers/rotation-handler'
import CreateSecret from './StepHandlers/create-secret'
import SetSecret from './StepHandlers/set-secret'
import TestSecret from './StepHandlers/test-secret'
import FinishSecret from './StepHandlers/finish-secret'

type Router = {
  [key in SecretsManagerRotationEventStep]: {
    new (...args: ConstructorParameters<typeof RotationHandler>): RotationHandler
  }
}

export const handler = async (event: SecretsManagerRotationEvent): Promise<void> => {
  const secretClient = new SecretsManagerClient()

  const stepRouting: Router = {
    createSecret: CreateSecret,
    setSecret: SetSecret,
    testSecret: TestSecret,
    finishSecret: FinishSecret
  }

  console.log(`Handling step [${event.Step}] of secret rotation.`)

  const stepHandler = new stepRouting[event.Step](secretClient)
  return stepHandler.handle(event)
}
