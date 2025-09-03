export async function chat(params: { model: string; input: string }) {
  return {
    model: params.model,
    output: `SUMMARY: ${params.input.slice(0, 120)}`,
    tokens_est: Math.ceil(params.input.length / 3)
  }
}
