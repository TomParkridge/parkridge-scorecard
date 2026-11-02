import { describe, expect, it, vi } from 'vitest';
import { SCORECARD_SUBMIT_URL } from './env.ts';
import { sendSubmission } from './submit.ts';
import type { SubmissionPayload } from './submit.ts';

const payload: SubmissionPayload = {
  sessionId: 's_1700000000000_abc123',
  answers: { ai_level: 'level_2' },
  contact: { name: 'Sam', email: 'sam@example.com' },
  traffic: {},
};

const respond = (...statuses: (number | Error)[]) => {
  const fn = vi.fn<typeof fetch>();
  for (const s of statuses) {
    if (s instanceof Error) fn.mockRejectedValueOnce(s);
    else fn.mockResolvedValueOnce(new Response(null, { status: s }));
  }
  return fn;
};

describe('sendSubmission', () => {
  it('posts JSON to the endpoint with keepalive', async () => {
    const fetchImpl = respond(200);
    await sendSubmission(payload, fetchImpl, 0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(SCORECARD_SUBMIT_URL);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init!.body as string)).toEqual(payload);
  });

  it('retries once on a 5xx with the same body', async () => {
    const fetchImpl = respond(500, 200);
    await sendSubmission(payload, fetchImpl, 0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1]!.body).toBe(fetchImpl.mock.calls[0][1]!.body);
  });

  it('retries once on a network error', async () => {
    const fetchImpl = respond(new Error('offline'), 200);
    await sendSubmission(payload, fetchImpl, 0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 413, 429])('does not retry a %i', async (status) => {
    const fetchImpl = respond(status);
    await sendSubmission(payload, fetchImpl, 0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops after one retry and never throws', async () => {
    const fetchImpl = respond(new Error('offline'), new Error('offline'), 200);
    await expect(sendSubmission(payload, fetchImpl, 0)).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
