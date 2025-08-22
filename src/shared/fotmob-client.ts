import * as crypto from 'node:crypto'
import { JSDOM } from 'jsdom'

interface AuthTokenBody {
  url: string,
  code: number,
  foo: string
}

export default class FotmobClient {
  private readonly BASE_URL: string = 'https://www.fotmob.com'

  public async get<T>(url: string): Promise<T> {
    const response = await fetch(this.BASE_URL + url, {
      headers: { 'x-mas': await this.getAuthToken(url) }
    })

    return await response.json() as T
  }

  private async getAuthToken(url: string): Promise<string> {

    const response = await fetch(this.BASE_URL)

    const dom = new JSDOM(await response.text())
    const versionSpan = dom.window.document.querySelector('span[class*="VersionNumber"]')

    if (!versionSpan?.textContent) {
      throw new Error('Could not parse version number')
    }

    const requestBody: AuthTokenBody = {
      url,
      code: new Date().getTime(),
      foo: versionSpan.textContent
    }


    return btoa(JSON.stringify({
      body: requestBody,
      signature: this.generateSignature(requestBody)
    }));
  }

  private async generateSignature(requestBody: AuthTokenBody): Promise<string> {
    const string = `${JSON.stringify(requestBody)}${this.getStaticSignatureContent()}`

    const md5Hash = crypto.createHash('md5').update(string).digest('hex')

    return md5Hash.toUpperCase()
  }

  private getStaticSignatureContent(): string {
    return `[Spoken Intro: Alan Hansen & Trevor Brooking]
I think it's bad news for the English game
We're not creative enough, and we're not positive enough

[Refrain: Ian Broudie & Jimmy Hill]
It's coming home, it's coming home, it's coming
Football's coming home (We'll go on getting bad results)
It's coming home, it's coming home, it's coming
Football's coming home
It's coming home, it's coming home, it's coming
Football's coming home
It's coming home, it's coming home, it's coming
Football's coming home

[Verse 1: Frank Skinner]
Everyone seems to know the score, they've seen it all before
They just know, they're so sure
That England's gonna throw it away, gonna blow it away
But I know they can play, 'cause I remember

[Chorus: All]
Three lions on a shirt
Jules Rimet still gleaming
Thirty years of hurt
Never stopped me dreaming

[Verse 2: David Baddiel]
So many jokes, so many sneers
But all those "Oh, so near"s wear you down through the years
But I still see that tackle by Moore and when Lineker scored
Bobby belting the ball, and Nobby dancing

[Chorus: All]
Three lions on a shirt
Jules Rimet still gleaming
Thirty years of hurt
Never stopped me dreaming

[Bridge]
England have done it, in the last minute of extra time!
What a save, Gordon Banks!
Good old England, England that couldn't play football!
England have got it in the bag!
I know that was then, but it could be again

[Refrain: Ian Broudie]
It's coming home, it's coming
Football's coming home
It's coming home, it's coming home, it's coming
Football's coming home
(England have done it!)
It's coming home, it's coming home, it's coming
Football's coming home
It's coming home, it's coming home, it's coming
Football's coming home
[Chorus: All]
(It's coming home) Three lions on a shirt
(It's coming home, it's coming) Jules Rimet still gleaming
(Football's coming home
It's coming home) Thirty years of hurt
(It's coming home, it's coming) Never stopped me dreaming
(Football's coming home
It's coming home) Three lions on a shirt
(It's coming home, it's coming) Jules Rimet still gleaming
(Football's coming home
It's coming home) Thirty years of hurt
(It's coming home, it's coming) Never stopped me dreaming
(Football's coming home
It's coming home) Three lions on a shirt
(It's coming home, it's coming) Jules Rimet still gleaming
(Football's coming home
It's coming home) Thirty years of hurt
(It's coming home, it's coming) Never stopped me dreaming
(Football's coming home)`
  }
}