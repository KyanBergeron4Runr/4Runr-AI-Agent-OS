export async function get(params: { url: string; timeoutMs?: number }) {
  // simple synthetic page; enforce policy caps upstream if you want
  return {
    url: params.url,
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: `<html><head><title>Mock</title></head><body><h1>${params.url}</h1><p>hello</p></body></html>`,
    bytes: 120
  }
}
