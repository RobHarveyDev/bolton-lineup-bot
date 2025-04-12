import { MastodonClient } from './MastodonClient'
import { MistralClient } from './MistralClient'
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import SecretManager from '../shared/secret-manager'

interface EventInput {
  matchId: number
  lineupAnnouncementAt: string
}

export const handler = async (eventData: EventInput): Promise<void> => {
  const dynamoClient = new DynamoDBClient()
  const getMatchDetails = await dynamoClient.send(new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { N: eventData.matchId.toString() }
    },
    ProjectionExpression: 'lineup'
  }))

  const item = getMatchDetails.Item ? unmarshall(getMatchDetails.Item) : null
  if (item && item.lineup) {
    console.log('lineup already set.')
    return
  }

  const instanceUrl = 'https://mastodon.social'
  const accountId = '113873729220290769'

  const secretClient = new SecretManager()
  const secret = await secretClient.getSecret<Record<string, string>>(process.env.SHARED_SECRETS!)

  const mistralApiKey = secret.MISTRAL_API_KEY

  const lineupAnnouncedAt = new Date(eventData.lineupAnnouncementAt)
  const lineupStatusDateFrom = new Date(lineupAnnouncedAt)
  lineupStatusDateFrom.setMinutes(lineupAnnouncedAt.getMinutes() - 2)

  const mastodonClient = new MastodonClient(instanceUrl)

  const statuses = await mastodonClient.getStatuses(accountId)

  const potentialLineupStatuses = statuses.filter((status) => {
    return status.media_attachments.length === 1
      && status.media_attachments[0].type === 'image'
      && new Date(status.created_at) > lineupStatusDateFrom
  }).sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  if (potentialLineupStatuses.length < 1) {
    console.info('Did not find any potential lineup statuses')
    return
  }

  console.info(`order`, potentialLineupStatuses.map(status => status.created_at))
  console.info(`Found ${potentialLineupStatuses.length} potential lineup images`, potentialLineupStatuses.map(status => status.media_attachments[0].remote_url))

  const client = new MistralClient(mistralApiKey)

  const imageUrl = potentialLineupStatuses[0].media_attachments[0].remote_url

  console.info('Using Image:', imageUrl)

  const lineupResponse = await client.getLineup(imageUrl)
  console.info('Received Lineup response from Mistral AI', lineupResponse)

  if (lineupResponse === null) {
    return
  }

  const updateItemCommand = new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: { N: eventData.matchId.toString() }
    },
    ExpressionAttributeNames: {
      '#lineup': 'lineup'
    },
    ExpressionAttributeValues: marshall({
      ':lineupValue': lineupResponse
    }),
    UpdateExpression: 'set #lineup = :lineupValue'
  })

  await dynamoClient.send(updateItemCommand)

  const eventBusClient = new EventBridgeClient()
  const putEventCommand = new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_ARN,
      DetailType: 'Lineup Set',
      Source: 'ai-lineup-checker',
      Detail: JSON.stringify({
        matchId: eventData.matchId,
        starters: lineupResponse.starters,
        bench: lineupResponse.bench
      })
    }]
  })
  await eventBusClient.send(putEventCommand)
}