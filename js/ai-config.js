/* CAERUS optional AI upgrade. With key: '' the bot runs fully on-device
   (intent engine + local knowledge base) and makes zero network calls.
   To enable free LLM answers: create a Gemini API key on a NO-BILLING
   Google AI Studio account, restrict it in Google Cloud Console to
   HTTP referrer https://flaviogiorgioguarini.github.io/* and to the
   Generative Language API only, then paste it here. A referrer-locked,
   free-tier, no-billing key is rate-limited, cannot spend money, and is
   the accepted pattern for keyless static sites. See README §CAERUS. */

export const AI = {
  key: '',
  model: 'gemini-2.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
  maxTokens: 320,
  temperature: 0.4,
};
