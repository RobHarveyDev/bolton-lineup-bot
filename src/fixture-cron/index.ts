import { CreateScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

interface TeamDetails {
  fixtures: {
    allFixtures: {
      nextMatch: Fixture
    }
  }
}

interface Fixture {
  id: number
  opponent: Team
  home: Team
  away: Team
  notStarted: boolean
  tournament: {
    name: string
    leagueId: number
  }
  status: {
    utcTime: string //DateTime
    started: boolean
    cancelled: boolean
    finished: boolean
  }
}

interface Team {
  id: number
  name: string
  score: number
}

export const handler = async (): Promise<void> => {
  const LEAGUE_ONE_ID = 108
  const BOLTON_TEAM_ID = 8559

  const teamDetailsResponse = await fetch(`https://www.fotmob.com/api/teams?id=${BOLTON_TEAM_ID}`)
  const teamDetailsJson = await teamDetailsResponse.json() as TeamDetails

  const nextFixture = teamDetailsJson.fixtures.allFixtures.nextMatch

  if (nextFixture.home.id !== BOLTON_TEAM_ID) {
    return
  }

  if (!nextFixture.notStarted) {
    return
  }

  if (nextFixture.status.cancelled) {
    return
  }

  if (nextFixture.tournament.leagueId !== LEAGUE_ONE_ID) {
    return
  }

  const today = new Date()
  const kickOff = new Date(nextFixture.status.utcTime)

  if (kickOff.toDateString() !== today.toDateString()) {
    return
  }

  const lineupAnnounced = new Date(kickOff.toISOString())
  lineupAnnounced.setHours(kickOff.getHours() - 1)

  const dynamoClient = new DynamoDBClient()
  const itemKey = kickOff.toISOString().split('T')[0]
  const putFixtureCommand = new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: {
        N: nextFixture.id.toString()
      },
      tournamentId: {
        N: nextFixture.tournament.leagueId.toString()
      },
      kickOff: {
        S: kickOff.toISOString()
      }
    }
  })

  await dynamoClient.send(putFixtureCommand)

  const schedulerClient = new SchedulerClient()

  const startLineupCheck = new Date(lineupAnnounced.toISOString())
  startLineupCheck.setMinutes(lineupAnnounced.getMinutes() + 10)

  const endLineupCheck = new Date(lineupAnnounced.toISOString())
  endLineupCheck.setMinutes(lineupAnnounced.getMinutes() + 20)

  const createScheduleCommand = new CreateScheduleCommand({
    Name: `check-lineup-${itemKey}`,
    GroupName: process.env.SCHEDULE_GROUP_NAME,
    FlexibleTimeWindow: { Mode: "OFF" },
    StartDate: lineupAnnounced,
    EndDate: endLineupCheck,
    ScheduleExpression: 'rate(1 minute)',
    ActionAfterCompletion: 'DELETE',
    Target: {
      Arn: process.env.LINEUP_CHECKER_ARN,
      RoleArn: process.env.SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({ matchId: nextFixture.id }),
      RetryPolicy: {
        MaximumRetryAttempts: 1
      }
    }
  })

  await schedulerClient.send(createScheduleCommand)
}
