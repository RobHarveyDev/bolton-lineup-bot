import { Lineup } from './types'
import { Mistral } from '@mistralai/mistralai'
import { assertStringArray, hasOwnProperty } from '../shared/utilities'

export class MistralClient {
  private client: Mistral;

  constructor (apiKey: string) {
    this.client = new Mistral({
      apiKey,
    })
  }

  public async getLineup(imageUrl: string): Promise<Lineup|null> {
    const chatResponse = await this.client.chat.complete({
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Get the lineup from this image in the JSON format: {"starters": ["NAME"], "bench": ["NAME"]}, replacing "NAME" with the names of the players. If this is not an image of a team sheet, respond in the JSON format: {"error": true}. Only respond with JSON',
            },
            {
              type: "image_url",
              imageUrl: imageUrl,
            }
          ]
        }
      ],
      responseFormat: {type: 'json_object'},
    })

    if (!chatResponse.choices || chatResponse.choices?.length === 0) {
      console.debug('Did not receive any actual responses from Mistral AI', chatResponse)
      return null
    }

    const responseContent = chatResponse.choices[0].message.content

    if (typeof responseContent !== 'string') {
      console.debug('Did not receive string response from Mistral AI. Received:', typeof responseContent)
      return null
    }

    let responseJson: Lineup
    try {
      responseJson = JSON.parse(responseContent)
    } catch (e) {
      console.debug('Did not receive valid json response from Mistral AI', responseContent)
      return null
    }

    const isLineup = this.checkResponseIsLineup(responseJson)

    if (!isLineup) {
      console.debug('Did not receive valid lineup response from Mistral AI', responseContent)
      return null
    }

    return responseJson
  }

  public checkResponseIsLineup(input: object): input is Lineup {
    if (!hasOwnProperty(input, 'starters') || !hasOwnProperty(input, 'bench')) {
      return false
    }

    return assertStringArray(input.starters) && assertStringArray(input.bench)
  }
}