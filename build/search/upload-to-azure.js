const fs = require('fs').promises;

const {
  SearchIndexClient,
  AzureKeyCredential,
} = require('@azure/search-documents');

require('dotenv').config();

const endpoint = process.env.SEARCH_API_ENDPOINT || "";
const apiKey = process.env.SEARCH_API_KEY || "";

console.log(endpoint)

async function main() {
  if (!endpoint  || !apiKey) {
    console.warn('please configure required env vars');
    return;
  }

  const siteConfig = JSON.parse(
      await fs.readFile(`./build/site-config.json`, 'utf8')
  );

  const search = JSON.parse(
      await fs.readFile(`./${siteConfig.output.main}/js/search.json`, 'utf8')
  );

  search.forEach(x => x.id = x.file.replace('.html', ''))

  const indexClient = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));
  const searchClient = indexClient.getSearchClient(`blog-index`);

  console.log('Uploading documents...');
  let indexDocumentsResult = await searchClient.mergeOrUploadDocuments(search);
  console.log(
      `Index operations succeeded: ${JSON.stringify(
          indexDocumentsResult.results[0].succeeded
      )}`
  );
}

main().catch((err) => {
  console.error('Error while re-building Azure Search Index:', err);
});
