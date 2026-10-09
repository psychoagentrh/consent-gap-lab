// Share a fixed teaching example, never visitor-entered request data.
export const examplePath = '/inspect.html?example=maximum-vs-20';
export const exampleURL = 'https://lab.psychoagent.com' + examplePath;
export const invalidExampleMessage = 'Example link not recognized. Nothing was loaded. Choose an invented example or paste your own request.';

export function readExampleLink(href) {
  const url = new URL(href);
  if (!url.search && !url.hash) return null;
  const entries = [...url.searchParams];
  if (url.hash || entries.length !== 1 || entries[0][0] !== 'example' || entries[0][1] !== 'maximum-vs-20') {
    throw new Error(invalidExampleMessage);
  }
  return 'maximum';
}
