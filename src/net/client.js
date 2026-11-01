// The one door to Yorkie Cloud. The SDK is loaded only when someone plays
// together, so a solo game never downloads it.
let pending = null;

export function connect() {
  pending ??= (async () => {
    const sdk = await import('@yorkie-js/sdk');
    const client = new sdk.Client({ apiKey: import.meta.env.VITE_YORKIE_API_KEY });
    await client.activate();
    return { sdk, client };
  })().catch((err) => { pending = null; throw err; });
  return pending;
}
