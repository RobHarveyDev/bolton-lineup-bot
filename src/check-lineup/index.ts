import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

interface Player {
  name: string
  shirtNumber: string
}
interface Lineup {
  homeTeam: {
    name: string
    starters: Player[]
    subs: Player[]
  }
  awayTeam: {
    name: string
    starters: Player[]
    subs: Player[]
  }
}

interface MatchDetails {
  content: {
    lineup: Lineup | null
  }
}

interface EventInput {
  matchId: number
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

  const url = `https://www.fotmob.com/api/matchDetails?matchId=${eventData.matchId}`

  const matchDetailsResponse = await fetch(url)
  const matchDetailsJson = await matchDetailsResponse.json() as MatchDetails

  if (matchDetailsJson.content.lineup === null) {
    return
  }

  const rawLineup = matchDetailsJson.content.lineup.homeTeam

  const starters: string[] = rawLineup.starters.map(playerNameMapper)
  const bench: string[] = rawLineup.subs.map(playerNameMapper)

  const formattedLineup = {
    starters,
    bench
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
      ':lineupValue': formattedLineup
    }),
    UpdateExpression: 'set #lineup = :lineupValue'
  })

  await dynamoClient.send(updateItemCommand)

  const eventBusClient = new EventBridgeClient()
  const putEventCommand = new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_ARN,
      DetailType: 'Lineup Set',
      Source: 'lineup-checker',
      Detail: JSON.stringify({
        matchId: eventData.matchId,
        starters: formattedLineup.starters,
        bench: formattedLineup.bench
      })
    }]
  })
  await eventBusClient.send(putEventCommand)
}

const playerNameMapper = (player: Player): string => {
  return player.name
}
