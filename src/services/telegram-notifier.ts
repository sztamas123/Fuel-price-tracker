export interface TelegramNotifier {
  sendMessage(message: string): Promise<void>;
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface TelegramBotNotifierOptions {
  botToken: string;
  chatId: string;
  fetcher?: Fetcher;
}

function isTelegramSuccess(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true
  );
}

export class TelegramBotNotifier implements TelegramNotifier {
  private readonly endpoint: URL;
  private readonly chatId: string;
  private readonly fetcher: Fetcher;

  constructor(options: TelegramBotNotifierOptions) {
    this.endpoint = new URL(
      `https://api.telegram.org/bot${options.botToken}/sendMessage`
    );
    this.chatId = options.chatId;
    this.fetcher = options.fetcher ?? fetch;
  }

  async sendMessage(message: string): Promise<void> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text: message }),
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`Telegram request failed with HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isTelegramSuccess(payload)) {
      throw new Error("Telegram rejected the notification request");
    }
  }
}
