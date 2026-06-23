export interface ContentResult {
  title: string
  url: string
  content: string
}

export interface ContentProvider {
  name: string
  fetch(url: string): Promise<ContentResult>
}
