export interface StatusResponse {
  id: string
  created_at: string
  media_attachments: {
    id: string
    type: string
    url: string
    remote_url: string
  }[]
}

export interface Lineup {
  starters: string[]
  bench: []
}