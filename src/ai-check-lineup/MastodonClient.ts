import { StatusResponse } from './types'

export class MastodonClient {
  constructor (private instanceUrl: string) {}

  public async getStatuses(accountId: string) {
    const params = new URLSearchParams({
      only_media: 'true',
      exclude_replies: 'true',
      exclude_reblogs: 'true',
      limit: '15'
    })

    const statusUrl = `${this.instanceUrl}/api/v1/accounts/${accountId}/statuses?${params}`
    return await this.makeRequest<StatusResponse[]>(statusUrl);
  }

  private async makeRequest<T>(url: string, options?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(url, options)
    } catch (error) {
      const message = `Error sending request to ${url}.`
      console.error(message, options)
      throw new Error(message)
    }

    if (!response.ok) {
      const message = `Unsuccessful response from ${url}. Status: ${response.status}`
      console.error(message, response)
      throw new Error(message)
    }

    return await response.json()
  }
}