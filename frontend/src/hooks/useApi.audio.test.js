import { transcribeAudio } from "./useApi";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("transcribeAudio uploads", () => {
  test("rejects an empty recording before making a network request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true });
    await expect(transcribeAudio("account-123", new Blob([], { type: "audio/webm" })))
      .rejects.toThrow(/Rekodi haina sauti/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("uses a filename matching the actual browser audio container", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: "sauti", nlp: {} }),
    });
    const blob = new Blob(["recorded audio"], { type: "audio/ogg;codecs=opus" });

    await transcribeAudio("account-123", blob);

    const form = fetchSpy.mock.calls[0][1].body;
    expect(form.get("audio").name).toBe("recording.ogg");
    expect(form.get("user_id")).toBe("account-123");
  });
});
