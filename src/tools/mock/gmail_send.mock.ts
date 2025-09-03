export async function send(params: { to: string; subject: string; text: string }) {
  return {
    id: `mock_${Math.random().toString(36).slice(2)}`,
    to: params.to,
    status: 'queued',
    subject_len: params.subject.length,
    body_len: params.text.length
  }
}
