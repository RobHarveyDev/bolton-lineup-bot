import { EventBridgeEvent } from 'aws-lambda'
import SecretManager from '../shared/secret-manager'

interface EventData {
  matchId: number
  starters: string[]
  bench: string[]
}

interface TwilioSecret {
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  PHONE_FROM: string
  PHONE_TO: string[]
}

export const handler = async (event: EventBridgeEvent<'Lineup Set', EventData>): Promise<void> => {
  const secretClient = new SecretManager()
  const secret = await secretClient.getSecret<TwilioSecret>(process.env.SECRET_NAME!)
  const accountSid = secret.TWILIO_ACCOUNT_SID;
  const authToken = secret.TWILIO_AUTH_TOKEN;
  const phoneFrom = secret.PHONE_FROM;
  const phoneTo = secret.PHONE_TO;

  const twilio = require('twilio')

  const client = twilio(accountSid, authToken);

  const { starters, bench } = event.detail

  console.log('Making SMS...')
  let smsBody = ""
  smsBody += "Starters:\n"
  starters.forEach((playerName) => {
    smsBody += `${playerName}\n`
  })
  smsBody += "\n\n"
  smsBody += "Bench:\n"
  bench.forEach((playerName) => {
    smsBody += `${playerName}\n`
  })

  const messages = phoneTo.map((phone) => client.messages.create({
    to: phone,
    from: phoneFrom,
    body: smsBody,
  }))

  await Promise.all(messages)
}
