import { EventBridgeEvent } from 'aws-lambda'

interface EventData {
  matchId: number
  starters: string[]
  bench: string[]
}

export const handler = async (event: EventBridgeEvent<'Lineup Set', EventData>): Promise<void> => {
  const secretsPort = 2773
  const secretName = process.env.TWILIO_SECRET_NAME

  const url = `http://localhost:${secretsPort}/secretsmanager/get?secretId=${secretName}`;

  const secretsResponse = await fetch(url, {
    method: "GET",
    headers: {
      "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN!,
    },
  })

  if (!secretsResponse.ok) {
    throw new Error(
      `Error occurred while requesting secret ${secretName}. Responses status was ${secretsResponse.status}`
    );
  }

  const secretContent = (await secretsResponse.json())

  const secret = JSON.parse(secretContent.SecretString)
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

  await client.messages.create({
    to: phoneTo,
    from: phoneFrom,
    body: smsBody,
  })
}
